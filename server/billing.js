import { transaction, logActivity } from "./db.js";
import { renderInvoicePdf, formatMoney } from "./invoice.js";
import { sendReceiptEmail, sendSaleNotification, sendChecked } from "./mail.js";
import { ONBOARDING_FEE, PAYMENT_SOURCE } from "./pricing.js";

export async function recordPayment(db, intent, startNumber = 1) {
  if (
    intent.metadata?.source !== PAYMENT_SOURCE ||
    intent.status !== "succeeded" ||
    intent.amount !== ONBOARDING_FEE.amount ||
    intent.currency !== ONBOARDING_FEE.currency
  )
    throw new Error("Unexpected payment amount, currency or status.");
  const email = intent.metadata?.applicant_email;
  if (!email) throw new Error("Payment is missing the applicant email.");
  return transaction(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "invoice:" + intent.id,
    ]);
    const { rows } = await c.query(
      "SELECT * FROM invoices WHERE payment_intent_id=$1",
      [intent.id],
    );
    const result = await c.query(
      "UPDATE applications SET paid_at=coalesce(paid_at,now()),status='submitted',updated_at=now() WHERE id=$1 AND payment_intent_id=$2 AND form->>'email'=$3 AND paid_at IS NULL RETURNING user_id",
      [intent.metadata.application_id, intent.id, email],
    );
    if (result.rows[0])
      await logActivity(
        c,
        result.rows[0].user_id,
        "payment_received",
        "Onboarding fee received; application submitted for review.",
      );
    if (rows[0]) return rows[0];
    await c.query(
      "INSERT INTO invoice_counter(id,last_number) VALUES(1,$1) ON CONFLICT DO NOTHING",
      [Math.max(0, startNumber - 1)],
    );
    const number = await c.query(
      "UPDATE invoice_counter SET last_number=last_number+1 WHERE id=1 RETURNING last_number",
    );
    const invoice = await c.query(
      "INSERT INTO invoices(payment_intent_id,invoice_number,issued_at,buyer_email,payload) VALUES($1,$2,now(),$3,$4) RETURNING *",
      [intent.id, number.rows[0].last_number, email, { intent }],
    );
    for (const kind of ["receipt", "sale"])
      await c.query(
        "INSERT INTO email_outbox(id,kind,payload) VALUES($1,$2,$3)",
        [`${kind}:${intent.id}`, kind, { paymentIntentId: intent.id }],
      );
    return invoice.rows[0];
  });
}
async function preparedInvoice(db, id, billing) {
  return transaction(db, async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM invoices WHERE payment_intent_id=$1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error("Invoice not found.");
    if (row.pdf) return row;
    const i = row.payload.intent,
      number = String(row.invoice_number).padStart(10, "0");
    const pdf = await renderInvoicePdf({
      invoiceNumber: number,
      issueDate: new Date(row.issued_at),
      seller: billing.seller,
      buyer: { name: i.metadata.applicant_name, email: row.buyer_email },
      description: i.description || "StudyBg onboarding",
      amountMinor: i.amount,
      currency: i.currency,
      paymentRef: i.id,
    });
    const payload = {
      ...row.payload,
      seller: billing.seller,
      fromEmail: billing.fromEmail,
      saleNotifyEmail: billing.saleNotifyEmail,
    };
    const updated = await c.query(
      "UPDATE invoices SET pdf=$2,payload=$3 WHERE payment_intent_id=$1 RETURNING *",
      [id, Buffer.from(pdf), payload],
    );
    return updated.rows[0];
  });
}
export async function processOutbox(
  db,
  billing,
  { limit = 10, log = console.log } = {},
) {
  if (
    !db ||
    !billing?.resend ||
    !billing?.fromEmail ||
    !billing?.seller ||
    !billing?.saleNotifyEmail
  )
    return;
  const { rows: pending } = await db.query(
    "SELECT id FROM email_outbox WHERE state='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT $1",
    [limit],
  );
  for (const { id } of pending) {
    const c = await db.connect();
    let locked = false;
    try {
      const lock = await c.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",
        ["outbox:" + id],
      );
      locked = lock.rows[0].locked;
      if (!locked) continue;
      const { rows } = await c.query("SELECT * FROM email_outbox WHERE id=$1", [
        id,
      ]);
      const job = rows[0];
      if (job.state !== "pending" || new Date(job.next_attempt_at) > new Date())
        continue;
      // Provider idempotency is time-limited. An ambiguous old attempt needs human reconciliation.
      if (
        job.first_attempt_at &&
        Date.now() - new Date(job.first_attempt_at).getTime() > 23 * 3600_000
      ) {
        await c.query(
          "UPDATE email_outbox SET state='needs_review',last_error='Idempotency window elapsed; reconcile provider delivery before retrying.' WHERE id=$1",
          [id],
        );
        continue;
      }
      await c.query(
        "UPDATE email_outbox SET first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 WHERE id=$1",
        [id],
      );
      let providerId;
      if (job.kind === "status_notice")
        providerId = await sendChecked(
          billing.resend,
          {
            from: billing.fromEmail,
            to: job.payload.email,
            subject: "Your StudyBg application has an update",
            html: '<p>Your application or document review has been updated.</p><p><a href="https://studybg.ac/#/account">Sign in to view the update</a>.</p>',
          },
          id,
        );
      else {
        const inv = await preparedInvoice(
            db,
            job.payload.paymentIntentId,
            billing,
          ),
          i = inv.payload.intent;
        const common = {
          from: inv.payload.fromEmail,
          buyerName: i.metadata.applicant_name,
          invoiceNumber: String(inv.invoice_number).padStart(10, "0"),
          totalText: formatMoney(i.amount, i.currency),
          idempotencyKey: id,
        };
        if (job.kind === "receipt")
          providerId = await sendReceiptEmail(billing.resend, {
            ...common,
            to: inv.buyer_email,
            pdfBytes: inv.pdf,
          });
        else
          providerId = await sendSaleNotification(billing.resend, {
            ...common,
            to: inv.payload.saleNotifyEmail,
            buyerEmail: inv.buyer_email,
            applicant: {
              degree: i.metadata.degree,
              university: i.metadata.university,
              callDate: i.metadata.call_date,
              callWindow: i.metadata.call_window,
            },
          });
      }
      await c.query(
        "UPDATE email_outbox SET state='accepted',provider_id=$2,sent_at=now(),last_error=NULL WHERE id=$1",
        [id, providerId],
      );
    } catch (error) {
      await c.query(
        "UPDATE email_outbox SET last_error=$2,next_attempt_at=now()+interval '2 minutes' WHERE id=$1",
        [id, String(error.message).slice(0, 500)],
      );
      log(`email job failed: ${id}`);
    } finally {
      if (locked)
        await c.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
          "outbox:" + id,
        ]);
      c.release();
    }
  }
}
