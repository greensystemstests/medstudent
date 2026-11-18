import { TRANSLATION_DOC_TYPES, TRANSLATION_LANGUAGES, translationDocList, UNIVERSITIES } from "../../shared/admissions.js";
import type { ApplicationState } from "../types";

/** Readable names for the saved form fields, in the order staff read them. */
export const FIELD_LABELS: [keyof ApplicationState["form"], string][] = [
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["nationalityCategory", "Immigration category"],
  ["citizenshipCountry", "Passport country"],
  ["schoolCountry", "School qualification country"],
  ["highSchoolCurriculum", "Curriculum"],
  ["graduationYear", "Graduation year"],
  ["degree", "Degree"],
  ["universityId", "University"],
  ["intakeSeason", "Intake"],
  ["biologyGrade", "Biology (%)"],
  ["chemistryGrade", "Chemistry (%)"],
  ["englishProficiency", "English"],
  ["hasDiploma", "Has diploma"],
  ["hasTranscript", "Has transcript"],
  ["hasHagueApostilleAccess", "Can get apostille/legalisation"],
  ["hasMedicalCertificate", "Has medical certificate"],
  ["hasPoliceClearance", "Has police clearance"],
  ["examDate", "Exam session"],
  ["swornTranslationRequested", "Wants translation help"],
  ["translationDocs", "Documents to translate"],
  ["translationLanguage", "Translate into"],
  ["translationNote", "Translation note"],
  ["accuracySigned", "Accuracy confirmed"],
  ["termsAgreed", "Terms accepted"],
  ["gdprAgreed", "Privacy notice acknowledged"],
];

export const showField = (key: string, v: unknown) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "universityId") return UNIVERSITIES.find((u) => u.id === v)?.name ?? String(v || "—");
  if (key === "examDate" && v === "advisor") return "Decide with adviser";
  if (key === "translationDocs")
    return (
      translationDocList(v)
        .map((k) => TRANSLATION_DOC_TYPES[k as keyof typeof TRANSLATION_DOC_TYPES])
        .join(", ") || "—"
    );
  if (key === "translationLanguage")
    return TRANSLATION_LANGUAGES[v as keyof typeof TRANSLATION_LANGUAGES] ?? "—";
  return String(v ?? "").replaceAll("_", " ") || "—";
};

