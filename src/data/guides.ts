/**
 * Text for the public guide pages. Facts about each university come only from the official pages in
 * shared/admissions.js (reviewed on SOURCE_REVIEW_DATE). No rankings, tuition figures or claims we
 * haven't checked: when something varies, the page says so and links to the official source.
 */
import { UNIVERSITIES as SOURCES } from "../../shared/admissions.js";
import { UniversityView } from "../types";

/** Published dates per university, as shown on the admissions calendar and university pages. */
export const DEADLINE_NOTES: Record<string, string> = {
  "mu-sofia":
    "Check the official calendar for your applicant route. New dates are not yet verified here.",
  "mu-plovdiv":
    "Published 2026/27 document deadline: 11 September 2026 (closed).",
  "mu-varna":
    "Check the official calendar for your applicant route. New dates are not yet verified here.",
  "mu-pleven":
    "Published non-EU February 2027 application window ends 1 October 2026. Check hard-copy deadlines and your applicant route.",
};

export interface UniversityGuide {
  id: string;
  name: string;
  /** Common short form, e.g. "MU Sofia". */
  shortName: string;
  city: string;
  /** One-sentence location, without rankings. */
  location: string;
  programs: string[];
  rule: string;
  source: string;
  deadline: string;
  worthComparing: string;
  metaDescription: string;
  faqs: { q: string; a: string }[];
}

const DETAILS: Record<string, Pick<UniversityGuide, "shortName" | "city" | "location" | "worthComparing">> = {
  "mu-sofia": {
    shortName: "MU Sofia",
    city: "Sofia",
    location: "Sofia is Bulgaria’s capital and largest city, with the country’s main international airport.",
    worthComparing:
      "Worth comparing if you want to study in the capital and plan to look into its teaching-hospital network.",
  },
  "mu-plovdiv": {
    shortName: "MU Plovdiv",
    city: "Plovdiv",
    location: "Plovdiv is Bulgaria’s second-largest city, in the south of the country.",
    worthComparing:
      "Worth comparing if you want a large city outside the capital and a published school-grade threshold you can check before applying.",
  },
  "mu-varna": {
    shortName: "MU Varna",
    city: "Varna",
    location: "Varna is a large port city on Bulgaria’s Black Sea coast.",
    worthComparing: "Worth comparing if you’d prefer a city on the Black Sea coast.",
  },
  "mu-pleven": {
    shortName: "MU Pleven",
    city: "Pleven",
    location: "Pleven is a smaller city in northern Bulgaria.",
    worthComparing:
      "Worth comparing if you’d like a smaller city, or you’re looking at a February start.",
  },
};

function buildGuide(source: (typeof SOURCES)[number]): UniversityGuide {
  const d = DETAILS[source.id];
  const name = source.id === "mu-varna" ? "Medical University of Varna" : source.name;
  const programmes = source.programs.join(", ").replace(/, ([^,]*)$/, " and $1");
  return {
    id: source.id,
    name,
    ...d,
    programs: source.programs,
    rule: source.rule,
    source: source.source,
    deadline: DEADLINE_NOTES[source.id],
    metaDescription: `${name} for international students: ${programmes}, entry requirements, deadlines and the official admissions page.`,
    faqs: [
      {
        q: `Which programmes does the ${name} offer international students?`,
        a: `Our comparison covers ${programmes} at the ${name}. Confirm the language of teaching and the places available for your citizenship on the university’s official admissions page.`,
      },
      {
        q: `What are the entry requirements at the ${name}?`,
        a: `${source.rule} Requirements change between years and depend on your citizenship and school qualification, so the university’s own page is the one that counts.`,
      },
      {
        q: `When is the ${name} application deadline?`,
        a: DEADLINE_NOTES[source.id],
      },
      {
        q: `Can StudyBg apply to the ${name} for me?`,
        a: "No. You submit your application to the university yourself, and you can always apply directly. StudyBg is independent: we review your file, explain the requirements for your situation and help you plan documents and deadlines. The university makes the admission decision.",
      },
    ],
  };
}

export const UNIVERSITY_GUIDES = Object.fromEntries(
  SOURCES.map((s) => [`university:${s.id}`, buildGuide(s)]),
) as Record<UniversityView, UniversityGuide>;

/** Questions answered on the guide page (also published as FAQPage structured data). */
export const GUIDE_FAQS = [
  {
    q: "Can I study medicine in Bulgaria in English?",
    a: "Yes. Bulgaria’s four medical universities, in Sofia, Plovdiv, Varna and Pleven, admit international students to Medicine. Language of teaching, places and rules can differ by citizenship, so confirm them on the university’s official page.",
  },
  {
    q: "How long is the medicine degree in Bulgaria?",
    a: "Medicine is a six-year Master’s programme in Bulgaria, with the final year spent in clinical training. Dentistry and Pharmacy have their own durations, published by each university.",
  },
  {
    q: "What grades do I need?",
    a: "It depends on the university and your qualification. The Medical University of Plovdiv’s published 2026/27 guide asks for an average of at least 62% in school Biology and Chemistry. Others assess applicants differently, for example through entrance exams.",
  },
  {
    q: "Is there an entrance exam?",
    a: "At some universities and for some routes, yes. For example, the Medical University of Pleven’s published requirements refer to entrance exams in Biology and Chemistry. Check the official page for your route and the published exam dates.",
  },
  {
    q: "When does the academic year start?",
    a: "The main intake starts in the autumn. The Medical University of Pleven has published a February 2027 intake window for non-EU applicants. Deadlines differ by university and citizenship; see the admissions calendar.",
  },
  {
    q: "Do I need to speak Bulgarian?",
    a: "Not to start an English-taught programme. Universities usually include Bulgarian language classes in the course, because clinical training involves patients who speak Bulgarian.",
  },
  {
    q: "Can I practise medicine in my home country with a Bulgarian degree?",
    a: "That depends on your home country’s rules. Bulgaria is an EU member state, but recognition, licensing exams and language requirements are set by the regulator where you plan to practise. Check with them before you apply.",
  },
  {
    q: "Is StudyBg part of a university?",
    a: "No. StudyBg is an independent admissions support service, not a university or an official representative of one. You can apply directly to each university; we help applicants who want an independent review and a clear plan.",
  },
];
