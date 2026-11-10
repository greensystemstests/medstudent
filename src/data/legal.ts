/**
 * Legal identity shown on the Privacy Policy, Terms & Conditions and GDPR pages and in the footer.
 * It must match the company's entry in the Czech Commercial Register and the seller details the API
 * puts on invoices (server/company.ts defaults / COMPANY_* settings).
 */
export const LEGAL_ENTITY = {
  name: 'Plasma Ltd',
  /** Company number (IČO) in the Czech Republic. */
  companyNumber: '27293939',
  /** VAT number (DIČ). Leave empty if the company is not VAT-registered. */
  vatNumber: 'CZ27293939',
  address: 'Sládka 1113/3, 415 01 Teplice, Czech Republic',
  /** Court and file number, e.g. "Regional Court in Ústí nad Labem, file C 12345". Shown only when filled in. */
  registerNote: '',
  /** Where privacy and data-protection requests go. Must be a monitored inbox. */
  privacyEmail: 'study.eu.guide@gmail.com',
  /** General contact for orders, complaints and withdrawals. */
  contactEmail: 'study.eu.guide@gmail.com',
  website: 'https://studybg.ac',
};

/** Shown at the top of each legal page. Update whenever the text changes. */
export const LEGAL_LAST_UPDATED = '7 November 2026';

export const hasRealEmail = (value: string) => /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(value);

/** True while a field still holds its [bracketed] setup placeholder. */
export const isPlaceholder = (value: string) => value.includes('[');

/** What visitors see instead of a setup placeholder, so raw developer text never reaches customers. */
export const PENDING_DETAIL = 'to be published before we accept payments';

export const shown = (value: string) => (isPlaceholder(value) ? PENDING_DETAIL : value);
