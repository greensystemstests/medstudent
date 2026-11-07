import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readAsset } from './assets.js';
import { COMPANY_DEFAULTS, VAT_RATE } from './company.js';

const BRAND_GREEN = rgb(0 / 255, 102 / 255, 68 / 255);
const INK = rgb(0.06, 0.11, 0.19);
const MUTED = rgb(0.4, 0.46, 0.55);
const LINE = rgb(0.85, 0.88, 0.92);

export const formatMoney = (amountMinor, currency = 'eur') =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency.toUpperCase() }).format(amountMinor / 100);

/** Splits a gross (VAT-inclusive) amount into net + VAT. Net + VAT always sums back to the gross. */
export function computeVat(amountMinor, vatRegistered = true) {
  if (!vatRegistered) return { netMinor: amountMinor, vatMinor: 0 };
  const netMinor = Math.round(amountMinor / (1 + VAT_RATE));
  return { netMinor, vatMinor: amountMinor - netMinor };
}

/**
 * Seller details: the company defaults in company.js, overridable with COMPANY_* environment variables.
 * @returns {{ name: string, companyNumber: string, vatNumber: string, address: string, postcode: string, city: string, country: string, registerNote: string } | null}
 *   null only when an override blanks a required field, so callers skip invoicing instead of
 *   emailing out an invalid document.
 */
export function sellerFromEnv(env = {}) {
  const pick = (key, fallback) => (env[key] === undefined ? fallback : String(env[key]).trim());
  const seller = {
    name: pick('COMPANY_LEGAL_NAME', COMPANY_DEFAULTS.name),
    companyNumber: pick('COMPANY_NUMBER', pick('COMPANY_EIK', COMPANY_DEFAULTS.companyNumber)),
    vatNumber: pick('COMPANY_VAT_NUMBER', COMPANY_DEFAULTS.vatNumber),
    address: pick('COMPANY_ADDRESS', COMPANY_DEFAULTS.address),
    postcode: pick('COMPANY_POSTCODE', COMPANY_DEFAULTS.postcode),
    city: pick('COMPANY_CITY', COMPANY_DEFAULTS.city),
    country: pick('COMPANY_COUNTRY', COMPANY_DEFAULTS.country),
    registerNote: pick('COMPANY_REGISTER_NOTE', COMPANY_DEFAULTS.registerNote),
  };
  if (!seller.name || !seller.companyNumber || !seller.address || !seller.city) return null;
  return seller;
}

/**
 * Daily EUR→CZK reference rate published by the Czech National Bank (ČNB). Czech VAT law requires the
 * VAT amount of an invoice in another currency to be stated in CZK as well.
 * @returns {Promise<{ rate: number, date: string }>}  rate = CZK per 1 EUR; date = the day the rate applies to (YYYY-MM-DD)
 */
export async function fetchCnbEurRate(date = new Date(), fetchImpl = fetch) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const url = `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${dd}.${mm}.${date.getUTCFullYear()}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ČNB rate request failed (${res.status}).`);
  const text = await res.text();
  const header = text.split('\n')[0] || '';
  const day = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(header);
  const line = text.split('\n').find((l) => l.split('|')[3] === 'EUR');
  const parts = line?.split('|');
  const rate = parts ? Number(parts[4].replace(',', '.')) / Number(parts[2]) : NaN;
  if (!day || !Number.isFinite(rate) || rate <= 0) throw new Error('ČNB rate response was not understood.');
  return { rate, date: `${day[3]}-${day[2]}-${day[1]}` };
}

/**
 * Renders a two-language (Czech / English) invoice and tax document for one onboarding fee payment,
 * with the VAT-inclusive price split into net + VAT. It is issued when the money is received, so the
 * date of taxable supply is the payment date. It is generated software output, not a certified
 * accounting document: have your accountant confirm it fits your VAT registration before filing.
 *
 * @param {object} p
 * @param {string} p.invoiceNumber  Zero-padded sequential number, e.g. "0000000001".
 * @param {Date}   p.issueDate
 * @param {NonNullable<ReturnType<typeof sellerFromEnv>>} p.seller
 * @param {{ name: string, email: string }} p.buyer
 * @param {string} p.description
 * @param {number} p.amountMinor   Gross (VAT-inclusive) amount in cents.
 * @param {string} p.currency      ISO 4217, e.g. "eur".
 * @param {string} p.paymentRef
 * @param {{ rate: number, date: string } | null} [p.czkRate]  ČNB EUR→CZK rate, to state the VAT in CZK.
 * @returns {Promise<Uint8Array>}
 */
