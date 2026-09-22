import { ApplicantProfile, AuditLogEntry, StudentDocument, TaskItem, University } from '../types';

export const APP_IMAGES = {
  logo: 'https://lh3.googleusercontent.com/aida/AEtjO1UlVN8PP3ixURvu7ddiwPVVSOu-j01bXk5Qo0n9G7cUkmipLUpr5knt9lkMqiZryX7065XpzrQytLRha8YZA3WOxtdy39ZUsB3A4qz8lWpioX6i-cpglssb7WSJ9YQe1YFN4IvOEnWut8LHvGQRGSncVyIuZAY6IDPlwN_UvTA9ayjqhNNIvtP5LuYKfmnLJ34NVdeTIfD61c06ZtxucVX2UN0ATd2GSnsmBM6uwelwCpw2xziXe2NfQxOeNBllA5uyCvAaYlmc',
  heroAcademic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzHUBWYUFhQStfigdlpox8bqT7KKZu44hTEvRoPunkEKnpIjYhJZNZg8_fgT0hF5r0xQ-Rj4zvpYRqtlzCUvJvbvWh7Pd23EK0A80Tk5p24RXvQNAY-5aqaGdWNA60tyv5AqncZxRE26hCSh_sqsp1S88BxojqzVJRLdflvQTgfKN0xhGaoB7zCwIVEWYpMm2LMJg8Jsclf3Zv437I4dlGt0mtvfDfuOF77DtPwx1t-2rOfn66C31ljwibz89kuJbU8A',
  tariqStudent: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDEDly43NF-omI_RCN6GZeGbsFjAmJbbjvJAH8VAZXBcoHSvGpIbhQQi3rbSncIIHEsAlnaEliZheI9dmShix2FCtVyUbsDdQWS4De50SsKoYs6MAkz-mwHwWR5hFxP5EpXXJMZuMwd0dX_2em1gGmiSd9HuSLxh2KvqgX4UJCf0ydrSszRY5tY73FqKbEVL_Ki-kg5U3RVHg6H3Uuo6h3f6pxaR5hWiAcVxiaORSIzn7ZfsNgnl7o8',
  elenaAdvisor: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7yr8IAS91rZM6jTUO8NMNaYbRADPlyjf3gdGQA0hHXaQ4tOYmQUiDA8XoiR7oU57mVB3H258imcOPiHLeLYYUBcsX5Bs4VlbxVd8jTPJ_jDm6NMG818_C9QyM1-C7o2dy61e5ZrIiIjSFqPGmg4oRkAJkQzgEVR0gnxu_muOxJqbBDNR6hYpMreSxzk1tdqPV8jdqoxMVpjMaLv6wcaKo98k3P8Z2J-1kVoKo-r-9GLo3eRmKh08p',
  muSofia: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8SuTHrXiZiSkGSd0X7hELYsgq5NNd6M3UOsQNJDizsRQzeft2LyWc3kjmgyPkhTNNURkA6im9x-W0QhXo6IMpT_Sge9A4z_Xl1WpbRPxr_6QyHz18Lu8heRzpHnBs5qxtJhFioF1cdio0WdXwM2IT8wkjDK7LyVWId7fsqOZLvOV9KksN0uHi-bjtndgesCQfZZcpCr3N_mKsrJKi1ZY1p_fqtfrvmA_n5EWP23BTsgYB-3_CndqR',
  muPlovdiv: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ9UwBnlfjf9NZA1bdYH_4Dvck0C-gtdAEYXJeMX-nR2ZTmivgdQUb5EKA6pUA-qHktPqB3KPhxuX959LKgXOay8kuFDQ-EQhDEy3UAiA_RalDfFP709VcOlx0tTimPdhn3p8U8LCTeT7_DjOP3SJbT8YOeHJtnJQrA18JDk6pHotZ6kDgmtf2sVSbSvA_gfVYYIlar2UK_GQ67jHkf8vdAvIM8X1PZ7tvgYD6VxhsDVCzQxuYFUzX',
  muVarna: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTxHxORcWi6WRpsY3rYVPAdNYXiANus5ag5gPaY6ZsKb8ZjIDkk0RtT0dsrTa3Ni4U9TEn0OvgEtNLBmaNULTbfbZzcgJAOdzYq7-AD0liBdFgQad17OusymR-LOahg_SCnV8dJwmlycY0fbzCY28f59q6KWvx5IfcW-t7UNREzPzVg8APofAx1YZzxiXyjUYwH6304G1YMxqJbKd18jGsefhsxS3zNLUevyICIhUisv3c3ZRffe1m',
  muPleven: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnVRqb3I3ZrsDGB804ZQvEEJOhjRL7arCWjmtiztnoFXk_UUh9Yg7UvZgb5aQP4U4Qn5iQSI5t3TjzrojCHSV2u3kEwHCPFMd8VtX0uRD5qAIp8PIRHkb1sWhoyqLkThzHOI26Vq_U96fHaF7REGCHY9xBiHSdPMEmFfyecoxXD2TrdRqbTyHNCKSOmYtXCFdnZ6PW0xwIZ_3zWmfLGkuGtbi7s9zDf3oXTSZIJbqOYaC_JSH8dGH9',
  auditorium: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcVSXnUuCTmTxPJyNS-Kmy52DEwvUEX4s1GbN_z74sDf0oiwL8od_xGxXzNHHPHCkruj4O8ZUuFCUZNYn3Zwow3rGpSMwkGgkOlLO1QN18RRLOYMvjGTpfL9Tw0IY_CWo7YXTpKOKclH9PsRFzWAlIjXQqptMOuNMkXek1S5dUn7ATmZ9wJgutxJ53xGPVxhD4pfTVxlYlRqe2dgyCE8Xei54Lt2XMIis3AKQRWHv-weqMGpat9NHv',
};

