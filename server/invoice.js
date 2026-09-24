import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REGULAR_FONT = fs.readFileSync(path.join(HERE, 'fonts', 'DejaVuSans.ttf'));
const BOLD_FONT = fs.readFileSync(path.join(HERE, 'fonts', 'DejaVuSans-Bold.ttf'));

const BRAND_GREEN = rgb(0 / 255, 102 / 255, 68 / 255);
const INK = rgb(0.06, 0.11, 0.19);
const MUTED = rgb(0.4, 0.46, 0.55);
const LINE = rgb(0.85, 0.88, 0.92);

const VAT_RATE = 0.2; // Bulgaria standard rate, only used when the seller is VAT-registered.

export const formatMoney = (amountMinor, currency = 'eur') =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency.toUpperCase() }).format(amountMinor / 100);

/** Splits a gross (VAT-inclusive) amount into net + VAT. Net + VAT always sums back to the gross. */
export function computeVat(amountMinor, vatRegistered) {
  if (!vatRegistered) return { netMinor: amountMinor, vatMinor: 0 };
  const netMinor = Math.round(amountMinor / (1 + VAT_RATE));
  return { netMinor, vatMinor: amountMinor - netMinor };
}

/**
 * Reads seller/company details from the environment. Every field is required to appear on a
 * valid Bulgarian invoice, and none of it can be guessed — it must be set in Render.
 * @returns {{ name: string, eik: string, address: string, city: string, vatNumber: string } | null}
 *   null when the required fields are missing, so callers can skip invoicing instead of
 *   emailing out a legally invalid document.
 */
export function sellerFromEnv(env) {
  const name = (env.COMPANY_LEGAL_NAME || '').trim();
  const eik = (env.COMPANY_EIK || '').trim();
  const address = (env.COMPANY_ADDRESS || '').trim();
  const city = (env.COMPANY_CITY || '').trim();
  if (!name || !eik || !address || !city) return null;
  return { name, eik, address, city, vatNumber: (env.COMPANY_VAT_NUMBER || '').trim() };
}

/**
 * Renders a two-language (Bulgarian / English) invoice-receipt PDF for one onboarding fee
 * payment. This mirrors common Bulgarian invoicing software output, but it is not a certified
 * accounting document: have a Bulgarian accountant confirm it fits your specific registration
 * (VAT status, any e-invoicing/SAF-T obligations) before relying on it for filing.
 *
 * @param {object} p
 * @param {string} p.invoiceNumber  Zero-padded sequential number, e.g. "0000000001".
 * @param {Date}   p.issueDate
 * @param {ReturnType<typeof sellerFromEnv>} p.seller
 * @param {{ name: string, email: string }} p.buyer
 * @param {string} p.description
 * @param {number} p.amountMinor   Gross (VAT-inclusive, if applicable) amount in cents.
 * @param {string} p.currency      ISO 4217, e.g. "eur".
 * @param {string} p.paymentRef
 * @returns {Promise<Uint8Array>}
 */
