import { Resend } from 'resend';

export function connectMail(apiKey) {
  return apiKey ? new Resend(apiKey) : null;
}

export async function sendReceiptEmail(resend, { from, to, buyerName, invoiceNumber, totalText, pdfBytes }) {
  await resend.emails.send({
    from,
    to,
    subject: `Your StudyBg receipt — Invoice ${invoiceNumber}`,
    html: `
      <p>Hi ${escapeHtml(buyerName)},</p>
      <p>Thank you for your payment of <strong>${escapeHtml(totalText)}</strong>. Your invoice/receipt
      <strong>${escapeHtml(invoiceNumber)}</strong> is attached as a PDF.</p>
      <p>We'll be in touch by email to confirm your consultation call time.</p>
      <p>— StudyBg</p>
    `,
    attachments: [{ filename: `StudyBg-Invoice-${invoiceNumber}.pdf`, content: Buffer.from(pdfBytes) }],
  });
}

export async function sendSaleNotification(resend, { from, to, buyerName, buyerEmail, totalText, invoiceNumber, applicant }) {
  await resend.emails.send({
    from,
    to,
    subject: `New sale: ${totalText} — ${buyerName}`,
    html: `
      <p>New onboarding fee payment received.</p>
      <ul>
        <li><strong>Amount:</strong> ${escapeHtml(totalText)}</li>
        <li><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</li>
        <li><strong>Applicant:</strong> ${escapeHtml(buyerName)} (${escapeHtml(buyerEmail)})</li>
        <li><strong>Degree / University:</strong> ${escapeHtml(applicant.degree)} at ${escapeHtml(applicant.university)}</li>
        <li><strong>Call requested:</strong> ${escapeHtml(applicant.callDate)}, ${escapeHtml(applicant.callWindow)}</li>
      </ul>
    `,
  });
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
