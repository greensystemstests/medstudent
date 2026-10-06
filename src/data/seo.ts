import { SOURCE_REVIEW_DATE, UNIVERSITIES as SOURCES } from "../../shared/admissions.js";
import { AppView, UniversityView } from "../types";
import { isUniversityView, pathFor, universityView } from "../lib/routes";
import { FAQS, GATEWAY_NAME, ONBOARDING_FEE_EUR } from "./constants";
import { GUIDE_FAQS, UNIVERSITY_GUIDES } from "./guides";
import { hasRealEmail, isPlaceholder, LEGAL_ENTITY } from "./legal";

/** The public address. Every page's canonical URL points here, never to the Render host. */
export const SITE_URL = "https://studybg.ac";
export const SITE_NAME = "StudyBg";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
/** First publication of the guide pages (Article structured data). */
const GUIDES_PUBLISHED = "2026-10-06";

export interface PageMeta {
  title: string;
  description: string;
  /** false: the page is personal, a tool or a demo, so search engines are told not to list it. */
  index: boolean;
  /** Breadcrumb trail above this page (Home is added automatically). */
  parents?: AppView[];
  /** Short name used in breadcrumbs. */
  crumb: string;
}

const uniMeta = (view: UniversityView): PageMeta => {
  const guide = UNIVERSITY_GUIDES[view];
  return {
    title: `${guide.name}: Requirements & Deadlines | StudyBg`,
    description: guide.metaDescription,
    index: true,
    parents: ["universities"],
    crumb: guide.name,
  };
};

export const PAGE_META: Record<AppView, PageMeta> = {
  home: {
    title: "Study Medicine in Bulgaria in English – Free Check | StudyBg",
    description:
      "Study Medicine or Dentistry in English in Bulgaria. Take the free eligibility check and compare the medical universities of Sofia, Plovdiv, Varna and Pleven.",
    index: true,
    crumb: "Home",
  },
  guide: {
    title: "How to Study Medicine in Bulgaria in English (2026/27 Guide)",
    description:
      "Guide for international students: entry requirements, documents, legalisation, entrance exams, visas and costs at Bulgaria’s four medical universities.",
    index: true,
    crumb: "Study medicine in Bulgaria",
  },
  universities: {
    title: "Medical Universities in Bulgaria Teaching in English",
    description:
      "Compare Bulgaria’s four medical universities in Sofia, Plovdiv, Varna and Pleven: English-taught programmes, entry rules, deadlines and official pages.",
    index: true,
    crumb: "Universities",
  },
  "university:mu-sofia": uniMeta("university:mu-sofia"),
  "university:mu-plovdiv": uniMeta("university:mu-plovdiv"),
  "university:mu-varna": uniMeta("university:mu-varna"),
  "university:mu-pleven": uniMeta("university:mu-pleven"),
  calendar: {
    title: "Admissions Calendar 2026/27: Bulgarian Medical Universities",
    description:
      "Published application deadlines and intake windows for English-taught Medicine and Dentistry at the medical universities of Sofia, Plovdiv, Varna and Pleven.",
    index: true,
    crumb: "Admissions calendar",
  },
  wizard: {
    title: `Apply – ${GATEWAY_NAME} (€${ONBOARDING_FEE_EUR}) | StudyBg`,
    description: `Start your StudyBg application for the €${ONBOARDING_FEE_EUR} ${GATEWAY_NAME}: application review, video consultation and a document plan for your route.`,
    index: false,
    crumb: "Apply",
  },
  account: {
    title: "My account | StudyBg",
    description: "Sign in to your StudyBg account to see your applications, documents and review notes.",
    index: false,
    crumb: "My account",
  },
  privacy: {
    title: "Privacy Policy | StudyBg",
    description: "How StudyBg collects, uses, stores and protects personal data, and how to exercise your rights under the GDPR.",
    index: true,
    crumb: "Privacy Policy",
  },
  terms: {
    title: "Terms & Conditions | StudyBg",
    description: `Terms for the StudyBg ${GATEWAY_NAME}: what the €${ONBOARDING_FEE_EUR} covers, what it doesn’t, payment, your 14-day withdrawal right and complaints.`,
    index: true,
    crumb: "Terms & Conditions",
  },
  gdpr: {
    title: "GDPR Compliance | StudyBg",
    description: "StudyBg’s approach to the EU General Data Protection Regulation: lawful bases, retention, processors and your data-protection rights.",
    index: true,
    crumb: "GDPR",
  },
  accessibility: {
    title: "Accessibility Statement | StudyBg",
    description: "StudyBg aims to meet WCAG 2.2 level AA. Read about the accessibility settings on this site, known limitations and how to report a problem.",
    index: true,
    crumb: "Accessibility",
  },
  "staff-live": { title: "Staff review | StudyBg", description: "StudyBg staff review.", index: false, crumb: "Staff review" },
  student: { title: "Student portal (demo) | StudyBg", description: "Demo of the StudyBg student portal with sample data.", index: false, crumb: "Student portal demo" },
  staff: { title: "Staff operations (demo) | StudyBg", description: "Demo of StudyBg staff operations with sample data.", index: false, crumb: "Staff demo" },
  "not-found": {
    title: "Page not found | StudyBg",
    description: "This page doesn’t exist. Go to the StudyBg homepage or the guide to studying medicine in Bulgaria.",
    index: false,
    crumb: "Page not found",
  },
};

export const canonicalUrl = (view: AppView) => `${SITE_URL}${pathFor(view)}`;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

