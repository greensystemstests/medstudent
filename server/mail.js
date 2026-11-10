import { Buffer } from 'node:buffer';
import { Resend } from 'resend';

export function connectMail(apiKey) {
  return apiKey ? new Resend(apiKey) : null;
}

export async function sendReceiptEmail(resend, { from, replyTo, to, buyerName, invoiceNumber, totalText, pdfBytes, bookingUrl, idempotencyKey }) {
  return sendChecked(resend, {
    from,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: `Your StudyBg receipt — Invoice ${invoiceNumber}`,
    html: `
      <p>Hi ${escapeHtml(buyerName)},</p>
      <p>Thank you for your payment of <strong>${escapeHtml(totalText)}</strong>. Your invoice/receipt
      <strong>${escapeHtml(invoiceNumber)}</strong> is attached as a PDF.</p>
      ${bookingUrl ? `<p><a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#006644;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Book your 30-minute call</a></p>
      <p style="color:#64748b;font-size:13px">You can also book from your StudyBg account at any time.</p>` : ''}
      <p>— StudyBg</p>
    `,
    attachments: [{ filename: `StudyBg-Invoice-${invoiceNumber}.pdf`, content: Buffer.from(pdfBytes) }],
  }, idempotencyKey);
}

export async function sendSaleNotification(resend, { from, replyTo, to, buyerName, buyerEmail, totalText, invoiceNumber, applicant, idempotencyKey }) {
  return sendChecked(resend, {
    from,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: `New sale: ${totalText} — ${buyerName}`,
    html: `
      <p>New onboarding fee payment received.</p>
      <ul>
        <li><strong>Amount:</strong> ${escapeHtml(totalText)}</li>
        <li><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</li>
        <li><strong>Applicant:</strong> ${escapeHtml(buyerName)} (${escapeHtml(buyerEmail)})</li>
        <li><strong>Degree / University:</strong> ${escapeHtml(applicant.degree)} at ${escapeHtml(applicant.university)}</li>
      </ul>
    `,
  }, idempotencyKey);
}

export async function sendLoginCodeEmail(resend, { from, replyTo, to, code, siteUrl }) {
  return sendChecked(resend, {
    from,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: `${code} is your StudyBg sign-in code`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0b1c30">
        <p style="font-size:20px;font-weight:700;color:#006644;margin:0 0 16px">StudyBg</p>
        <p>Use this code to sign in to your StudyBg account:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${escapeHtml(code)}</p>
        <p style="color:#64748b;font-size:13px">It expires in 10 minutes. If you didn't ask for it, you can ignore this email; nobody can sign in without the code.</p>
        <p style="font-size:13px"><a href="${escapeHtml(siteUrl)}/account/" style="color:#006644">Open my account</a></p>
      </div>
    `,
  });
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function sendChecked(resend, payload, idempotencyKey) {
  const result = await resend.emails.send(payload, idempotencyKey ? { idempotencyKey } : undefined);
  if (result?.error || !result?.data?.id) throw new Error(result?.error?.message || 'Email provider did not confirm acceptance.');
  return result.data.id;
}
