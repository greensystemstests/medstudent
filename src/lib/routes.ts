import { AppView, UniversityView } from "../types";

/**
 * Every page has a real address (not a #fragment), so search engines and AI crawlers can index each
 * page on its own. The build pre-renders each address to its own HTML file (scripts/prerender.mjs).
 */
export const UNIVERSITY_SLUGS: Record<UniversityView, string> = {
  "university:mu-sofia": "medical-university-of-sofia",
  "university:mu-plovdiv": "medical-university-of-plovdiv",
  "university:mu-varna": "medical-university-of-varna",
  "university:mu-pleven": "medical-university-of-pleven",
};

export const universityView = (id: string) => `university:${id}` as UniversityView;
export const isUniversityView = (view: AppView): view is UniversityView =>
  view.startsWith("university:");

/** Address of each view. 'not-found' has none: it keeps whatever address was requested. */
export const VIEW_PATH: Record<Exclude<AppView, "not-found">, string> = {
  home: "/",
  guide: "/study-medicine-in-bulgaria/",
  universities: "/universities/",
  "university:mu-sofia": `/universities/${UNIVERSITY_SLUGS["university:mu-sofia"]}/`,
  "university:mu-plovdiv": `/universities/${UNIVERSITY_SLUGS["university:mu-plovdiv"]}/`,
  "university:mu-varna": `/universities/${UNIVERSITY_SLUGS["university:mu-varna"]}/`,
  "university:mu-pleven": `/universities/${UNIVERSITY_SLUGS["university:mu-pleven"]}/`,
  calendar: "/admissions-calendar/",
  wizard: "/apply/",
  account: "/account/",
  privacy: "/privacy/",
  terms: "/terms/",
  gdpr: "/gdpr/",
  accessibility: "/accessibility/",
  "staff-live": "/review/",
  student: "/portal-demo/",
  staff: "/staff-demo/",
};

export const pathFor = (view: AppView) =>
  view === "not-found" ? "/" : VIEW_PATH[view];

/** The old #/… addresses keep working (bookmarks, emails, Stripe return links). */
const LEGACY_HASH: Record<string, AppView> = {
  "#/apply": "wizard",
  "#/account": "account",
  "#/calendar": "calendar",
  "#/privacy": "privacy",
  "#/terms": "terms",
  "#/gdpr": "gdpr",
  "#/accessibility": "accessibility",
  "#/review": "staff-live",
  "#/portal-demo": "student",
  "#/staff-demo": "staff",
};

export const isLegacyHash = (hash: string) => hash.startsWith("#/");

export function viewFromLegacyHash(hash: string): AppView | null {
  if (hash === "#/" ) return "home";
  const key = Object.keys(LEGACY_HASH).find((h) => hash === h || hash.startsWith(`${h}/`) || hash.startsWith(`${h}?`));
  return key ? LEGACY_HASH[key] : null;
}

export function viewFromPath(pathname: string): AppView {
  const normalised = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (normalised === "/" || normalised === "/index.html/") return "home";
  const match = (Object.entries(VIEW_PATH) as [AppView, string][]).find(
    ([, p]) => p === normalised,
  );
  return match ? match[0] : "not-found";
}

export function viewFromLocation(location: { pathname: string; hash: string }): AppView {
  if (isLegacyHash(location.hash)) {
    const legacy = viewFromLegacyHash(location.hash);
    if (legacy) return legacy;
  }
  return viewFromPath(location.pathname);
}