function organization() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    alternateName: "StudyBg Medical Gateway",
    ...(isPlaceholder(LEGAL_ENTITY.name) ? {} : { legalName: LEGAL_ENTITY.name }),
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
    image: OG_IMAGE,
    description:
      "Independent admissions support for international students applying to English-taught Medicine and Dentistry at Bulgaria’s state medical universities. StudyBg is not a university and does not guarantee admission.",
    ...(hasRealEmail(LEGAL_ENTITY.contactEmail) ? { email: LEGAL_ENTITY.contactEmail } : {}),
    areaServed: "Worldwide",
    knowsAbout: [
      "Studying medicine in Bulgaria",
      "English-taught medical degrees",
      "Dentistry in Bulgaria",
      "University admission for international students",
      "Document legalisation and apostille",
      "Sworn translation into Bulgarian",
    ],
  };
}

function breadcrumbs(view: AppView) {
  const trail: AppView[] = ["home", ...(PAGE_META[view].parents ?? []), view];
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: PAGE_META[v].crumb,
      item: canonicalUrl(v),
    })),
  };
}

const faqPage = (faqs: { q: string; a: string }[], url: string) => ({
  "@type": "FAQPage",
  "@id": `${url}#faq`,
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

function university(id: string) {
  const source = SOURCES.find((u) => u.id === id)!;
  const guide = UNIVERSITY_GUIDES[universityView(id)];
  return {
    "@type": "CollegeOrUniversity",
    name: source.name,
    url: new URL(source.source).origin,
    sameAs: source.source,
    address: { "@type": "PostalAddress", addressLocality: guide.city, addressCountry: "BG" },
  };
}

/** schema.org structured data for a page, as one JSON-LD graph. */
export function structuredData(view: AppView): object | null {
  const meta = PAGE_META[view];
  if (!meta.index) return null;
  const url = canonicalUrl(view);
  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: meta.title,
    description: meta.description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en",
    primaryImageOfPage: OG_IMAGE,
    dateModified: SOURCE_REVIEW_DATE,
  };
  const graph: object[] = [organization()];

  if (view === "home") {
    graph.push(
      { "@type": "WebSite", "@id": WEBSITE_ID, name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "en", publisher: { "@id": ORG_ID } },
      { ...webPage, about: { "@id": `${SITE_URL}/#service` } },
      {
        "@type": "Service",
        "@id": `${SITE_URL}/#service`,
        name: `StudyBg ${GATEWAY_NAME}`,
        serviceType: "Admissions support for English-taught medical degrees in Bulgaria",
        description:
          "An application and qualification review, a 45-minute video consultation, a document and deadline plan for your university route, and a StudyBg account with secure document uploads. Tuition, exam, translation, legalisation, visa and living costs are not included.",
        provider: { "@id": ORG_ID },
        areaServed: "Worldwide",
        audience: { "@type": "EducationalAudience", educationalRole: "prospective student" },
        offers: {
          "@type": "Offer",
          price: ONBOARDING_FEE_EUR.toFixed(2),
          priceCurrency: "EUR",
          url: canonicalUrl("wizard"),
          description: "One-time fee, taxes included. No subscription.",
        },
      },
      faqPage(FAQS, url),
    );
    return { "@context": "https://schema.org", "@graph": graph };
  }

  graph.push(breadcrumbs(view));
  if (view === "guide") {
    graph.push(
      { ...webPage, mainEntity: { "@id": `${url}#article` } },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: "How to study medicine in Bulgaria in English",
        description: meta.description,
        image: OG_IMAGE,
        datePublished: GUIDES_PUBLISHED,
        dateModified: SOURCE_REVIEW_DATE,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        mainEntityOfPage: url,
        about: SOURCES.map((u) => university(u.id)),
      },
      faqPage(GUIDE_FAQS, url),
    );
  } else if (view === "universities") {
    graph.push({
      ...webPage,
      "@type": "CollectionPage",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: SOURCES.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: canonicalUrl(universityView(u.id)),
          name: u.name,
        })),
      },
    });
  } else if (isUniversityView(view)) {
    const id = view.slice("university:".length);
    graph.push({ ...webPage, about: university(id) }, faqPage(UNIVERSITY_GUIDES[view].faqs, url));
  } else {
    graph.push(webPage);
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The <head> tags for a page. Written into each pre-rendered HTML file at build time. */
export function headTags(view: AppView): string {
  const meta = PAGE_META[view];
  const url = canonicalUrl(view);
  const data = structuredData(view);
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${meta.index ? "index, follow, max-image-preview:large, max-snippet:-1" : "noindex, follow"}" />`,
    view === "not-found" ? "" : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${view === "guide" ? "article" : "website"}" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    view === "not-found" ? "" : `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="StudyBg – study Medicine and Dentistry in Bulgaria, in English" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    data
      ? `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

/** Keeps title, description, robots and canonical in step when the visitor moves between pages. */
export function applyPageMeta(view: AppView, options: { skipTitle?: boolean } = {}) {
  const meta = PAGE_META[view];
  if (!options.skipTitle) document.title = meta.title;
  const set = (selector: string, attr: string, value: string) => {
    const el = document.head.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', "content", meta.description);
  set('meta[name="robots"]', "content", meta.index ? "index, follow, max-image-preview:large, max-snippet:-1" : "noindex, follow");
  set('link[rel="canonical"]', "href", canonicalUrl(view));
  set('meta[property="og:url"]', "content", canonicalUrl(view));
  set('meta[property="og:title"]', "content", meta.title);
  set('meta[property="og:description"]', "content", meta.description);
}
