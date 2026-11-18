// How a student arrived (referring site and campaign tags) and an approximate country, kept with the
// account when it is created. The browser sends what it saw while the page was open (nothing is stored
// on the device for this); everything is cleaned and shortened here before it is saved.

const clip = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");
const tag = (v) => clip(v, 60).replace(/[^\w .+\-:/]/g, "");

/** Only the site's host from a referrer, never a path or query (they can carry personal data). */
export function referrerHost(value) {
  try {
    const host = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.-]{1,100}$/.test(host) ? host : "";
  } catch {
    return "";
  }
}

export function cleanSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  const landing = clip(raw.landing, 100);
  const source = {
    referrer: referrerHost(raw.referrer) || clip(raw.referrer, 100).replace(/[^a-z0-9.-]/gi, "").toLowerCase(),
    utm_source: tag(raw.utm_source),
    utm_medium: tag(raw.utm_medium),
    utm_campaign: tag(raw.utm_campaign),
    landing: landing.startsWith("/") ? landing.split("?")[0].split("#")[0] : "",
  };
  return Object.values(source).some(Boolean) ? source : {};
}

/** Two-letter country from the hosting edge's header, if it sent one. */
export function countryFromHeaders(get) {
  for (const name of ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"]) {
    const v = String(get(name) || "").toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") return v;
  }
  return null;
}

/** SQL for the one-word label shown in the admin: campaign source, else referring site, else Direct. */
export const SOURCE_LABEL_SQL = `coalesce(nullif(u.signup_source->>'utm_source',''), nullif(u.signup_source->>'referrer',''), 'Direct')`;
