import crypto from "node:crypto";
import {
  transaction,
  userForToken,
  logActivity,
  getDocumentWithContent,
} from "./db.js";
import {
  cleanForm,
  validateApplication,
  POLICY_VERSION,
  UNIVERSITIES,
} from "../shared/admissions.js";
import { decryptFile } from "./fileCrypto.js";

export const safe = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const httpError = (status, message) =>
  Object.assign(new Error(message), { status });
export const applicationIdValid = (id) =>
  typeof id === "string" && /^app-[A-Za-z0-9-]{8,60}$/.test(id);
export const sessionAuth = (db) =>
  safe(async (req, res, next) => {
    if (!db)
      throw httpError(
        503,
        "Accounts are not available yet. Please try again later.",
      );
    const header = req.get("authorization") || "";
    const user = header.startsWith("Bearer ")
      ? await userForToken(db, header.slice(7))
      : null;
    if (!user)
      throw httpError(
        401,
        "Please sign in to save and access your application.",
      );
    req.user = user;
    res.set("Cache-Control", "no-store");
    next();
  });
export function describeApplication(row) {
  return {
    id: row.id,
    form: row.form,
    currentStep: row.current_step,
    version: row.version,
    status: row.status,
    updatedAt: row.updated_at,
    payment: {
      status: row.paid_at ? "paid" : "unpaid",
      paymentIntentId: row.payment_intent_id || undefined,
      paidAt: row.paid_at || undefined,
      amount: row.paid_at ? 18000 : undefined,
      currency: "eur",
      receiptRef: row.payment_intent_id?.slice(-10).toUpperCase(),
    },
  };
}
export async function ownApplication(db, id, userId) {
  const { rows } = await db.query(
    "SELECT * FROM applications WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  if (!rows[0]) throw httpError(404, "Application not found.");
  return rows[0];
}
export async function saveDraft(db, user, id, input) {
  if (!applicationIdValid(id))
    throw httpError(400, "Invalid application reference.");
  const form = cleanForm(input.form);
  if (form.email !== user.email)
    throw httpError(400, "Use the email address you signed in with.");
  const step = Math.min(8, Math.max(1, Number(input.currentStep) || 1));
  return transaction(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "application:" + id,
    ]);
    const { rows } = await c.query(
      "SELECT * FROM applications WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (rows[0]) {
      if (rows[0].user_id !== user.id)
        throw httpError(404, "Application not found.");
      if (rows[0].status !== "draft")
        throw httpError(
          409,
          "This application is locked for checkout or review. Resume it from your account.",
        );
      if (rows[0].version !== Number(input.version))
        throw httpError(
          409,
          "A newer draft exists. Open it from My Account before editing.",
        );
      const result = await c.query(
        "UPDATE applications SET form=$2,current_step=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
        [id, form, step],
      );
      return describeApplication(result.rows[0]);
    }
    const result = await c.query(
      "INSERT INTO applications(id,user_id,form,current_step) VALUES($1,$2,$3,$4) RETURNING *",
      [id, user.id, form, step],
    );
    return describeApplication(result.rows[0]);
  });
}
export function checkoutMetadata(row) {
  const f = row.form;
  return {
    description: `StudyBg onboarding: ${f.degree} at ${UNIVERSITIES.find((u) => u.id === f.universityId)?.name}`,
    receipt_email: f.email,
    metadata: {
      source: "studybg-wizard",
      application_id: row.id,
      applicant_name: f.fullName,
      applicant_email: f.email,
      degree: f.degree,
      university: UNIVERSITIES.find((u) => u.id === f.universityId)?.name || "",
      intake: f.intakeSeason,
      call_date: f.consultationDate,
      call_window: f.consultationWindow,
      call_timezone: "Europe/Sofia",
    },
  };
}
export async function createCheckout(db, stripe, user, id, version) {
  if (!applicationIdValid(id))
    throw httpError(400, "Invalid application reference.");
  const c = await db.connect();
  try {
    await c.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
      "application:" + id,
    ]);
    const row = await ownApplication(c, id, user.id);
    if (row.form.email !== user.email)
      throw httpError(400, "Application email does not match your account.");
    if (row.version !== Number(version))
      throw httpError(409, "Your application changed. Reload the saved draft.");
    if (row.payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(row.payment_intent_id);
      if (pi.status !== "canceled") return pi;
      throw httpError(
        409,
        "Reopen the canceled application from My Account before checkout.",
      );
    }
    if (
      row.checkout_started_at &&
      Date.now() - new Date(row.checkout_started_at).getTime() > 23 * 3600_000
    )
      throw httpError(
        409,
        "Payment creation needs review. Please contact support before trying again.",
      );
    if (!row.checkout_started_at) {
      const errors = validateApplication(row.form);
      if (errors.length) throw httpError(400, errors.join(" "));
      await c.query("BEGIN");
      try {
        await c.query(
          `INSERT INTO application_consents(application_id,user_id,policy_version,form_snapshot,application_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [id, user.id, POLICY_VERSION, row.form, row.version],
        );
        await c.query(
          "UPDATE applications SET status='checkout',checkout_started_at=now(),submitted_at=coalesce(submitted_at,now()),updated_at=now() WHERE id=$1",
          [id],
        );
        await c.query("COMMIT");
      } catch (err) {
        await c.query("ROLLBACK");
        throw err;
      }
    }
    // Persist the reservation before contacting Stripe. A timeout reuses the exact
    // same immutable payload/key; after the provider window, require reconciliation.
    const pi = await stripe.paymentIntents.create(
      {
        ...checkoutMetadata(row),
        amount: 18000,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `studybg:${id}:${row.checkout_attempt}` },
    );
    await c.query(
      "UPDATE applications SET payment_intent_id=$2,updated_at=now() WHERE id=$1",
      [id, pi.id],
    );
    return pi;
  } finally {
    await c.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
      "application:" + id,
    ]);
    c.release();
  }
}
export function mountWorkflow(
  app,
  { db, fileKey, staffEmails = [], stripe, billing },
) {
  const auth = sessionAuth(db);
  const staff = safe(async (req, res, next) => {
    if (!staffEmails.includes(req.user.email))
      throw httpError(403, "Staff access required.");
    next();
  });
  app.get(
    "/api/applications",
    auth,
    safe(async (req, res) => {
      const { rows } = await db.query(
        "SELECT * FROM applications WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100",
        [req.user.id],
      );
      res.json({ applications: rows.map(describeApplication) });
    }),
  );
  app.get(
    "/api/applications/:id",
    auth,
    safe(async (req, res) =>
      res.json(
        describeApplication(
          await ownApplication(db, req.params.id, req.user.id),
        ),
      ),
    ),
  );
  app.post(
    "/api/applications/:id",
    auth,
    safe(async (req, res) =>
      res.json(await saveDraft(db, req.user, req.params.id, req.body)),
    ),
  );
  app.post(
    "/api/applications/:id/reopen",
    auth,
    safe(async (req, res) => {
      const result = await transaction(db, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          "application:" + req.params.id,
        ]);
        const row = await ownApplication(c, req.params.id, req.user.id);
        if (row.checkout_started_at && !row.payment_intent_id)
          throw httpError(
            409,
            "Payment creation needs reconciliation before this application can be reopened.",
          );
        if (row.paid_at)
          throw httpError(
            409,
            "A paid application cannot be changed. Contact your advisor.",
          );
        if (row.payment_intent_id) {
          if (!stripe) throw httpError(503, "Payment status is unavailable.");
          const pi = await stripe.paymentIntents.retrieve(
            row.payment_intent_id,
          );
          if (
            ![
              "requires_payment_method",
              "requires_confirmation",
              "canceled",
            ].includes(pi.status)
          )
            throw httpError(
              409,
              "This payment is processing or completed. Please wait for confirmation.",
            );
          if (pi.status !== "canceled")
            await stripe.paymentIntents.cancel(pi.id);
        }
        const updated = await c.query(
          "UPDATE applications SET payment_intent_id=NULL,checkout_attempt=checkout_attempt+1,checkout_started_at=NULL,status='draft',version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [row.id],
        );
        return describeApplication(updated.rows[0]);
      });
      res.json(result);
    }),
  );
  app.get("/api/staff/me", auth, staff, (_req, res) =>
    res.json({ staff: true }),
  );
  app.get(
    "/api/staff/applications",
    auth,
    staff,
    safe(async (req, res) => {
      const { rows } = await db.query(
        `SELECT a.id,a.form->>'fullName' AS name,a.form->>'email' AS email,a.form->>'degree' AS degree,a.status,a.updated_at FROM applications a ORDER BY updated_at DESC LIMIT 100`,
      );
      res.json({ applications: rows });
    }),
  );
  app.get(
    "/api/staff/applications/:id",
    auth,
    staff,
    safe(async (req, res) => {
      const { rows } = await db.query(
        "SELECT * FROM applications WHERE id=$1",
        [req.params.id],
      );
      const row = rows[0];
      if (!row) throw httpError(404, "Application not found.");
      const docs = await db.query(
        "SELECT id,category,filename,status,review_note,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC",
        [row.user_id],
      );
      const history = await db.query(
        "SELECT action,detail,created_at FROM staff_audit WHERE subject_user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [row.user_id],
      );
      const jobs = await db.query(
        "SELECT id,kind,state,attempts,last_error FROM email_outbox WHERE payload->>'paymentIntentId'=$1",
        [row.payment_intent_id],
      );
      await db.query(
        "INSERT INTO staff_audit(actor_id,subject_user_id,action,detail) VALUES($1,$2,$3,$4)",
        [
          req.user.id,
          row.user_id,
          "application_viewed",
          { applicationId: row.id },
        ],
      );
      res.json({
        application: describeApplication(row),
        userId: row.user_id,
        documents: docs.rows,
        history: history.rows,
        deliveries: jobs.rows,
      });
    }),
  );
  app.post(
    "/api/staff/applications/:id/review",
    auth,
    staff,
    safe(async (req, res) => {
      const status = req.body.status,
        note =
          typeof req.body.note === "string"
            ? req.body.note.trim().slice(0, 2000)
            : "";
      if (
        !["in_review", "action_needed", "review_complete"].includes(status) ||
        !note
      )
        throw httpError(400, "Choose a review status and add a note.");
      await transaction(db, async (c) => {
        const { rows } = await c.query(
          "SELECT * FROM applications WHERE id=$1 FOR UPDATE",
          [req.params.id],
        );
        const row = rows[0];
        if (!row) throw httpError(404, "Application not found.");
        if (!row.paid_at)
          throw httpError(409, "The application has not completed payment.");
        await c.query(
          "UPDATE applications SET status=$2,updated_at=now() WHERE id=$1",
          [row.id, status],
        );
        await logActivity(c, row.user_id, "application_" + status, note);
        await c.query(
          "INSERT INTO staff_audit(actor_id,subject_user_id,action,detail) VALUES($1,$2,$3,$4)",
          [
            req.user.id,
            row.user_id,
            "application_review",
            { applicationId: row.id, status, note },
          ],
        );
        await enqueueNotice(c, row.user_id, row.form.email);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/staff/documents/:id/review",
    auth,
    staff,
    safe(async (req, res) => {
      const status = req.body.status,
        note =
          typeof req.body.note === "string"
            ? req.body.note.trim().slice(0, 2000)
            : "";
      if (!["in_review", "action_needed", "verified"].includes(status) || !note)
        throw httpError(400, "Choose a document status and add a review note.");
      await transaction(db, async (c) => {
        const { rows } = await c.query(
          "SELECT d.*,u.email FROM documents d JOIN users u ON u.id=d.user_id WHERE d.id=$1 FOR UPDATE OF d",
          [req.params.id],
        );
        const d = rows[0];
        if (!d) throw httpError(404, "Document not found.");
        await c.query(
          "UPDATE documents SET status=$2,review_note=$3,reviewed_at=now() WHERE id=$1",
          [d.id, status, note],
        );
        await logActivity(
          c,
          d.user_id,
          "document_" + status,
          `${d.filename}: ${note}`,
        );
        await c.query(
          "INSERT INTO staff_audit(actor_id,subject_user_id,action,detail) VALUES($1,$2,$3,$4)",
          [
            req.user.id,
            d.user_id,
            "document_review",
            { documentId: d.id, status, note },
          ],
        );
        await enqueueNotice(c, d.user_id, d.email);
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/staff/documents/:id/file",
    auth,
    staff,
    safe(async (req, res) => {
      const { rows } = await db.query(
        "SELECT user_id FROM documents WHERE id=$1",
        [req.params.id],
      );
      if (!rows[0]) throw httpError(404, "Document not found.");
      const d = await getDocumentWithContent(
        db,
        rows[0].user_id,
        req.params.id,
      );
      if (!fileKey) throw httpError(503, "Document access is unavailable.");
      const bytes = decryptFile(
        fileKey,
        { iv: d.iv, authTag: d.auth_tag, content: d.content },
        { userId: d.user_id, documentId: d.id },
      );
      await db.query(
        "INSERT INTO staff_audit(actor_id,subject_user_id,action,detail) VALUES($1,$2,$3,$4)",
        [req.user.id, rows[0].user_id, "document_viewed", { documentId: d.id }],
      );
      res
        .set({
          "Content-Type": d.mime_type,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        })
        .send(bytes);
    }),
  );
}
async function enqueueNotice(c, userId, email) {
  await c.query("INSERT INTO email_outbox(id,kind,payload) VALUES($1,$2,$3)", [
    `notice:${crypto.randomUUID()}`,
    "status_notice",
    { userId, email },
  ]);
}