export const UNIVERSITIES: University[] = [
  {
    id: 'mu-sofia',
    name: 'Medical University of Sofia',
    shortName: 'MU Sofia',
    city: 'Sofia (Capital)',
    image: APP_IMAGES.muSofia,
    badge: 'Flagship Academic Medical Center',
    tuitionFee: '€9,000 / year (Medicine)',
    intakeSeats: '550 International Seats',
    englishRequirement: 'IELTS 6.5 / B2 or Entrance Test',
    entranceExamDates: 'July 15, Aug 20, Sep 12 (Online/On-campus)',
    applicationDeadline: 'September 1, 2025',
    programs: ['Medicine', 'Dentistry', 'Pharmacy'],
    description: 'The oldest and most prestigious Bulgarian medical school, established in 1917. Features multi-specialty clinical university hospitals and modern dissection laboratories.',
    strengths: [
      'Over 100 years of academic clinical tradition',
      'Clinical rotations across 14 university hospitals',
      'Direct metro connection to Sofia International Airport',
      'Full EU & GMC recognition (UK medical register eligible)'
    ]
  },
  {
    id: 'mu-plovdiv',
    name: 'Medical University of Plovdiv',
    shortName: 'MU Plovdiv',
    city: 'Plovdiv (Cultural Hub)',
    image: APP_IMAGES.muPlovdiv,
    badge: 'European Leader in Medical Simulation',
    tuitionFee: '€9,000 / year (Medicine & Dental)',
    intakeSeats: '400 International Seats',
    englishRequirement: 'Online University English Exam or B2',
    entranceExamDates: 'June 28, July 26, Aug 30',
    applicationDeadline: 'September 5, 2025',
    programs: ['Medicine', 'Dentistry', 'Pharmacy'],
    description: 'Home to Southeast Europe’s largest certified Medical Simulation Training Center with virtual reality laparoscopy, surgical mannequins, and standardized patient suites.',
    strengths: [
      'State-of-the-art Medical Simulation Center',
      'Vibrant student community in European Capital of Culture',
      'Affordable living costs (avg. €450-€600/month)',
      'High first-time pass rate on USMLE & PLAB exams'
    ]
  },
  {
    id: 'mu-varna',
    name: 'Prof. Dr. Paraskev Stoyanov Medical University of Varna',
    shortName: 'MU Varna',
    city: 'Varna (Black Sea Coast)',
    image: APP_IMAGES.muVarna,
    badge: 'Modern Coastal Campus & 3D Anatomy',
    tuitionFee: '€9,000 / year (Medicine)',
    intakeSeats: '300 International Seats',
    englishRequirement: 'High School English or B2 Certificate',
    entranceExamDates: 'July 8, Aug 12, Sep 4',
    applicationDeadline: 'August 28, 2025',
    programs: ['Medicine', 'Dentistry', 'Pharmacy'],
    description: 'Dynamic seaside university offering cutting-edge 3D interactive anatomy tables, modern research institutes, and a relaxed lifestyle on the Black Sea coast.',
    strengths: [
      'Interactive 3D stereoscopic anatomy instruction',
      'Coastal living with direct seasonal flights to UK & Europe',
      'Specialized dental clinics with over 150 operating chairs',
      'Active Erasmus+ exchanges with 120+ EU partner schools'
    ]
  },
  {
    id: 'mu-pleven',
    name: 'Medical University of Pleven',
    shortName: 'MU Pleven',
    city: 'Pleven (Central Bulgaria)',
    image: APP_IMAGES.muPleven,
    badge: 'Pioneers in Robotic da Vinci Surgery',
    tuitionFee: '€8,500 / year (Medicine)',
    intakeSeats: '150 International Seats',
    englishRequirement: 'High School Transcript or B2',
    entranceExamDates: 'Spring & Fall intake options',
    applicationDeadline: 'October 15, 2025 (February Intake)',
    programs: ['Medicine'],
    description: 'The first university in Bulgaria to launch an all-English medical curriculum in 1997. Renowned worldwide for minimally invasive and robotic da Vinci surgery training.',
    strengths: [
      'February Spring Intake available (unique in Bulgaria)',
      'Pioneering robotic surgery center with dual da Vinci consoles',
      'Small group clinical cohorts (6-8 students per doctor)',
      'Budget-friendly living cost (€350-€500/month)'
    ]
  }
];

