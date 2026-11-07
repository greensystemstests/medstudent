// The legal entity that runs StudyBg and charges the fee. These are public facts (they appear on the
// legal pages and on every invoice), so they live in code; any value can still be overridden with an
// environment variable (COMPANY_*), which is how tests and a future company change are handled.
export const COMPANY_DEFAULTS = Object.freeze({
  name: "Plasma Ltd",
  companyNumber: "27293939", // IČO
  vatNumber: "CZ27293939", // DIČ
  address: "Sládka 1113/3",
  postcode: "415 01",
  city: "Teplice",
  country: "Czech Republic",
  registerNote: "", // e.g. "Registered in the Commercial Register kept by the Regional Court in Ústí nad Labem, file C 12345"
});

export const SUPPORT_EMAIL_DEFAULT = "study.eu.guide@gmail.com";
export const SALE_NOTIFICATION_EMAIL_DEFAULT = "study.eu.guide@gmail.com";
export const INVOICE_FROM_DEFAULT = "StudyBg <hello@studybg.ac>";
/** Booking page for the consultation call. Only ever handed to the signed-in owner of a PAID application. */
export const BOOKING_URL_DEFAULT = "https://calendly.com/study-eu-guide/30min";
/** Czech standard VAT rate. The €180 fee is VAT-inclusive; net and VAT are derived from it. */
export const VAT_RATE = 0.21;