export async function renderInvoicePdf({ invoiceNumber, issueDate, seller, buyer, description, amountMinor, currency, paymentRef, czkRate = null }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(await readAsset('./fonts/DejaVuSans.ttf'), { subset: true });
  const bold = await doc.embedFont(await readAsset('./fonts/DejaVuSans-Bold.ttf'), { subset: true });

  const W = 595.28;
  const page = doc.addPage([W, 841.89]); // A4
  const M = 50;
  let y = 800;

  const money = (minor) => formatMoney(minor, currency);
  const text = (str, x, yy, { font = regular, size = 10, color = INK } = {}) => page.drawText(str, { x, y: yy, size, font, color });
  const right = (str, xRight, yy, opts = {}) => {
    const font = opts.font || regular;
    text(str, xRight - font.widthOfTextAtSize(str, opts.size || 10), yy, opts);
  };
  const rule = (yy) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 1, color: LINE });
  const date = (d) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Prague' });

  const { netMinor, vatMinor } = computeVat(amountMinor, Boolean(seller.vatNumber));
  const vatPercent = Math.round(VAT_RATE * 100);

  // Header
  text('StudyBg', M, y, { font: bold, size: 20, color: BRAND_GREEN });
  right('FAKTURA – DAŇOVÝ DOKLAD', W - M, y + 6, { font: bold, size: 12 });
  right('INVOICE – TAX DOCUMENT', W - M, y - 8, { font: bold, size: 10, color: MUTED });
  y -= 30;
  right(`č. / No. ${invoiceNumber}`, W - M, y, { font: bold, size: 12 });
  y -= 24;
  text(`Datum vystavení / Date of issue: ${date(issueDate)}`, M, y, { size: 9, color: MUTED });
  right(`DUZP / Taxable supply date: ${date(issueDate)}`, W - M, y, { size: 9, color: MUTED });
  y -= 13;
  text(`Uhrazeno / Paid: ${date(issueDate)}`, M, y, { size: 9, color: MUTED });
  y -= 12;
  rule(y);
  y -= 24;

  // Supplier / customer
  const rightX = M + 270;
  text('DODAVATEL / SUPPLIER', M, y, { font: bold, size: 9, color: MUTED });
  text('ODBĚRATEL / CUSTOMER', rightX, y, { font: bold, size: 9, color: MUTED });
  y -= 16;
  const sellerLines = [
    seller.name,
    seller.address,
    `${seller.postcode} ${seller.city}`.trim(),
    seller.country,
    `IČO / Company no.: ${seller.companyNumber}`,
    ...(seller.vatNumber ? [`DIČ / VAT no.: ${seller.vatNumber}`] : []),
  ];
  const buyerLines = [buyer.name, buyer.email];
  const rows = Math.max(sellerLines.length, buyerLines.length);
  for (let i = 0; i < rows; i++) {
    if (sellerLines[i]) text(sellerLines[i], M, y, { size: 10, font: i === 0 ? bold : regular });
    if (buyerLines[i]) text(buyerLines[i], rightX, y, { size: 10, font: i === 0 ? bold : regular });
    y -= 15;
  }
  if (seller.registerNote) {
    text(seller.registerNote, M, y, { size: 8, color: MUTED });
    y -= 14;
  }
  y -= 10;
  rule(y);
  y -= 24;

  // Line item
  const cDesc = M;
  const cNet = W - M - 250;
  const cRate = W - M - 150;
  const cVat = W - M - 90;
  text('POPIS / DESCRIPTION', cDesc, y, { font: bold, size: 8, color: MUTED });
  right('ZÁKLAD / NET', cNet + 60, y, { font: bold, size: 8, color: MUTED });
  right('DPH / VAT', cRate + 40, y, { font: bold, size: 8, color: MUTED });
  right('CELKEM / TOTAL', W - M, y, { font: bold, size: 8, color: MUTED });
  y -= 18;
  // The description wraps inside its own column so it never runs into the amounts.
  const descWidth = cNet - cDesc - 30;
  const descLines = [];
  let current = '';
  for (const word of description.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && regular.widthOfTextAtSize(next, 10) > descWidth) {
      descLines.push(current);
      current = word;
    } else current = next;
  }
  if (current) descLines.push(current);
  right(money(netMinor), cNet + 60, y);
  right(`${vatPercent} %`, cRate + 40, y);
  right(money(amountMinor), W - M, y);
  descLines.slice(0, 4).forEach((l, i) => text(l, cDesc, y - i * 13, { size: 10 }));
  y -= 13 * Math.min(descLines.length, 4) - 1;
  rule(y);
  y -= 22;

  // Totals
  const totalsX = W - M - 260;
  const line = (label, value, opts = {}) => {
    text(label, totalsX, y, { size: 10, color: MUTED, ...opts.label });
    right(value, W - M, y, opts.value);
    y -= 17;
  };
  line('Základ daně / Net amount', money(netMinor));
  line(`DPH ${vatPercent} % / VAT ${vatPercent}%`, money(vatMinor));
  if (czkRate && vatMinor > 0) {
    const vatCzk = (vatMinor / 100) * czkRate.rate;
    line(
      'DPH v Kč / VAT in CZK',
      new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(Math.round(vatCzk * 100) / 100),
    );
  }
  y -= 4;
  text('CELKEM / TOTAL PAID', totalsX, y, { font: bold, size: 11 });
  right(money(amountMinor), W - M, y, { font: bold, size: 13, color: BRAND_GREEN });
  y -= 22;
  if (czkRate && vatMinor > 0) {
    text(
      `Kurz ČNB / CNB exchange rate (${czkRate.date}): 1 EUR = ${czkRate.rate.toLocaleString('cs-CZ', { minimumFractionDigits: 3 })} CZK`,
      M,
      y,
      { size: 8, color: MUTED },
    );
    y -= 12;
  }
  text('Cena je uvedena včetně DPH. / The price includes VAT.', M, y, { size: 8, color: MUTED });
  y -= 24;

  // Payment details
  rule(y);
  y -= 20;
  text('ZPŮSOB ÚHRADY / PAYMENT METHOD', M, y, { font: bold, size: 9, color: MUTED });
  y -= 15;
  text('Platební karta přes Stripe / Card payment via Stripe', M, y, { size: 10 });
  y -= 15;
  text(`Reference / Reference: ${paymentRef}`, M, y, { size: 10, color: MUTED });

  text('Tento doklad byl vystaven elektronicky a potvrzuje platbu přijatou online.', M, 60, { size: 8, color: MUTED });
  text('This document was issued electronically and confirms a payment received online.', M, 48, { size: 8, color: MUTED });

  return doc.save();
}