export const INITIAL_STUDENT_PROFILE: ApplicantProfile = {
  id: 'app-tariq-2025-098',
  name: 'Tariq Al-Mansoor',
  email: 'tariq.mansoor@example.com',
  phone: '+962 7 9812 4430',
  nationality: 'Jordanian',
  originCountry: 'Jordan',
  birthDate: '2004-06-14',
  passportNumber: 'P89234190B',
  passportExpiry: '2031-10-18',
  targetDegree: 'Medicine',
  targetUniversity: 'Medical University of Sofia (MU Sofia)',
  intakeYear: '2025/2026 Academic Year',
  applicationId: 'BG-MED-2025-098-AM',
  avatar: APP_IMAGES.tariqStudent,
  currentStage: 2,
  totalStages: 6,
  currentStageName: 'Document Sworn Legalization & MOES Accreditation',
  daysToPermitRenewal: 84,
  advisorName: 'Elena Dimitrova',
  advisorRole: 'Senior Sworn Legalization & MOES Officer',
  advisorAvatar: APP_IMAGES.elenaAdvisor,
  nextConsultationDate: 'Tomorrow, 14:00 EET',
  nextConsultationZoomUrl: 'https://zoom.us/j/94827103819',
  isPassportMasked: true,
};

export const INITIAL_DOCUMENTS: StudentDocument[] = [
  {
    id: 'doc-1',
    title: 'Jordanian General Secondary Certificate (Tawjihi)',
    category: 'academic',
    fileName: 'Tariq_AlMansoor_Tawjihi_Diploma_2024.pdf',
    fileSize: '3.4 MB',
    uploadDate: '2025-01-18',
    status: 'action_needed',
    statusMessage: 'Apostille Certificate Missing',
    actionRequiredText: 'Missing Jordan Ministry of Foreign Affairs (MOFA) Apostille stamp on back leaf.',
    requiresApostille: true,
    apostilleConfirmed: false,
    swornTranslationDone: false,
    moesLegalized: false,
    notes: 'Front page scanned with high resolution. The back page with MOFA and Ministry of Education legalization stamps is required for Bulgarian MOES submission.',
  },
  {
    id: 'doc-2',
    title: 'Biology & Chemistry High School Marksheet',
    category: 'academic',
    fileName: 'Science_Grade_Report_Signed.pdf',
    fileSize: '1.8 MB',
    uploadDate: '2025-01-18',
    verifiedDate: '2025-01-20',
    status: 'verified',
    statusMessage: 'Verified (Biology 94%, Chemistry 91%)',
    requiresApostille: true,
    apostilleConfirmed: true,
    swornTranslationDone: true,
    moesLegalized: true,
  },
  {
    id: 'doc-3',
    title: 'Valid International Passport (Biometric)',
    category: 'identity',
    fileName: 'Passport_Scan_Tariq_P89234190B.pdf',
    fileSize: '2.1 MB',
    uploadDate: '2025-01-15',
    verifiedDate: '2025-01-16',
    status: 'verified',
    statusMessage: 'Verified (Valid until Oct 2031)',
    requiresApostille: false,
    apostilleConfirmed: true,
    swornTranslationDone: true,
    moesLegalized: true,
  },
  {
    id: 'doc-4',
    title: 'Medical Fitness Certificate (Form 086/e)',
    category: 'medical',
    fileName: 'Official_Medical_Clearance_Amman_Hospital.pdf',
    fileSize: '1.2 MB',
    uploadDate: '2025-01-22',
    status: 'in_review',
    statusMessage: 'Under Sworn Bulgarian Translation in Sofia',
    requiresApostille: true,
    apostilleConfirmed: true,
    swornTranslationDone: false,
    moesLegalized: false,
    notes: 'Submitted to accredited Sofia translation agency. Estimated turnaround 24 business hours.',
  },
  {
    id: 'doc-5',
    title: 'Criminal Record Police Clearance Certificate',
    category: 'legal',
    fileName: 'Police_Clearance_Jordan_Public_Security.pdf',
    fileSize: '890 KB',
    uploadDate: '2025-01-19',
    verifiedDate: '2025-01-21',
    status: 'verified',
    statusMessage: 'Apostilled & MOFA Stamped',
    requiresApostille: true,
    apostilleConfirmed: true,
    swornTranslationDone: true,
    moesLegalized: true,
  },
  {
    id: 'doc-6',
    title: 'Bulgarian MOES Certificate of Eligibility',
    category: 'academic',
    fileName: 'Pending_MOES_Sofia_Filing.pdf',
    fileSize: '0 KB',
    uploadDate: 'Pending Filing',
    status: 'pending_upload',
    statusMessage: 'Awaiting Full Dossier Physical Courier to Sofia',
    requiresApostille: false,
    apostilleConfirmed: false,
    swornTranslationDone: false,
    moesLegalized: false,
    notes: 'Will be deposited in person at Ministry of Education & Science (Sofia) once Tawjihi back-page apostille is verified.',
  }
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't-1',
    title: 'Upload Tawjihi Back Page with MOFA Stamp',
    subtitle: 'High-res color scan (300+ DPI) of reverse side with Hague Apostille',
    category: 'immediate',
    deadline: 'Due within 3 days',
    completed: false,
    isUrgent: true,
  },
  {
    id: 't-2',
    title: 'Attend 1-on-1 Pre-Departure Strategy Call',
    subtitle: 'Zoom session with Senior Legalization Officer Elena Dimitrova',
    category: 'immediate',
    deadline: 'Tomorrow, 14:00 EET',
    completed: false,
    isUrgent: false,
  },
  {
    id: 't-3',
    title: 'Complete Biology & Chemistry Entrance Exam Diagnostic Test',
    subtitle: '60 MCQs tailored to MU Sofia syllabus with instant feedback',
    category: 'academic',
    deadline: 'By Sunday',
    completed: false,
  },
  {
    id: 't-4',
    title: 'Track DHL Courier Pack #BG-77492-EXP',
    subtitle: 'Original physical documents transit to Sofia legal desk',
    category: 'relocation',
    deadline: 'In transit',
    completed: true,
  },
  {
    id: 't-5',
    title: 'Bulgarian Bank Account & Tax ID (EGN/LNCh) Preparation',
    subtitle: 'Required for D-Visa financial solvency proof (€3,500 deposit guarantee)',
    category: 'immigration',
    deadline: 'Stage 4 prerequisite',
    completed: false,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2025-01-22 11:42:09 UTC',
    officer: 'Elena Dimitrova',
    role: 'Senior Legal Officer',
    action: 'FLAGGED_ACTION_NEEDED',
    details: 'Flagged Document #doc-1 (Tawjihi Diploma) - Missing reverse Hague Apostille stamp.',
    hash: '0x9e8a71c8491bfd23719028',
    ipAddress: '194.141.21.84 (Sofia Desk)'
  },
  {
    id: 'audit-002',
    timestamp: '2025-01-21 16:30:15 UTC',
    officer: 'Elena Dimitrova',
    role: 'Senior Legal Officer',
    action: 'VERIFIED_LEGAL_DOC',
    details: 'Verified Police Clearance Certificate after MOFA Apostille authenticity check.',
    hash: '0x33bca7109adce9014672',
    ipAddress: '194.141.21.84 (Sofia Desk)'
  },
  {
    id: 'audit-003',
    timestamp: '2025-01-20 14:15:00 UTC',
    officer: 'Dr. Martin Petrov',
    role: 'Academic Admissions Director',
    action: 'ACADEMIC_EVAL_APPROVED',
    details: 'Science GPA evaluated: Biology 94% / Chemistry 91% exceeds MU Sofia 62% threshold.',
    hash: '0x8f220da4188bca992147',
    ipAddress: '85.130.4.112 (MU Sofia Admin)'
  },
  {
    id: 'audit-004',
    timestamp: '2025-01-18 09:12:33 UTC',
    officer: 'System Automation',
    role: 'Commercial Gateway Gateway',
    action: 'STRIPE_ESCROW_AUTHORIZED',
    details: 'Standard Application & Advisory Onboarding Fee €180 captured (Ref: ch_3Qv8128L01).',
    hash: '0x117acbf20876da391100',
    ipAddress: '54.217.90.14 (Stripe Webhook)'
  }
];

