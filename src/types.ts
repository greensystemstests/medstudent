export type AppView = 'home' | 'wizard' | 'account' | 'student' | 'staff';

export interface University {
  id: string;
  name: string;
  shortName: string;
  city: string;
  image: string;
  badge: string;
  tuitionFee: string;
  intakeSeats: string;
  englishRequirement: string;
  entranceExamDates: string;
  applicationDeadline: string;
  programs: ('Medicine' | 'Dentistry' | 'Pharmacy')[];
  description: string;
  strengths: string[];
}

export type DocumentStatus = 'verified' | 'action_needed' | 'in_review' | 'pending_upload';

export interface StudentDocument {
  id: string;
  title: string;
  category: 'academic' | 'identity' | 'medical' | 'legal' | 'residence';
  fileName: string;
  fileSize: string;
  uploadDate: string;
  verifiedDate?: string;
  status: DocumentStatus;
  statusMessage?: string;
  actionRequiredText?: string;
  previewUrl?: string;
  requiresApostille: boolean;
  apostilleConfirmed: boolean;
  swornTranslationDone: boolean;
  moesLegalized: boolean;
  notes?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'immediate' | 'academic' | 'relocation' | 'immigration';
  deadline: string;
  completed: boolean;
  isUrgent?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  officer: string;
  role: string;
  action: string;
  details: string;
  hash: string;
  ipAddress: string;
}

export interface ApplicantProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  originCountry: string;
  birthDate: string;
  passportNumber: string;
  passportExpiry: string;
  targetDegree: 'Medicine' | 'Dentistry' | 'Pharmacy';
  targetUniversity: string;
  intakeYear: string;
  applicationId: string;
  avatar: string;
  currentStage: number;
  totalStages: number;
  currentStageName: string;
  daysToPermitRenewal: number;
  advisorName: string;
  advisorRole: string;
  advisorAvatar: string;
  nextConsultationDate: string;
  nextConsultationZoomUrl: string;
  isPassportMasked: boolean;
}

export type DegreeProgram = 'Medicine' | 'Dentistry' | 'Pharmacy';

export interface WizardFormData {
  // Step 1: Applicant, nationality & high school
  fullName: string;
  email: string;
  phone: string;
  nationalityCategory: 'non_eu' | 'eu_eea' | 'uk_post_brexit';
  citizenshipCountry: string;
  highSchoolCurriculum: 'tawjihi' | 'ib' | 'a_levels' | 'american_diploma' | 'national_curriculum';
  graduationYear: string;

  // Step 2: Faculty & intake
  degree: DegreeProgram;
  universityId: string;
  intakeSeason: string;

  // Step 3: Academic prerequisites
  biologyGrade: string;
  chemistryGrade: string;
  englishProficiency: '' | 'native' | 'ielts_toefl' | 'cambridge' | 'need_prep_course';

  // Step 4: Documents & legalization readiness
  hasDiploma: boolean;
  hasTranscript: boolean;
  hasMedicalCertificate: boolean;
  hasPoliceClearance: boolean;
  hasHagueApostilleAccess: boolean;

  // Step 5: Entrance exam ('advisor' = decide on the consultation call)
  examDate: string;

  // Step 6: Translation & courier
  swornTranslationRequested: boolean;
  dhlPickupAddress: string;

  // Step 7: Review, consultation call & consents
  consultationDate: string;
  consultationWindow: string;
  termsAgreed: boolean;
  gdprAgreed: boolean;
  accuracySigned: boolean;
}

export type PaymentStatus = 'unpaid' | 'paid';

export interface PaymentRecord {
  status: PaymentStatus;
  paymentIntentId?: string;
  receiptRef?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
}

export interface ApplicationState {
  id: string;
  form: WizardFormData;
  currentStep: number;
  payment: PaymentRecord;
}
