import React, { useState } from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  CreditCard, 
  Lock, 
  FileText, 
  Upload, 
  User, 
  Building2, 
  Check, 
  AlertCircle,
  Stethoscope,
  Send,
  HelpCircle,
  MapPin,
  Truck
} from 'lucide-react';
import { UNIVERSITIES, APP_IMAGES } from '../data/constants';
import { AppView, WizardFormData } from '../types';

interface WizardViewProps {
  onNavigate: (view: AppView) => void;
  prefill?: {
    curriculum: string;
    citizenship: string;
    biology: number;
    chemistry: number;
    selectedUniversityId: string;
  } | null;
  onCompleteToPortal: () => void;
}

export const WizardView: React.FC<WizardViewProps> = ({ 
  onNavigate, 
  prefill, 
  onCompleteToPortal 
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 8;

  const [formData, setFormData] = useState<WizardFormData>({
    nationalityCategory: 'non_eu',
    citizenshipCountry: prefill?.citizenship || 'Jordan',
    highSchoolCountry: prefill?.citizenship || 'Jordan',
    highSchoolCurriculum: (prefill?.curriculum as any) || 'tawjihi',
    graduationYear: '2024',

    degree: 'Medicine',
    universityId: prefill?.selectedUniversityId || 'mu-sofia',
    intakeSeason: 'Winter (October 2025)',

    biologyGrade: prefill ? String(prefill.biology) : '94',
    chemistryGrade: prefill ? String(prefill.chemistry) : '91',
    gpaEquivalent: '92.5%',
    mathPhysicsBonus: true,
    englishProficiency: 'ielts_toefl',

    hasDiploma: true,
    hasTranscript: true,
    hasMedicalCertificate: true,
    hasPoliceClearance: true,
    hasHagueApostilleAccess: true,

    examDate: '2025-08-20',
    examLocation: 'Online Proctored',
    mockTestBooked: true,

    commercialGatePassed: true,
    feeAmount: 180,
    bookedConsultationSlot: 'Tomorrow, 14:00 EET',
    paymentReference: 'ch_3Qv8128L01_studybg',

    swornTranslationRequested: true,
    dhlPickupAddress: 'Amman, Jordan (King Abdullah II Street #14)',
    courierTrackingCode: 'BG-77492-EXP',

    termsAgreed: true,
    gdprAgreed: true,
    accuracySigned: true,
  });

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const selectedUni = UNIVERSITIES.find(u => u.id === formData.universityId) || UNIVERSITIES[0];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onCompleteToPortal();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const simulateStripePayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      setFormData(prev => ({ ...prev, commercialGatePassed: true }));
    }, 900);
  };

  const stepTitles = [
    'Nationality & High School',
    'Faculty & Intake Selection',
    'Science Prerequisites & English',
    'Certified Documents & Apostille',
    'Entrance Exam Booking',
    'Commercial Gate (€180)',
    'Bulgarian Sworn Translation',
    'Final Submission & Dossier'
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Wizard Header Bar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#006644] text-xs font-semibold border border-emerald-200">
                Official Gateway 2025/2026
              </span>
              <span className="text-xs text-slate-400">Step {currentStep} of {totalSteps}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
              {stepTitles[currentStep - 1]}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">Auto-saved to session draft</span>
            <button
              onClick={() => onNavigate('student')}
              className="text-xs font-medium text-slate-600 hover:text-[#006644] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Skip to Tariq's Portal Demo
            </button>
          </div>
        </div>

        {/* Multi-Step Horizontal Indicator */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[720px] gap-2">
            {stepTitles.map((title, idx) => {
              const stepNumber = idx + 1;
              const isDone = currentStep > stepNumber;
              const isCurrent = currentStep === stepNumber;

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(stepNumber)}
                  className="flex items-center gap-2 group text-left focus:outline-none"
                >
                  <span
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                      isDone
                        ? 'bg-[#006644] text-white'
                        : isCurrent
                        ? 'bg-[#0f1e36] text-white ring-2 ring-emerald-400'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : stepNumber}
                  </span>
                  <span
                    className={`text-xs font-medium truncate max-w-[90px] ${
                      isCurrent ? 'text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {title}
                  </span>
                  {idx < totalSteps - 1 && (
                    <div className="w-4 h-0.5 bg-slate-200 mx-1"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Form Steps on Left, Sticky Sidebar on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Form Area */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            {/* STEP 1: Nationality & High School */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 1: Nationality, Passport & Secondary Education
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Bulgarian immigration and MOES require distinct legalization protocols for Non-EU vs EU/EEA citizens.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Immigration Legal Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nationalityCategory: 'non_eu' })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.nationalityCategory === 'non_eu'
                            ? 'border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs mb-1">Non-EU / Third Country</div>
                        <div className="text-[11px] text-slate-500">Requires Type-D Student Visa & MOES Certificate</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nationalityCategory: 'eu_eea' })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.nationalityCategory === 'eu_eea'
                            ? 'border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs mb-1">EU / EEA Citizen</div>
                        <div className="text-[11px] text-slate-500">Freedom of movement; simplified registration</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nationalityCategory: 'uk_post_brexit' })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.nationalityCategory === 'uk_post_brexit'
                            ? 'border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs mb-1">UK (Post-Brexit)</div>
                        <div className="text-[11px] text-slate-500">FCDO Apostille + Bulgarian Type-D Visa</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Country of Passport
                      </label>
                      <input
                        type="text"
                        value={formData.citizenshipCountry}
                        onChange={(e) => setFormData({ ...formData, citizenshipCountry: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#006644] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        High School Secondary Curriculum
                      </label>
                      <select
                        value={formData.highSchoolCurriculum}
                        onChange={(e) => setFormData({ ...formData, highSchoolCurriculum: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#006644] outline-none"
                      >
                        <option value="tawjihi">Jordanian Tawjihi (Scientific Stream)</option>
                        <option value="ib">International Baccalaureate (IB)</option>
                        <option value="a_levels">British A-Levels</option>
                        <option value="american_diploma">US High School Diploma + AP</option>
                        <option value="national_curriculum">Other National Secondary School</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold mb-0.5">Jordanian Tawjihi Notice</div>
                      <p className="text-slate-600">
                        Since Jordan is an official signatory to the Hague Apostille Convention (1961), your Tawjihi certificate is legalized via Jordan MOFA Apostille, saving up to 4 weeks compared to traditional embassy consular legalization.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Target Degree & City */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 2: Target Faculty, Program & Intake
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your preferred Bulgarian state university and degree program taught entirely in English.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Academic Degree Program
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['Medicine', 'Dentistry', 'Pharmacy'] as const).map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => setFormData({ ...formData, degree: deg })}
                          className={`p-3.5 rounded-xl border text-center transition-all ${
                            formData.degree === deg
                              ? 'border-[#006644] bg-emerald-50 text-[#006644] font-bold ring-1 ring-[#006644]'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-sm">{deg}</div>
                          <div className="text-[11px] text-slate-500">
                            {deg === 'Medicine' ? '6 Years (MD)' : deg === 'Dentistry' ? '5.5 Years (DMD)' : '5 Years (MPharm)'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Bulgarian State Medical Faculty
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {UNIVERSITIES.map((uni) => (
                        <div
                          key={uni.id}
                          onClick={() => setFormData({ ...formData, universityId: uni.id })}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            formData.universityId === uni.id
                              ? 'border-[#006644] bg-emerald-50/50 ring-1 ring-[#006644]'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900">{uni.name}</span>
                            <span className="text-[11px] font-bold text-[#006644] bg-emerald-100/70 px-2 py-0.5 rounded">
                              {uni.shortName}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-2">{uni.city}</div>
                          <div className="text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
                            <span>Tuition: {uni.tuitionFee}</span>
                            <span className="text-emerald-700 font-medium">{uni.intakeSeats}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Academic Prerequisites */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 3: Science Grades & English Proficiency
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Bulgarian Higher Education Act mandates minimum 62% in high school Biology and Chemistry.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Biology Grade (% or Points)
                    </label>
                    <input
                      type="number"
                      value={formData.biologyGrade}
                      onChange={(e) => setFormData({ ...formData, biologyGrade: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-bold text-[#006644] focus:border-[#006644] outline-none"
                    />
                    <p className="text-[11px] text-slate-500">Tariq's verified Tawjihi Biology: 94 / 100</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Chemistry Grade (% or Points)
                    </label>
                    <input
                      type="number"
                      value={formData.chemistryGrade}
                      onChange={(e) => setFormData({ ...formData, chemistryGrade: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-bold text-[#006644] focus:border-[#006644] outline-none"
                    />
                    <p className="text-[11px] text-slate-500">Tariq's verified Tawjihi Chemistry: 91 / 100</p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Combined Science Average: <strong>92.5%</strong> (Far exceeds 62% statutory minimum)</span>
                  </div>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">Rank A1</span>
                </div>
              </div>
            )}

            {/* STEP 4: Certified Documents & Apostille */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 4: Certified Documents & Legalization Readiness
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Verify the documents you have on hand for physical Sofia MOES deposit.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'High School Diploma (Tawjihi / A-Levels / IB)', note: 'Must have Hague Apostille on back page', stateKey: 'hasDiploma' },
                    { label: 'Detailed Science Marksheet / Transcript', note: 'Showing individual Biology and Chemistry grades', stateKey: 'hasTranscript' },
                    { label: 'Medical Health Certificate (Form 086/e)', note: 'Issued within 30 days of submission', stateKey: 'hasMedicalCertificate' },
                    { label: 'Police Clearance Certificate (Criminal Record)', note: 'Proving clean background for Bulgarian Type-D Visa', stateKey: 'hasPoliceClearance' },
                    { label: 'Access to Jordan MOFA Hague Apostille Office', note: 'Required before DHL dispatch to Sofia', stateKey: 'hasHagueApostilleAccess' },
                  ].map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(formData[item.stateKey as keyof WizardFormData])}
                        onChange={(e) => setFormData({ ...formData, [item.stateKey]: e.target.checked })}
                        className="mt-1 w-4 h-4 text-[#006644] rounded border-slate-300 focus:ring-[#006644]"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-800">{item.label}</div>
                        <div className="text-slate-500 text-[11px]">{item.note}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: Entrance Exam Booking */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 5: Entrance Exam Date & Syllabus Prep Kit
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Book your official multiple-choice entrance examination in Biology & Chemistry.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { date: '2025-07-15', label: 'Session 1 (July 15)', seats: 'Early Intake' },
                      { date: '2025-08-20', label: 'Session 2 (Aug 20)', seats: 'Recommended', active: true },
                      { date: '2025-09-12', label: 'Session 3 (Sep 12)', seats: 'Final Session' },
                    ].map((slot, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, examDate: slot.date })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          formData.examDate === slot.date
                            ? 'border-[#006644] bg-emerald-50 ring-1 ring-[#006644]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs text-slate-900">{slot.label}</div>
                        <div className="text-[11px] text-slate-500">{slot.seats}</div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#006644]" />
                      <span>StudyBg Exam Prep Syllabus Included</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Instant access to 500+ past Biology and Chemistry MCQs with detailed explanations aligned with MU Sofia Faculty of Medicine curriculum.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: Commercial Gate (€180) & Advisor Booking */}
            {currentStep === 6 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 mb-2">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Commercial Gateway & Legal Escrow</span>
                  </div>
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 6: €180 Onboarding & Legal Representation Deposit
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Secure your 1-on-1 strategy video consultation and official Sofia legal dossier review.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Payment Form */}
                  <div className="md:col-span-7 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800">Card Payment (Stripe Mock)</span>
                      </div>
                      <span className="text-xs font-bold text-[#006644]">€180.00 EUR</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">CARD NUMBER</label>
                        <input
                          type="text"
                          readOnly
                          value="•••• •••• •••• 4242 (Stripe Test Visa)"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">EXPIRY</label>
                          <input
                            type="text"
                            readOnly
                            value="12 / 28"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVC</label>
                          <input
                            type="text"
                            readOnly
                            value="•••"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={simulateStripePayment}
                      disabled={isProcessingPayment || paymentSuccess}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        paymentSuccess
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-[#006644] hover:bg-[#005538] text-white shadow-xs'
                      }`}
                    >
                      {isProcessingPayment ? (
                        <span>Processing Escrow Authorization...</span>
                      ) : paymentSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authorized (€180 Captured)</span>
                        </>
                      ) : (
                        <span>Authorize €180 Onboarding Fee</span>
                      )}
                    </button>
                  </div>

                  {/* Advisor Booking Slot */}
                  <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="text-xs font-bold text-slate-700 uppercase mb-2">
                        Assigned Sofia Legal Advisor
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={APP_IMAGES.elenaAdvisor}
                          alt="Elena Dimitrova"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900">Elena Dimitrova</div>
                          <div className="text-[11px] text-slate-500">Senior Legal & MOES Officer</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-xs">
                      <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Booked Consultation Slot:</span>
                      </div>
                      <div className="text-slate-700 font-medium">Tomorrow at 14:00 EET (Zoom link provided)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: Bulgarian Sworn Translation & Courier */}
            {currentStep === 7 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 7: Bulgarian Sworn Translation & Sofia Legal Courier
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Documents must be translated by an MFA-registered sworn translator in Sofia.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Physical Document Pickup / Dispatch Address
                    </label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={formData.dhlPickupAddress}
                        onChange={(e) => setFormData({ ...formData, dhlPickupAddress: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-[#006644] outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      DHL Express tracking reference will be generated for direct transit to StudyBg Sofia Desk.
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#006644]" />
                      <span>Tracking Code: <strong>{formData.courierTrackingCode}</strong></span>
                    </div>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Pre-Authorized Label Ready
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: Final Review & Submission */}
            {currentStep === 8 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold font-heading text-slate-900">
                    Step 8: Review & Submit Application Dossier
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Verify all candidate metadata before initializing your live Student Portal and Sofia Ministry filing.
                  </p>
                </div>

                {/* Candidate Summary Box */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Candidate Name:</span>
                      <div className="font-bold text-slate-800">Tariq Al-Mansoor</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Target Faculty:</span>
                      <div className="font-bold text-slate-800">{selectedUni.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Degree & Intake:</span>
                      <div className="font-bold text-slate-800">{formData.degree} ({formData.intakeSeason})</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Evaluated Science GPA:</span>
                      <div className="font-bold text-[#006644]">{formData.gpaEquivalent} (Bio {formData.biologyGrade}% / Chem {formData.chemistryGrade}%)</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.termsAgreed}
                      onChange={(e) => setFormData({ ...formData, termsAgreed: e.target.checked })}
                      className="w-4 h-4 text-[#006644] rounded border-slate-300"
                    />
                    <span className="text-slate-700">I confirm that all scanned secondary credentials represent authentic transcripts.</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.gdprAgreed}
                      onChange={(e) => setFormData({ ...formData, gdprAgreed: e.target.checked })}
                      className="w-4 h-4 text-[#006644] rounded border-slate-300"
                    />
                    <span className="text-slate-700">I consent to processing under EU GDPR and representation before Bulgarian MOES.</span>
                  </label>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span>Ready to unlock your live Student Portal and upload your documents</span>
                  <span className="font-bold text-emerald-700">Status: Dossier Primed</span>
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  currentStep === 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 bg-[#006644] hover:bg-[#005538] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow flex items-center gap-2 transition-all"
                id="wizard-continue-btn"
              >
                <span>{currentStep === totalSteps ? 'Finalize & Open Student Portal' : 'Save & Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sticky Sidebar: Summary & Guidance */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Application Summary
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="font-bold text-sm text-slate-900">{selectedUni.shortName}</div>
                <div className="text-xs text-slate-500">{formData.degree} • {selectedUni.city}</div>
                <div className="text-xs text-[#006644] font-semibold mt-1">
                  Tuition: {selectedUni.tuitionFee}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Candidate:</span>
                  <span className="font-semibold text-slate-900">Tariq Al-Mansoor</span>
                </div>
                <div className="flex justify-between">
                  <span>Citizenship:</span>
                  <span className="font-semibold text-slate-900">{formData.citizenshipCountry}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bio / Chem Avg:</span>
                  <span className="font-semibold text-emerald-700">{formData.gpaEquivalent}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exam Session:</span>
                  <span className="font-semibold text-slate-900">{formData.examDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Onboarding Fee:</span>
                  <span className="font-bold text-[#006644]">€180 (Escrowed)</span>
                </div>
              </div>

              {/* Legal Officer Badge */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                <img
                  src={APP_IMAGES.elenaAdvisor}
                  alt="Elena Dimitrova"
                  className="w-9 h-9 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Elena Dimitrova</div>
                  <div className="text-[10px] text-slate-500">Sofia Legal Officer Assigned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