export const FAQS = [
  {
    q: 'Are Bulgarian medical degrees recognized in the UK, US, EU, and Arab world?',
    a: 'Yes. Bulgarian medical degrees (MD / Doctor of Medicine) are fully recognized across the European Union under Directive 2005/36/EC. In the UK, graduates are eligible for direct registration with the GMC. In the US & Canada, universities are listed in the World Directory of Medical Schools (WDOMS/ECFMG eligible). In Jordan, UAE, and GCC nations, degrees from accredited state medical universities like MU Sofia and MU Plovdiv are officially recognized by Ministries of Higher Education.'
  },
  {
    q: 'What is the required minimum grade in Biology and Chemistry?',
    a: 'Bulgarian legislation requires high school graduates to achieve a combined average of at least 62% in high school Biology and Chemistry. Candidates with higher marks receive priority ranking in entrance exam scores.'
  },
  {
    q: 'What does the €180 Onboarding & Advisory Fee cover?',
    a: 'The €180 flat fee includes comprehensive document eligibility auditing, certified high school credential evaluation, university matching, an entrance exam syllabus prep pack, an individual 45-minute video consultation with an accredited Sofia legal advisor, and personal oversight throughout the 6-stage application journey.'
  },
  {
    q: 'How does the Bulgarian Long-Stay Type-D Visa work for Non-EU students?',
    a: 'Non-EU students receive a Certificate of Admission from the Bulgarian Ministry of Education and Science (MOES). With this official certificate, health insurance, criminal clearance, and housing confirmation, students apply for the Type-D Visa at their nearest Bulgarian Embassy or Consulate.'
  },
  {
    q: 'How does the Annual Residence Permit (VRN) 84-day countdown work?',
    a: 'Non-EU students hold a 1-year Bulgarian Continuous Residence Permit that must be renewed annually at the Migration Directorate (MVR) at least 14 days before expiry. Our portal automatically calculates your countdown, issues early alerts at 90/60/30 days, prepares the university confirmation certificate (Uverenie), and schedules your biometrics.'
  }
];