export async function renderInvoicePdf({ invoiceNumber, issueDate, seller, buyer, description, amountMinor, currency, paymentRef }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(REGULAR_FONT, { subset: true });
  const bold = await doc.embedFont(BOLD_FONT, { subset: true });

  const page = doc.addPage([595.28, 841.89]); // A4
  const M = 50;
  let y = 800;

  const money = (minor) => formatMoney(minor, currency);
  const text = (str, x, yy, { font = regular, size = 10, color = INK } = {}) => page.drawText(str, { x, y: yy, size, font, color });
  const rule = (yy) => page.drawLine({ start: { x: M, y: yy }, end: { x: 595.28 - M, y: yy }, thickness: 1, color: LINE });

  // Header
  text('StudyBg', M, y, { font: bold, size: 20, color: BRAND_GREEN });
  text('ИНВОЙС / INVOICE', 595.28 - M - 150, y + 4, { font: bold, size: 14 });
  y -= 20;
  text(`№ ${invoiceNumber}`, 595.28 - M - 150, y, { font: bold, size: 12 });
  y -= 32;
  const issued = issueDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  text(`Дата на издаване / Date of issue: ${issued}`, M, y, { size: 9, color: MUTED });
  text(`Дата на плащане / Date of payment: ${issued}`, 595.28 - M - 230, y, { size: 9, color: MUTED });
  y -= 10;
  rule(y);
  y -= 26;

  // Seller / Buyer
  const colWidth = 240;
  const leftX = M;
  const rightX = M + colWidth + 20;
  text('ДОСТАВЧИК / SUPPLIER', leftX, y, { font: bold, size: 9, color: MUTED });
  text('ПОЛУЧАТЕЛ / CUSTOMER', rightX, y, { font: bold, size: 9, color: MUTED });
  y -= 16;
  const sellerLines = [
    seller.name,
    `ЕИК/Bulstat: ${seller.eik}`,
    ...(seller.vatNumber ? [`ДДС №/VAT No: ${seller.vatNumber}`] : []),
    seller.address,
    `${seller.city}, Bulgaria`,
  ];
  const buyerLines = [buyer.name, buyer.email];
  const rows = Math.max(sellerLines.length, buyerLines.length);
  for (let i = 0; i < rows; i++) {
    if (sellerLines[i]) text(sellerLines[i], leftX, y, { size: 10, font: i === 0 ? bold : regular });
    if (buyerLines[i]) text(buyerLines[i], rightX, y, { size: 10, font: i === 0 ? bold : regular });
    y -= 15;
  }
  y -= 12;
  rule(y);
  y -= 26;

  // Line item table
  text('ОПИСАНИЕ / DESCRIPTION', leftX, y, { font: bold, size: 9, color: MUTED });
  text('КОЛ. / QTY', leftX + 300, y, { font: bold, size: 9, color: MUTED });
  text('ЦЕНА / PRICE', 595.28 - M - 90, y, { font: bold, size: 9, color: MUTED });
  y -= 18;

  const vatRegistered = Boolean(seller.vatNumber);
  const { netMinor, vatMinor } = computeVat(amountMinor, vatRegistered);

  text(description, leftX, y, { size: 10 });
  text('1', leftX + 300, y, { size: 10 });
  text(money(vatRegistered ? netMinor : amountMinor), 595.28 - M - 90, y, { size: 10 });
  y -= 24;
  rule(y);
  y -= 20;

  // Totals
  const totalsX = 595.28 - M - 200;
  if (vatRegistered) {
    text('Данъчна основа / Net amount:', totalsX, y, { size: 10, color: MUTED });
    text(money(netMinor), 595.28 - M - 70, y, { size: 10 });
    y -= 16;
    text(`ДДС / VAT (${Math.round(VAT_RATE * 100)}%):`, totalsX, y, { size: 10, color: MUTED });
    text(money(vatMinor), 595.28 - M - 70, y, { size: 10 });
    y -= 18;
  }
  text('ОБЩО / TOTAL:', totalsX, y, { font: bold, size: 12 });
  text(money(amountMinor), 595.28 - M - 80, y, { font: bold, size: 12, color: BRAND_GREEN });
  y -= 30;

  if (!vatRegistered) {
    text(
      'ДДС не е начислено на основание чл. 113, ал. 9 от ЗДДС (доставчикът не е регистриран по ЗДДС).',
      M,
      y,
      { size: 8, color: MUTED },
    );
    y -= 11;
    text('VAT not charged: supplier is not registered for VAT purposes (Art. 113(9) of the Bulgarian VAT Act).', M, y, {
      size: 8,
      color: MUTED,
    });
    y -= 22;
  }

  // Payment details
  rule(y);
  y -= 20;
  text('НАЧИН НА ПЛАЩАНЕ / PAYMENT METHOD', M, y, { font: bold, size: 9, color: MUTED });
  y -= 15;
  text('Дебитна/кредитна карта чрез Stripe / Card payment via Stripe', M, y, { size: 10 });
  y -= 15;
  text(`Референция / Reference: ${paymentRef}`, M, y, { size: 10, color: MUTED });
  y -= 30;

  text(
    'Този документ е генериран автоматично и удостоверява плащане, получено онлайн.',
    M,
    60,
    { size: 8, color: MUTED },
  );
  text('This document is generated automatically and evidences a payment received online.', M, 48, {
    size: 8,
    color: MUTED,
  });

  return doc.save();
}
