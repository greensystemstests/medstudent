// Shared by the browser and API. Source review: 2026-09-24. University decisions
// require transcript/qualification review; this is not an admission decision engine.
export const POLICY_VERSION = "2026-09-24";
export const UNIVERSITIES = [
  {
    id: "mu-sofia",
    name: "Medical University of Sofia",
    programs: ["Medicine", "Dentistry", "Pharmacy"],
    source: "https://mu-sofia.bg/en/admission/admissions-of-foreign-citizen/",
    rule: "Requirements depend on qualification and applicant route. Review the current university instructions.",
    deadline: null,
  },
  {
    id: "mu-plovdiv",
    name: "Medical University of Plovdiv",
    programs: ["Medicine", "Dentistry", "Pharmacy"],
    source: "https://mu-plovdiv.bg/en/admission-info/",
    rule: "The published 2026/27 guide specifies an average of at least 62% in school Biology and Chemistry. Qualification and entrance-test requirements also apply.",
    deadline: "2026-09-11",
  },
  {
    id: "mu-varna",
    name: "Medical University of Varna",
    programs: ["Medicine", "Dentistry", "Pharmacy"],
    source:
      "https://www.mu-varna.bg/EN/Admission/Pages/applicationdocuments.aspx",
    rule: "Qualification, document and entrance-test requirements must be reviewed for your applicant route.",
    deadline: null,
  },
  {
    id: "mu-pleven",
    name: "Medical University of Pleven",
    programs: ["Medicine"],
    source:
      "https://www.mu-pleven.bg/index.php/en/admission/specialty-medicine/643-requirements",
    rule: "The published requirements refer to the school official-language grade and Biology/Chemistry entrance exams. Science grades alone do not establish eligibility.",
    deadline: "2026-10-01",
  },
];
export const INTAKES = [
  "Next available intake",
  "Autumn intake (October)",
  "Spring intake (February)",
];
export const CALL_WINDOWS = [
  "Morning (10:00–12:00 Sofia time)",
  "Afternoon (14:00–16:00 Sofia time)",
  "Evening (17:00–19:00 Sofia time)",
];
export const EXAM_SESSIONS = []; // Publish only verified, university-specific future sessions.
export const FORM_DEFAULTS = {
  fullName: "",
  email: "",
  phone: "",
  nationalityCategory: "",
  citizenshipCountry: "",
  schoolCountry: "",
  highSchoolCurriculum: "national_curriculum",
  graduationYear: "",
  degree: "Medicine",
  universityId: "",
  intakeSeason: "",
  biologyGrade: "",
  chemistryGrade: "",
  englishProficiency: "",
  hasDiploma: false,
  hasTranscript: false,
  hasMedicalCertificate: false,
  hasPoliceClearance: false,
  hasHagueApostilleAccess: false,
  examDate: "",
  swornTranslationRequested: false,
  dhlPickupAddress: "",
  consultationDate: "",
  consultationWindow: "",
  termsAgreed: false,
  gdprAgreed: false,
  accuracySigned: false,
};
export const validEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
export const sofiaToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function callDays(count = 10, now = new Date()) {
  const d = new Date(sofiaToday(now) + "T12:00:00Z"),
    days = [];
  while (days.length < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
      days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
export function cleanForm(raw) {
  const form = { ...FORM_DEFAULTS };
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === "boolean") form[k] = raw?.[k] === true;
    else
      form[k] =
        typeof raw?.[k] === "string"
          ? raw[k]
              .replace(/[\u0000-\u001f]/g, " ")
              .trim()
              .slice(0, k === "dhlPickupAddress" ? 1000 : 200)
          : "";
  }
  form.email = form.email.toLowerCase();
  return form;
}
export function validateStep(step, input, now = new Date()) {
  const f = cleanForm(input),
    e = [],
    uni = UNIVERSITIES.find((u) => u.id === f.universityId);
  if (step === 1) {
    if (f.fullName.length < 2)
      e.push("Enter your full name as shown on your passport.");
    if (!validEmail(f.email)) e.push("Enter a valid email address.");
    if (!f.citizenshipCountry) e.push("Enter your country of passport.");
    if (!f.schoolCountry)
      e.push("Enter the country that issued your school qualification.");
    if (!["non_eu", "eu_eea", "uk_post_brexit"].includes(f.nationalityCategory))
      e.push("Select your immigration category.");
    if (
      ![
        "tawjihi",
        "ib",
        "a_levels",
        "american_diploma",
        "national_curriculum",
      ].includes(f.highSchoolCurriculum)
    )
      e.push("Select your school curriculum.");
    if (
      !/^\d{4}$/.test(f.graduationYear) ||
      Number(f.graduationYear) < 1990 ||
      Number(f.graduationYear) > now.getFullYear() + 2
    )
      e.push("Enter a valid graduation year.");
  }
  if (step === 2) {
    if (!uni || !uni.programs.includes(f.degree))
      e.push("Select a supported university and degree.");
    if (!INTAKES.includes(f.intakeSeason))
      e.push("Select your preferred intake.");
    if (
      f.universityId === "mu-pleven" &&
      f.intakeSeason === "Autumn intake (October)"
    )
      e.push("Choose the spring or next available intake for Pleven.");
  }
  if (step === 3) {
    for (const [k, l] of [
      ["biologyGrade", "Biology"],
      ["chemistryGrade", "Chemistry"],
    ])
      if (
        !f[k] ||
        !Number.isFinite(Number(f[k])) ||
        Number(f[k]) < 0 ||
        Number(f[k]) > 100
      )
        e.push(`Enter your ${l} grade as a percentage (0–100).`);
    if (
      !["native", "ielts_toefl", "cambridge", "need_prep_course"].includes(
        f.englishProficiency,
      )
    )
      e.push("Select your English proficiency.");
  }
  if (step === 4 && (!f.hasDiploma || !f.hasTranscript))
    e.push(
      "Confirm that you have, or can obtain, your school diploma and transcript. Ask your advisor about other documents.",
    );
  if (step === 5 && f.examDate !== "advisor")
    e.push(
      "Choose “Decide with my advisor”; current session selection is confirmed with the university.",
    );
  if (
    step === 6 &&
    f.swornTranslationRequested &&
    f.dhlPickupAddress.length < 10
  )
    e.push(
      "Enter your proposed collection address, or turn off the translation/courier request.",
    );
  if (step === 7) {
    if (!callDays(10, now).includes(f.consultationDate))
      e.push("Choose an upcoming consultation day (Sofia time).");
    if (!CALL_WINDOWS.includes(f.consultationWindow))
      e.push("Choose a consultation time window.");
    if (!f.accuracySigned) e.push("Confirm your information is accurate.");
    if (!f.termsAgreed) e.push("Read and accept the service terms.");
    if (!f.gdprAgreed) e.push("Read and acknowledge the privacy notice.");
  }
  return e;
}
export const validateApplication = (f, now = new Date()) =>
  [1, 2, 3, 4, 5, 6, 7].flatMap((step) => validateStep(step, f, now));
export function preliminaryResult(universityId, biology, chemistry) {
  const u = UNIVERSITIES.find((u) => u.id === universityId);
  if (
    biology === "" ||
    chemistry === "" ||
    biology == null ||
    chemistry == null
  )
    return "Enter your grades to prepare for an advisor review.";
  const b = Number(biology),
    c = Number(chemistry);
  if (
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    b < 0 ||
    b > 100 ||
    c < 0 ||
    c > 100
  )
    return "Enter percentages between 0 and 100.";
  if (u?.id === "mu-plovdiv")
    return (b + c) / 2 >= 62
      ? "Your average meets the published Plovdiv school-science threshold. Other requirements still need review."
      : "Your average is below the published Plovdiv school-science threshold. Discuss possible routes before choosing a service.";
  return "Advisor review needed. These science grades alone do not determine eligibility.";
}
