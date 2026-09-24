import { EXAM_DECIDE_WITH_ADVISOR, EXAM_SESSIONS, MIN_SCIENCE_GRADE, UNIVERSITIES } from '../data/constants';
import { ApplicationState, WizardFormData } from '../types';

export const TOTAL_STEPS = 8;
export const PAYMENT_STEP = 8;

export const STEP_TITLES = [
  'Applicant & High School',
  'Faculty & Intake',
  'Science Grades & English',
  'Certified Documents',
  'Entrance Exam',
  'Sworn Translation & Courier',
  'Review & Book Your Call',
  'Secure Payment (€180)',
];

const STORAGE_KEY = 'studybg.application.v1';

export interface WizardPrefill {
  curriculum?: string;
  citizenship?: string;
  biology?: number;
  chemistry?: number;
  selectedUniversityId?: string;
}

export const EMPTY_FORM: WizardFormData = {
  fullName: '',
  email: '',
  phone: '',
  nationalityCategory: 'non_eu',
  citizenshipCountry: '',
  highSchoolCurriculum: 'tawjihi',
  graduationYear: '',

  degree: 'Medicine',
  universityId: '',
  intakeSeason: '',

  biologyGrade: '',
  chemistryGrade: '',
  englishProficiency: '',

  hasDiploma: false,
  hasTranscript: false,
  hasMedicalCertificate: false,
  hasPoliceClearance: false,
  hasHagueApostilleAccess: false,

  examDate: '',

  swornTranslationRequested: true,
  dhlPickupAddress: '',

  consultationDate: '',
  consultationWindow: '',
  termsAgreed: false,
  gdprAgreed: false,
  accuracySigned: false,
};

function newApplicationId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `app-${random.slice(0, 24)}`;
}

export function createApplication(): ApplicationState {
  return { id: newApplicationId(), form: { ...EMPTY_FORM }, currentStep: 1, payment: { status: 'unpaid' } };
}

export function loadApplication(): ApplicationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ApplicationState>;
      if (saved && typeof saved.id === 'string' && saved.form) {
        return {
          id: saved.id,
          form: { ...EMPTY_FORM, ...saved.form },
          currentStep: Math.min(Math.max(Number(saved.currentStep) || 1, 1), TOTAL_STEPS),
          payment: saved.payment?.status === 'paid' ? saved.payment : { ...saved.payment, status: 'unpaid' },
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
export function applyPrefill(app: ApplicationState, prefill: WizardPrefill): ApplicationState {
  if (app.payment.status === 'paid') return app;
  const form = { ...app.form };
  const curricula: WizardFormData['highSchoolCurriculum'][] = ['tawjihi', 'ib', 'a_levels', 'american_diploma', 'national_curriculum'];
  if (prefill.curriculum && curricula.includes(prefill.curriculum as WizardFormData['highSchoolCurriculum'])) {
    form.highSchoolCurriculum = prefill.curriculum as WizardFormData['highSchoolCurriculum'];
  }
  if (prefill.citizenship && prefill.citizenship !== 'Other') form.citizenshipCountry = prefill.citizenship;
  if (prefill.biology != null) form.biologyGrade = String(prefill.biology);
  if (prefill.chemistry != null) form.chemistryGrade = String(prefill.chemistry);
  if (prefill.selectedUniversityId && UNIVERSITIES.some((u) => u.id === prefill.selectedUniversityId)) {
    form.universityId = prefill.selectedUniversityId;
    const uni = UNIVERSITIES.find((u) => u.id === prefill.selectedUniversityId)!;
    if (!uni.programs.includes(form.degree)) form.degree = uni.programs[0];
  }
  return { ...app, form };
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export function parseGrade(value: string): number | null {
  if (value.trim() === '') return null;
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
export function validateStep(step: number, form: WizardFormData, now = new Date()): string[] {
  const errors: string[] = [];
  switch (step) {
    case 1: {
      if (form.fullName.trim().length < 2) errors.push('Enter your full name as shown on your passport.');
      if (!isValidEmail(form.email)) errors.push('Enter a valid email address.');
      if (!form.citizenshipCountry.trim()) errors.push('Enter your country of passport.');
      const year = Number(form.graduationYear);
      if (!Number.isInteger(year) || year < 1990 || year > now.getFullYear() + 2) {
        errors.push('Enter your high school graduation year (or expected year).');
      }
      break;
    }
    case 2: {
      const uni = UNIVERSITIES.find((u) => u.id === form.universityId);
      if (!uni) errors.push('Select a university.');
      else if (!uni.programs.includes(form.degree)) {
        errors.push(`${uni.shortName} does not offer ${form.degree} in English. Choose another program or university.`);
      }
      if (!form.intakeSeason) errors.push('Select your preferred intake.');
      break;
    }
    case 3: {
      for (const [label, value] of [
        ['Biology', form.biologyGrade],
        ['Chemistry', form.chemistryGrade],
      ] as const) {
        const grade = parseGrade(value);
        if (grade == null || grade < 0 || grade > 100) errors.push(`Enter your ${label} grade as a percentage (0–100).`);
        else if (grade < MIN_SCIENCE_GRADE) {
          errors.push(`${label} is ${grade}%. Bulgarian law requires at least ${MIN_SCIENCE_GRADE}% in both Biology and Chemistry.`);
        }
      }
      if (!form.englishProficiency) errors.push('Select your English proficiency.');
      break;
    }
    case 4: {
      if (
        !form.hasDiploma ||
        !form.hasTranscript ||
        !form.hasMedicalCertificate ||
        !form.hasPoliceClearance ||
        !form.hasHagueApostilleAccess
      ) {
        errors.push('Confirm every document in the checklist. Each one is required for your MOES file.');
      }
      break;
    }
    case 5: {
      const session = EXAM_SESSIONS.find((s) => s.date === form.examDate);
      if (form.examDate !== EXAM_DECIDE_WITH_ADVISOR && !session) errors.push('Choose an exam session, or decide it with your advisor.');
      else if (session && !isExamSessionOpen(session.date, now)) errors.push('That exam session has already closed. Choose another option.');
      break;
    }
    case 6: {
      if (form.dhlPickupAddress.trim().length < 10) errors.push('Enter the full address where DHL should collect your documents.');
      break;
    }
    case 7: {
      if (!form.consultationDate) errors.push('Pick a preferred day for your consultation call.');
      if (!form.consultationWindow) errors.push('Pick a preferred time for your consultation call.');
      if (!form.accuracySigned) errors.push('Confirm your credentials are authentic.');
      if (!form.termsAgreed) errors.push('Accept the terms of service.');
      if (!form.gdprAgreed) errors.push('Consent to processing of your data under the GDPR.');
      break;
    }
  }
  return errors;
}

/** First step (1-7) that is still incomplete, or PAYMENT_STEP when everything before payment is valid. */
export function furthestReachableStep(form: WizardFormData, now = new Date()): number {
  for (let step = 1; step < PAYMENT_STEP; step++) {
    if (validateStep(step, form, now).length) return step;
  }
  return PAYMENT_STEP;
}

/** Upcoming weekdays (Mon–Fri), starting tomorrow, as YYYY-MM-DD in the user's local calendar. */
export function upcomingWeekdays(count: number, now = new Date()): string[] {
  const days: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  return days;
}

export function formatDay(isoDate: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}
