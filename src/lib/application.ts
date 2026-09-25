import {
  FORM_DEFAULTS,
  validateStep as sharedValidateStep,
  callDays,
} from "../../shared/admissions.js";
import {
  EXAM_DECIDE_WITH_ADVISOR,
  MIN_SCIENCE_GRADE,
  UNIVERSITIES,
} from "../data/constants";
import { examSessions } from "./admissions";
import { ApplicationState, WizardFormData } from "../types";

export const TOTAL_STEPS = 8;
export const PAYMENT_STEP = 8;

export const STEP_TITLES = [
  "Applicant & High School",
  "Faculty & Intake",
  "Science Grades & English",
  "Certified Documents",
  "Entrance Exam",
  "Sworn Translation & Courier",
  "Review & Book Your Call",
  "Secure Payment (€180)",
];

const STORAGE_KEY = "studybg.application.v1";

export interface WizardPrefill {
  curriculum?: string;
  citizenship?: string;
  biology?: number;
  chemistry?: number;
  selectedUniversityId?: string;
  degree?: WizardFormData["degree"];
  schoolCountry?: string;
}

export const EMPTY_FORM = FORM_DEFAULTS as WizardFormData;

function newApplicationId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `app-${random.slice(0, 24)}`;
}

export function createApplication(): ApplicationState {
  return {
    id: newApplicationId(),
    form: { ...EMPTY_FORM },
    currentStep: 1,
    payment: { status: "unpaid" },
  };
}

export function loadApplication(): ApplicationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ApplicationState>;
      if (saved && typeof saved.id === "string" && saved.form) {
        return {
          id: saved.id,
          version: saved.version,
          status: saved.status,
          form: { ...EMPTY_FORM, ...saved.form },
          currentStep: Math.min(
            Math.max(Number(saved.currentStep) || 1, 1),
            TOTAL_STEPS,
          ),
          payment: { ...saved.payment, status: "unpaid" },
        };
      }
    }
  } catch {
    // Storage unavailable or corrupted: start fresh.
  }
  return createApplication();
}

export function saveApplication(app: ApplicationState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
  } catch {
    // Private mode / storage full: the wizard still works, it just won't survive a reload.
  }
}

/** Merges Quick Fit / university-card selections into an unpaid application. */
export function applyPrefill(
  app: ApplicationState,
  prefill: WizardPrefill,
): ApplicationState {
  if (app.payment.status === "paid") return app;
  const form = { ...app.form };
  if (prefill.degree) form.degree = prefill.degree;
  if (prefill.schoolCountry) form.schoolCountry = prefill.schoolCountry;
  const curricula: WizardFormData["highSchoolCurriculum"][] = [
    "tawjihi",
    "ib",
    "a_levels",
    "american_diploma",
    "national_curriculum",
  ];
  if (
    prefill.curriculum &&
    curricula.includes(
      prefill.curriculum as WizardFormData["highSchoolCurriculum"],
    )
  ) {
    form.highSchoolCurriculum =
      prefill.curriculum as WizardFormData["highSchoolCurriculum"];
  }
  if (prefill.citizenship && prefill.citizenship !== "Other")
    form.citizenshipCountry = prefill.citizenship;
  if (prefill.biology != null) form.biologyGrade = String(prefill.biology);
  if (prefill.chemistry != null)
    form.chemistryGrade = String(prefill.chemistry);
  if (
    prefill.selectedUniversityId &&
    UNIVERSITIES.some((u) => u.id === prefill.selectedUniversityId)
  ) {
    form.universityId = prefill.selectedUniversityId;
    const uni = UNIVERSITIES.find(
      (u) => u.id === prefill.selectedUniversityId,
    )!;
    if (!uni.programs.includes(form.degree)) form.degree = uni.programs[0];
  }
  return { ...app, form };
}

export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export function parseGrade(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function scienceAverage(form: WizardFormData): number | null {
  const bio = parseGrade(form.biologyGrade);
  const chem = parseGrade(form.chemistryGrade);
  if (bio == null || chem == null) return null;
  return Math.round(((bio + chem) / 2) * 10) / 10;
}

export function isExamSessionOpen(date: string, now = new Date()): boolean {
  return new Date(`${date}T23:59:59`) >= now;
}

/** Returns the reasons a step is incomplete. An empty list means the step is valid. */
export const validateStep = (
  step: number,
  form: WizardFormData,
  now = new Date(),
): string[] => sharedValidateStep(step, form, now);

/** First step (1-7) that is still incomplete, or PAYMENT_STEP when everything before payment is valid. */
export function furthestReachableStep(
  form: WizardFormData,
  now = new Date(),
): number {
  for (let step = 1; step < PAYMENT_STEP; step++) {
    if (validateStep(step, form, now).length) return step;
  }
  return PAYMENT_STEP;
}

/** Upcoming weekdays (Mon–Fri), starting tomorrow, as YYYY-MM-DD in the user's local calendar. */
export const upcomingWeekdays = (count: number, now = new Date()): string[] =>
  callDays(count, now);

export function formatDay(
  isoDate: string,
  opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  },
) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", opts);
}
