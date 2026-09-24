/**
 * Legal identity shown on the Privacy Policy, Terms & Conditions and GDPR pages.
 *
 * ⚠️ Replace every [bracketed] value with the real details of the company that runs StudyBg
 * before the site goes live. These must match the company's registration in the Bulgarian
 * Commercial Register (and the COMPANY_* values used on invoices).
 */
export const LEGAL_ENTITY = {
  name: '[Company legal name, e.g. StudyBg EOOD]',
  eik: '[ЕИК / UIC number]',
  vatNumber: '', // e.g. 'BG123456789'; leave empty if not VAT-registered
  address: '[Registered office address], Sofia, Bulgaria',
  /** Where privacy and data-protection requests go. Must be a monitored inbox. */
  privacyEmail: '[privacy@your-domain]',
  /** General contact for orders, complaints and withdrawals. */
  contactEmail: '[contact@your-domain]',
  website: 'https://studybg.ac',
};

/** Shown at the top of each legal page. Update whenever the text changes. */
export const LEGAL_LAST_UPDATED = '24 September 2026';

export const hasRealEmail = (value: string) => /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(value);
