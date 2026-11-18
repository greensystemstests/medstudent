import { safe, httpError, describeApplication, enqueueNotice } from "../workflow.js";
import { logActivity, getDocumentWithContent, transaction } from "../db.js";
import { decryptFile } from "../fileCrypto.js";
import { DOCUMENT_CATEGORIES } from "../accountRoutes.js";
import { SOURCE_LABEL_SQL } from "../source.js";
import { requireAdmin } from "./middleware.js";
import { UUID_RE, logAdmin } from "./store.js";

export const APPLICATION_STATUSES = ["draft", "checkout", "submitted", "in_review", "action_needed", "review_complete"];
const REVIEW_STATUSES = ["in_review", "action_needed", "review_complete"];
const DOCUMENT_REVIEW_STATUSES = ["in_review", "action_needed", "verified"];

const FROM = `FROM applications a JOIN users u ON u.id = a.user_id LEFT JOIN admin_users ad ON ad.id = a.assigned_admin_id`;
const cleanNote = (v) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, 2000) : "");
const one = (v) => (typeof v === "string" ? v.slice(0, 120) : "");

/** True when the admin's role may see every student; false when only the ones assigned to them. */
const seesAll = (admin) => admin.role_scope === "all";

/** WHERE clause for the admin's scope plus the page's filters. Values are always bound, never pasted in. */
function whereFor(admin, q = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (!seesAll(admin)) add("a.assigned_admin_id = ?", admin.id);
  const text = one(q.q).trim();
  if (text) add("(a.form->>'fullName' ILIKE ? OR u.email ILIKE ? OR a.id ILIKE ?)", `%${text.replace(/[\\%_]/g, "\\$&")}%`);
  const statuses = one(q.status).split(",").filter((s) => APPLICATION_STATUSES.includes(s));
  if (statuses.length) add("a.status = ANY(?)", statuses);
  if (one(q.degree)) add("a.form->>'degree' = ?", one(q.degree));
  if (one(q.university)) add("a.form->>'universityId' = ?", one(q.university));
  if (one(q.source)) add(`${SOURCE_LABEL_SQL} = ?`, one(q.source));
  if (one(q.country)) add("a.form->>'citizenshipCountry' = ?", one(q.country));
  if (q.paid === "yes") where.push("a.paid_at IS NOT NULL");
  if (q.paid === "no") where.push("a.paid_at IS NULL");
  if (q.assigned === "me") add("a.assigned_admin_id = ?", admin.id);
  else if (q.assigned === "none") where.push("a.assigned_admin_id IS NULL");
  else if (UUID_RE.test(String(q.assigned || ""))) add("a.assigned_admin_id = ?", q.assigned);
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const LIST_COLUMNS = `
  a.id, a.form->>'fullName' AS name, u.email, a.form->>'degree' AS degree, a.form->>'universityId' AS university_id,
  a.status, (a.paid_at IS NOT NULL) AS paid, a.current_step, ${SOURCE_LABEL_SQL} AS source,
  a.form->>'citizenshipCountry' AS country, u.signup_country, a.created_at, a.updated_at,
  ad.id AS assigned_id, coalesce(nullif(ad.full_name,''), ad.email) AS assigned_name`;

const publicRow = (r) => ({
  id: r.id,
  name: r.name || "",
  email: r.email,
  degree: r.degree || "",
  universityId: r.university_id || "",
  status: r.status,
  paid: r.paid,
  currentStep: r.current_step,
  source: r.source,
  country: r.country || "",
  signupCountry: r.signup_country || "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  assignedTo: r.assigned_id ? { id: r.assigned_id, name: r.assigned_name } : null,
});

const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  // A cell starting with = + - @ can be run as a formula by spreadsheet programs: defuse it.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Students and applications: list, detail, status, assignment, notes, documents, export, overview. */
export function mountStudents(router, { db, fileKey }) {
  const view = requireAdmin(db, { permission: "students.view" });
  const manage = requireAdmin(db, { permission: "students.manage" });

  /** The application, only if this admin's scope includes it (otherwise "not found": no hint it exists). */
  async function applicationFor(admin, id) {
    const w = whereFor(admin);
    const params = [...w.params, String(id)];
    const { rows } = await db.query(
      `SELECT a.*, u.email AS user_email, u.created_at AS user_created_at, u.last_login_at, u.signup_source, u.signup_country,
              ad.id AS assigned_id, coalesce(nullif(ad.full_name,''), ad.email) AS assigned_name
       ${FROM} ${w.sql ? `${w.sql} AND` : "WHERE"} a.id = $${params.length}`,
      params,
    );
    if (!rows[0]) throw httpError(404, "Student not found.");
    return rows[0];
  }
  async function documentFor(admin, id) {
    if (!UUID_RE.test(String(id))) throw httpError(404, "Document not found.");
    const { rows } = await db.query(
      `SELECT d.id, d.user_id, d.filename, d.category FROM documents d
       WHERE d.id = $1 AND ($2::boolean OR EXISTS (SELECT 1 FROM applications a WHERE a.user_id = d.user_id AND a.assigned_admin_id = $3))`,
      [id, seesAll(admin), admin.id],
    );
    if (!rows[0]) throw httpError(404, "Document not found.");
    return rows[0];
  }

  // ----- overview numbers -----
  router.get(
    "/overview",
    view,
    safe(async (req, res) => {
      const w = whereFor(req.admin);
      const base = `${FROM} ${w.sql}`;
      const totals = (
        await db.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE a.paid_at IS NOT NULL)::int AS paid,
                  count(*) FILTER (WHERE a.created_at > now() - interval '7 days')::int AS new7,
                  count(*) FILTER (WHERE a.created_at > now() - interval '30 days')::int AS new30,
                  ${APPLICATION_STATUSES.map((s) => `count(*) FILTER (WHERE a.status = '${s}')::int AS ${s}`).join(", ")}
           ${base}`,
          w.params,
        )
      ).rows[0];
      const top = async (expr) =>
        (
          await db.query(
            `SELECT ${expr} AS value, count(*)::int AS count ${base} ${w.sql ? "AND" : "WHERE"} ${expr} IS NOT NULL AND ${expr} <> '' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8`,
            w.params,
          )
        ).rows;
      const days = (
        await db.query(
          `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(c.n, 0)::int AS count
           FROM generate_series(current_date - 29, current_date, interval '1 day') d
           LEFT JOIN (SELECT a.created_at::date AS day, count(*) AS n ${base} GROUP BY 1) c ON c.day = d::date
           ORDER BY 1`,
          w.params,
        )
      ).rows;
      res.json({
        totals,
        bySource: await top(SOURCE_LABEL_SQL),
        byCountry: await top("a.form->>'citizenshipCountry'"),
        byDegree: await top("a.form->>'degree'"),
        byUniversity: await top("a.form->>'universityId'"),
        perDay: days,
        scope: req.admin.role_scope,
      });
    }),
  );

  // ----- list -----
  router.get(
    "/students",
    view,
    safe(async (req, res) => {
      const w = whereFor(req.admin, req.query);
      const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 25));
      const page = Math.max(1, Number(req.query.page) || 1);
      const order = req.query.sort === "created" ? "a.created_at" : "a.updated_at";
      const total = (await db.query(`SELECT count(*)::int AS n ${FROM} ${w.sql}`, w.params)).rows[0].n;
      const { rows } = await db.query(
        `SELECT ${LIST_COLUMNS} ${FROM} ${w.sql} ORDER BY ${order} DESC, a.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        w.params,
      );
      // Filter choices come from everything this admin may see, so choosing one never empties the others.
      const scope = whereFor(req.admin);
      const facet = async (expr) =>
        (
          await db.query(
            `SELECT ${expr} AS value, count(*)::int AS count ${FROM} ${scope.sql} ${scope.sql ? "AND" : "WHERE"} ${expr} IS NOT NULL AND ${expr} <> '' GROUP BY 1 ORDER BY 2 DESC, 1`,
            scope.params,
          )
        ).rows;
      const assignable = seesAll(req.admin)
        ? (
            await db.query(
              `SELECT a.id, coalesce(nullif(a.full_name,''), a.email) AS name FROM admin_users a JOIN admin_roles r ON r.id = a.role_id
               WHERE a.status = 'active' AND ('*' = ANY(r.permissions) OR 'students.view' = ANY(r.permissions)) ORDER BY 2`,
            )
          ).rows
        : [];
      res.json({
        items: rows.map(publicRow),
        total,
        page,
        pageSize,
        facets: {
          status: await facet("a.status"),
          degree: await facet("a.form->>'degree'"),
          university: await facet("a.form->>'universityId'"),
          source: await facet(SOURCE_LABEL_SQL),
          country: await facet("a.form->>'citizenshipCountry'"),
        },
        assignable,
      });
    }),
  );

  router.get(
    "/students/export.csv",
    view,
    safe(async (req, res) => {
      const w = whereFor(req.admin, req.query);
      const { rows } = await db.query(
        `SELECT ${LIST_COLUMNS}, u.signup_source->>'utm_campaign' AS campaign ${FROM} ${w.sql} ORDER BY a.created_at DESC LIMIT 5000`,
        w.params,
      );
      const header = ["Application", "Name", "Email", "Degree", "University", "Status", "Paid", "Step", "Source", "Campaign", "Passport country", "Sign-up country", "Created", "Updated", "Assigned to"];
      const lines = [header, ...rows.map((r) => [r.id, r.name, r.email, r.degree, r.university_id, r.status, r.paid ? "yes" : "no", r.current_step, r.source, r.campaign, r.country, r.signup_country, r.created_at?.toISOString?.() ?? r.created_at, r.updated_at?.toISOString?.() ?? r.updated_at, r.assigned_name])];
      await logAdmin(db, req.admin, "students_exported", null, { rows: rows.length }, req);
      res
        .set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="studybg-students.csv"' })
        .send("﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n"));
    }),
  );

  // ----- documents (before /students/:id so the paths don't collide) -----
  router.get(
    "/students/documents/:docId/file",
    view,
    safe(async (req, res) => {
      const doc = await documentFor(req.admin, req.params.docId);
      if (!fileKey) throw httpError(503, "Document access is unavailable.");
      const d = await getDocumentWithContent(db, doc.user_id, doc.id);
      const bytes = decryptFile(fileKey, { iv: d.iv, authTag: d.auth_tag, content: d.content }, { userId: d.user_id, documentId: d.id });
      await logAdmin(db, req.admin, "document_viewed", `document:${d.id}`, { category: d.category }, req);
      res
        .set({ "Content-Type": d.mime_type, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" })
        .send(bytes);
    }),
  );

  router.post(
    "/students/documents/:docId/review",
    manage,
    safe(async (req, res) => {
      const doc = await documentFor(req.admin, req.params.docId);
      const status = req.body?.status;
      const note = cleanNote(req.body?.note);
      if (!DOCUMENT_REVIEW_STATUSES.includes(status) || !note) throw httpError(400, "Choose a document status and add a review note.");
      await transaction(db, async (c) => {
        const { rows } = await c.query("SELECT d.*, u.email FROM documents d JOIN users u ON u.id = d.user_id WHERE d.id = $1 FOR UPDATE OF d", [doc.id]);
        const d = rows[0];
        await c.query("UPDATE documents SET status = $2, review_note = $3, reviewed_at = now() WHERE id = $1", [d.id, status, note]);
        await logActivity(c, d.user_id, `document_${status}`, `${d.filename}: ${note}`);
        await enqueueNotice(c, d.user_id, d.email);
      });
      await logAdmin(db, req.admin, "document_review", `document:${doc.id}`, { status }, req);
      res.json({ ok: true });
    }),
  );

  // ----- one student -----
  router.get(
    "/students/:id",
    view,
    safe(async (req, res) => {
      const row = await applicationFor(req.admin, req.params.id);
      const [docs, activity, notes, invoice] = await Promise.all([
        db.query("SELECT id, category, filename, status, review_note, size_bytes, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC", [row.user_id]),
        db.query("SELECT type, detail, created_at FROM activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 60", [row.user_id]),
        db.query("SELECT id, admin_email, note, created_at FROM student_notes WHERE application_id = $1 ORDER BY created_at DESC LIMIT 100", [row.id]),
        row.payment_intent_id
          ? db.query("SELECT invoice_number FROM invoices WHERE payment_intent_id = $1", [row.payment_intent_id])
          : Promise.resolve({ rows: [] }),
      ]);
      await logAdmin(db, req.admin, "student_viewed", `application:${row.id}`, {}, req);
      res.json({
        application: describeApplication(row),
        student: {
          email: row.user_email,
          createdAt: row.user_created_at,
          lastLoginAt: row.last_login_at,
          source: row.signup_source || {},
          signupCountry: row.signup_country || "",
        },
        invoiceNumber: invoice.rows[0]?.invoice_number ? String(invoice.rows[0].invoice_number) : null,
        documents: docs.rows.map((d) => ({
          id: d.id,
          category: d.category,
          categoryLabel: DOCUMENT_CATEGORIES[d.category] || d.category,
          filename: d.filename,
          status: d.status,
          reviewNote: d.review_note,
          sizeBytes: d.size_bytes,
          createdAt: d.created_at,
        })),
        activity: activity.rows,
        notes: notes.rows,
        assignedTo: row.assigned_id ? { id: row.assigned_id, name: row.assigned_name } : null,
      });
    }),
  );

  router.post(
    "/students/:id/status",
    manage,
    safe(async (req, res) => {
      const row = await applicationFor(req.admin, req.params.id);
      const status = req.body?.status;
      const note = cleanNote(req.body?.note);
      if (!REVIEW_STATUSES.includes(status) || !note) throw httpError(400, "Choose a review status and add a note.");
      await transaction(db, async (c) => {
        const { rows } = await c.query("SELECT * FROM applications WHERE id = $1 FOR UPDATE", [row.id]);
        if (!rows[0].paid_at) throw httpError(409, "The application has not completed payment.");
        await c.query("UPDATE applications SET status = $2, updated_at = now() WHERE id = $1", [row.id, status]);
        await logActivity(c, row.user_id, `application_${status}`, note);
        await enqueueNotice(c, row.user_id, rows[0].form.email);
      });
      await logAdmin(db, req.admin, "student_status", `application:${row.id}`, { status }, req);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/students/:id/assign",
    manage,
    safe(async (req, res) => {
      if (!seesAll(req.admin)) throw httpError(403, "Your role can't assign students.");
      const row = await applicationFor(req.admin, req.params.id);
      const target = req.body?.adminId ?? null;
      if (target !== null) {
        if (!UUID_RE.test(String(target))) throw httpError(400, "Choose a person from the list.");
        const ok = await db.query(
          `SELECT 1 FROM admin_users a JOIN admin_roles r ON r.id = a.role_id
           WHERE a.id = $1 AND a.status = 'active' AND ('*' = ANY(r.permissions) OR 'students.view' = ANY(r.permissions))`,
          [target],
        );
        if (!ok.rows[0]) throw httpError(400, "That person can't be assigned students.");
      }
      await db.query("UPDATE applications SET assigned_admin_id = $2 WHERE id = $1", [row.id, target]);
      await logAdmin(db, req.admin, "student_assigned", `application:${row.id}`, { to: target }, req);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/students/:id/notes",
    manage,
    safe(async (req, res) => {
      const row = await applicationFor(req.admin, req.params.id);
      const note = cleanNote(req.body?.note);
      if (!note) throw httpError(400, "Write a note first.");
      await db.query("INSERT INTO student_notes (application_id, admin_id, admin_email, note) VALUES ($1,$2,$3,$4)", [row.id, req.admin.id, req.admin.email, note]);
      await logAdmin(db, req.admin, "student_note", `application:${row.id}`, {}, req);
      res.status(201).json({ ok: true });
    }),
  );
}
