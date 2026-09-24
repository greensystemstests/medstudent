import React, { useEffect, useRef, useState } from 'react';
import { scrollBehavior } from '../lib/a11y';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Globe2,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  APP_IMAGES,
  CONSULTATION_WINDOWS,
  EXAM_DECIDE_WITH_ADVISOR,
  EXAM_SESSIONS,
  INTAKE_OPTIONS,
  MIN_SCIENCE_GRADE,
  UNIVERSITIES,
} from '../data/constants';
import {
  formatDay,
  furthestReachableStep,
  isExamSessionOpen,
  parseGrade,
  PAYMENT_STEP,
  scienceAverage,
  STEP_TITLES,
  TOTAL_STEPS,
  upcomingWeekdays,
  validateStep,
} from '../lib/application';
import { warmUpApi } from '../lib/api';
import { ApplicationState, AppView, DegreeProgram, WizardFormData } from '../types';
import { PaymentStep } from './PaymentStep';
import { ApplicationConfirmation } from './ApplicationConfirmation';

interface WizardViewProps {
  app: ApplicationState;
  onChange: (updater: (app: ApplicationState) => ApplicationState) => void;
  onNavigate: (view: AppView) => void;
  onStartNewApplication: () => void;
  demoMode: boolean;
}

const inputClass =
  'w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#006644] focus:ring-1 focus:ring-[#006644] outline-none';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase mb-1';
const choiceClass = (selected: boolean) =>
  `rounded-xl border text-left transition-all ${
    selected
      ? 'border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]'
      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
  }`;

const ENGLISH_OPTIONS: { value: WizardFormData['englishProficiency']; label: string }[] = [
  { value: 'native', label: 'Native speaker / English-medium high school' },
  { value: 'ielts_toefl', label: 'IELTS / TOEFL certificate' },
  { value: 'cambridge', label: 'Cambridge English (B2 or higher)' },
  { value: 'need_prep_course', label: 'I need an English preparatory course' },
];

const DOCUMENT_ITEMS: { key: keyof WizardFormData; label: string; note: string }[] = [
  { key: 'hasDiploma', label: 'High School Diploma (Tawjihi / A-Levels / IB / national)', note: 'Must carry a Hague Apostille (or consular legalization)' },
  { key: 'hasTranscript', label: 'Detailed Science Marksheet / Transcript', note: 'Showing individual Biology and Chemistry grades' },
  { key: 'hasMedicalCertificate', label: 'Medical Health Certificate (Form 086/e)', note: 'Issued within 30 days of submission' },
  { key: 'hasPoliceClearance', label: 'Police Clearance Certificate (Criminal Record)', note: 'Proving a clean background for the Bulgarian Type-D visa' },
  { key: 'hasHagueApostilleAccess', label: 'Access to a Hague Apostille office (or embassy legalization)', note: 'Required before DHL dispatch to Sofia' },
];

export const WizardView: React.FC<WizardViewProps> = ({ app, onChange, onNavigate, onStartNewApplication, demoMode }) => {
  const { form } = app;
  const [showErrors, setShowErrors] = useState(false);

  useEffect(warmUpApi, []);
  useEffect(() => setShowErrors(false), [app.currentStep]);

  const paid = app.payment.status === 'paid';
  const firstStepRender = useRef(true);
  useEffect(() => {
    document.title = paid
      ? 'Application confirmed – StudyBg'
      : `Step ${Math.min(app.currentStep, TOTAL_STEPS)} of ${TOTAL_STEPS}: ${STEP_TITLES[Math.min(app.currentStep, TOTAL_STEPS) - 1]} – Apply – StudyBg`;
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    // Announce the new step by moving focus to its heading (WCAG 2.4.3 focus order).
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
  }, [app.currentStep, paid]);

  if (app.payment.status === 'paid') {
    return (
      <ApplicationConfirmation
        app={app}
        demoMode={demoMode}
        onNavigate={onNavigate}
        onStartNewApplication={onStartNewApplication}
      />
    );
  }

  const reachable = furthestReachableStep(form);
  // A saved step can be ahead of what is valid now (e.g. an exam session closed since): never show it.
  const currentStep = Math.min(app.currentStep, reachable);
  const errors = currentStep < PAYMENT_STEP ? validateStep(currentStep, form) : [];
  const selectedUni = UNIVERSITIES.find((u) => u.id === form.universityId);
  const average = scienceAverage(form);
  const gradesOk = average != null && validateStep(3, { ...form, englishProficiency: 'native' }).length === 0;

  const update = (patch: Partial<WizardFormData>) => onChange((a) => ({ ...a, form: { ...a.form, ...patch } }));

  const goTo = (step: number) => {
    // Never allow jumping past the first incomplete step.
    const target = Math.min(Math.max(step, 1), reachable, TOTAL_STEPS);
    onChange((a) => ({ ...a, currentStep: target }));
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };

  const handleNext = () => {
    if (errors.length) {
      setShowErrors(true);
      // Move focus to the error summary so keyboard and screen-reader users land on it (WCAG 3.3.1).
      requestAnimationFrame(() => {
        const summary = document.getElementById('step-errors');
        summary?.focus({ preventScroll: true });
        summary?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      });
      return;
    }
    goTo(currentStep + 1);
  };

  const callDays = upcomingWeekdays(10);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#006644] text-xs font-semibold border border-emerald-200">
                Application Gateway
              </span>
              <span className="text-xs text-slate-500">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">{STEP_TITLES[currentStep - 1]}</h1>
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Progress is saved on this device
          </span>
        </div>

        {/* Stepper: only completed steps and the first incomplete one are clickable */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs mb-8 overflow-x-auto">
          <ol className="flex items-center justify-between min-w-[760px] gap-2">
            {STEP_TITLES.map((title, idx) => {
              const step = idx + 1;
              const isCurrent = currentStep === step;
              const isDone = step < reachable && !isCurrent;
              const locked = step > reachable;
              return (
                <li key={title} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goTo(step)}
                    disabled={locked}
                    aria-current={isCurrent ? 'step' : undefined}
                    title={locked ? 'Complete the previous steps first' : title}
                    className="relative flex items-center gap-2 group text-left focus:outline-none disabled:cursor-not-allowed"
                  >
                    <span
                      className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'bg-[#0f1e36] text-white ring-2 ring-emerald-400'
                          : isDone
                            ? 'bg-[#006644] text-white'
                            : locked
                              ? 'bg-slate-100 text-slate-300'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : step}
                    </span>
                    <span
                      className={`text-xs font-medium truncate max-w-[90px] ${
                        isCurrent ? 'text-slate-900 font-bold' : locked ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {title}
                    </span>
                    {isDone && <span className="sr-only"> (completed)</span>}
                    {locked && <span className="sr-only"> (complete the previous steps first)</span>}
                  </button>
                  {idx < TOTAL_STEPS - 1 && <div className="w-4 h-0.5 bg-slate-200 mx-1" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div
            className={`${currentStep === PAYMENT_STEP ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6`}
          >
            {showErrors && errors.length > 0 && (
              <div id="step-errors" role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <div className="font-bold flex items-center gap-1.5 mb-1.5">
                  <AlertCircle className="w-4 h-4" /> Please complete this step before continuing
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* STEP 1 */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 1: About You, Nationality & Secondary Education"
                  subtitle="Bulgarian immigration and MOES require distinct legalization protocols for Non-EU vs EU/EEA citizens."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="fullName">Full name (as on passport)</label>
                    <input id="fullName" autoComplete="name" className={inputClass} value={form.fullName} onChange={(e) => update({ fullName: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="email">Email</label>
                    <input id="email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={(e) => update({ email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="phone">
                      Phone / WhatsApp <span className="normal-case font-normal text-slate-500">(optional)</span>
                    </label>
                    <input id="phone" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
                  </div>
                </div>

                <div>
                  <span id="grp-immigration" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Immigration legal category</span>
                  <div role="group" aria-labelledby="grp-immigration" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        ['non_eu', 'Non-EU / Third Country', 'Requires Type-D Student Visa & MOES Certificate'],
                        ['eu_eea', 'EU / EEA Citizen', 'Freedom of movement; simplified registration'],
                        ['uk_post_brexit', 'UK (Post-Brexit)', 'FCDO Apostille + Bulgarian Type-D Visa'],
                      ] as const
                    ).map(([value, title, note]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update({ nationalityCategory: value })}
                        aria-pressed={form.nationalityCategory === value} className={`p-4 ${choiceClass(form.nationalityCategory === value)}`}
                      >
                        <div className="font-bold text-xs mb-1">{title}</div>
                        <div className="text-[0.6875rem] text-slate-500">{note}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="citizenship">Country of passport</label>
                    <input id="citizenship" autoComplete="country-name" className={inputClass} value={form.citizenshipCountry} onChange={(e) => update({ citizenshipCountry: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="curriculum">High school curriculum</label>
                    <select
                      id="curriculum"
                      className={inputClass}
                      value={form.highSchoolCurriculum}
                      onChange={(e) => update({ highSchoolCurriculum: e.target.value as WizardFormData['highSchoolCurriculum'] })}
                    >
                      <option value="tawjihi">Jordanian Tawjihi (Scientific Stream)</option>
                      <option value="ib">International Baccalaureate (IB)</option>
                      <option value="a_levels">British A-Levels</option>
                      <option value="american_diploma">US High School Diploma + AP</option>
                      <option value="national_curriculum">Other National Secondary School</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="gradYear">Graduation year</label>
                    <input
                      id="gradYear"
                      type="number"
                      inputMode="numeric"
                      placeholder="e.g. 2026"
                      className={inputClass}
                      value={form.graduationYear}
                      onChange={(e) => update({ graduationYear: e.target.value })}
                    />
                  </div>
                </div>

                <Notice>
                  {form.highSchoolCurriculum === 'tawjihi' || form.citizenshipCountry.trim().toLowerCase() === 'jordan' ? (
                    <>
                      <strong className="block mb-0.5">Jordanian Tawjihi</strong>
                      Jordan is a signatory to the Hague Apostille Convention, so your Tawjihi certificate is legalized via a Jordan MOFA
                      Apostille, saving up to 4 weeks compared to embassy consular legalization.
                    </>
                  ) : form.nationalityCategory === 'eu_eea' ? (
                    <>
                      <strong className="block mb-0.5">EU / EEA candidate</strong>
                      Simplified admission under EU Directive 2005/36/EC. No Type-D student visa required.
                    </>
                  ) : (
                    <>
                      <strong className="block mb-0.5">Legalization</strong>
                      Your diploma needs a Hague Apostille from the issuing country (or consular legalization), a sworn Bulgarian
                      translation in Sofia, and a Bulgarian MOES certificate for the Type-D visa.
                    </>
                  )}
                </Notice>
              </div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 2: Target Faculty, Program & Intake"
                  subtitle="Select your preferred Bulgarian state university and degree program taught entirely in English."
                />
                <div>
                  <span id="grp-degree" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Degree program</span>
                  <div role="group" aria-labelledby="grp-degree" className="grid grid-cols-3 gap-3">
                    {(['Medicine', 'Dentistry', 'Pharmacy'] as DegreeProgram[]).map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => {
                          const uni = UNIVERSITIES.find((u) => u.id === form.universityId);
                          update({ degree: deg, universityId: uni && !uni.programs.includes(deg) ? '' : form.universityId });
                        }}
                        aria-pressed={form.degree === deg} className={`p-3.5 text-center ${choiceClass(form.degree === deg)}`}
                      >
                        <div className="text-sm font-bold">{deg}</div>
                        <div className="text-[0.6875rem] text-slate-500">
                          {deg === 'Medicine' ? '6 Years (MD)' : deg === 'Dentistry' ? '5.5 Years (DMD)' : '5 Years (MPharm)'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span id="grp-university" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Bulgarian state medical faculty</span>
                  <div role="group" aria-labelledby="grp-university" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {UNIVERSITIES.map((uni) => {
                      const offers = uni.programs.includes(form.degree);
                      return (
                        <button
                          key={uni.id}
                          type="button"
                          disabled={!offers}
                          onClick={() => update({ universityId: uni.id })}
                          aria-pressed={form.universityId === uni.id} className={`p-4 disabled:opacity-50 disabled:cursor-not-allowed ${choiceClass(form.universityId === uni.id)}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900">{uni.name}</span>
                            <span className="text-[0.6875rem] font-bold text-[#006644] bg-emerald-100/70 px-2 py-0.5 rounded">{uni.shortName}</span>
                          </div>
                          <div className="text-xs text-slate-500 mb-2">{uni.city}</div>
                          <div className="text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
                            <span>Tuition: {uni.tuitionFee}</span>
                            <span className={offers ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                              {offers ? uni.intakeSeats : `No ${form.degree} program`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span id="grp-intake" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Preferred intake</span>
                  <div role="group" aria-labelledby="grp-intake" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INTAKE_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => update({ intakeSeason: opt.value })} aria-pressed={form.intakeSeason === opt.value} className={`p-3.5 ${choiceClass(form.intakeSeason === opt.value)}`}>
                        <div className="font-bold text-xs">{opt.value}</div>
                        <div className="text-[0.6875rem] text-slate-500">{opt.note}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-slate-500 mt-2">Your advisor confirms the exact intake year and deadlines on your call.</p>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 3: Science Grades & English Proficiency"
                  subtitle={`The Bulgarian Higher Education Act requires at least ${MIN_SCIENCE_GRADE}% in high school Biology and Chemistry.`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {(
                    [
                      ['biologyGrade', 'Biology grade (%)'],
                      ['chemistryGrade', 'Chemistry grade (%)'],
                    ] as const
                  ).map(([key, label]) => {
                    const grade = parseGrade(form[key]);
                    const low = grade != null && grade < MIN_SCIENCE_GRADE;
                    return (
                      <div key={key} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase" htmlFor={key}>{label}</label>
                        <input
                          id={key}
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          inputMode="decimal"
                          placeholder="e.g. 85"
                          value={form[key]}
                          aria-invalid={low || undefined}
                          aria-describedby={`${key}-hint`}
                          onChange={(e) => update({ [key]: e.target.value })}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-base font-bold outline-none ${
                            low ? 'border-red-300 text-red-700 focus:border-red-500' : 'border-slate-300 text-[#006644] focus:border-[#006644]'
                          }`}
                        />
                        <p id={`${key}-hint`} className="text-[0.6875rem] text-slate-500">
                          {low ? `Below the ${MIN_SCIENCE_GRADE}% minimum. ` : ''}Convert to a percentage if your system uses points or letters.
                        </p>
                      </div>
                    );
                  })}
                </div>

                {average != null && (
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-2 text-xs ${
                      gradesOk
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {gradesOk ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <span>
                      Science average: <strong>{average}%</strong>.{' '}
                      {gradesOk
                        ? `Meets the ${MIN_SCIENCE_GRADE}% minimum in both subjects.`
                        : `Both subjects must be at least ${MIN_SCIENCE_GRADE}% for this admission route.`}
                    </span>
                  </div>
                )}

                <div>
                  <label className={labelClass} htmlFor="english">English proficiency</label>
                  <select
                    id="english"
                    className={inputClass}
                    value={form.englishProficiency}
                    onChange={(e) => update({ englishProficiency: e.target.value as WizardFormData['englishProficiency'] })}
                  >
                    <option value="">Select…</option>
                    {ENGLISH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 4: Certified Documents & Legalization Readiness"
                  subtitle="Confirm you have, or can obtain, each document below. All are required for your Sofia MOES file."
                />
                <div className="space-y-3">
                  {DOCUMENT_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form[item.key])}
                        onChange={(e) => update({ [item.key]: e.target.checked })}
                        className="mt-1 w-4 h-4 accent-[#006644]"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-800">{item.label}</div>
                        <div className="text-slate-500 text-[0.6875rem]">{item.note}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 5: Entrance Exam Session"
                  subtitle="The official entrance examination is multiple-choice in Biology & Chemistry."
                />
                <div role="group" aria-label="Entrance exam session" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EXAM_SESSIONS.map((session) => {
                    const open = isExamSessionOpen(session.date);
                    return (
                      <button
                        key={session.date}
                        type="button"
                        disabled={!open}
                        onClick={() => update({ examDate: session.date })}
                        aria-pressed={form.examDate === session.date} className={`p-3.5 disabled:opacity-50 disabled:cursor-not-allowed ${choiceClass(form.examDate === session.date)}`}
                      >
                        <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                          {session.label}
                          {!open && <span className="text-[0.625rem] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Closed</span>}
                        </div>
                        <div className="text-[0.6875rem] text-slate-500">{open ? session.note : 'Registration has closed'}</div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => update({ examDate: EXAM_DECIDE_WITH_ADVISOR })}
                    aria-pressed={form.examDate === EXAM_DECIDE_WITH_ADVISOR} className={`p-3.5 ${choiceClass(form.examDate === EXAM_DECIDE_WITH_ADVISOR)}`}
                  >
                    <div className="font-bold text-xs text-slate-900">Decide with my advisor</div>
                    <div className="text-[0.6875rem] text-slate-500">We'll pick the best upcoming session on your call</div>
                  </button>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#006644]" />
                    StudyBg Exam Prep Syllabus Included
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    500+ past Biology and Chemistry MCQs with detailed explanations, aligned with the Bulgarian medical faculties' curriculum.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 6 */}
            {currentStep === 6 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 6: Bulgarian Sworn Translation & Sofia Legal Courier"
                  subtitle="Documents must be translated by an MFA-registered sworn translator in Sofia."
                />
                <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.swornTranslationRequested}
                    onChange={(e) => update({ swornTranslationRequested: e.target.checked })}
                    className="mt-1 w-4 h-4 accent-[#006644]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800">StudyBg manages my sworn translation</div>
                    <div className="text-slate-500 text-[0.6875rem]">Translator's fee passed through at cost, zero markup.</div>
                  </div>
                </label>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase" htmlFor="address">
                    Document pickup address (for DHL Express)
                  </label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-2.5" />
                    <textarea
                      id="address"
                      rows={3}
                      autoComplete="street-address"
                      placeholder="Street, building, city, postcode, country"
                      value={form.dhlPickupAddress}
                      onChange={(e) => update({ dhlPickupAddress: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-[#006644] outline-none"
                    />
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#006644]" />
                    A DHL Express tracking reference will be generated for direct transit to the StudyBg Sofia desk.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7 */}
            {currentStep === 7 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <StepHeading
                  title="Step 7: Review Your Application & Book Your Call"
                  subtitle="Check your details, choose when you'd like your 45-minute consultation, and confirm the declarations."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <ReviewCard title="Applicant" onEdit={() => goTo(1)}>
                    <div className="font-bold text-slate-900">{form.fullName}</div>
                    <div>{form.email}{form.phone && ` · ${form.phone}`}</div>
                    <div>{form.citizenshipCountry} · graduated {form.graduationYear}</div>
                  </ReviewCard>
                  <ReviewCard title="Program" onEdit={() => goTo(2)}>
                    <div className="font-bold text-slate-900">{form.degree}</div>
                    <div>{selectedUni?.name}</div>
                    <div>{form.intakeSeason}</div>
                  </ReviewCard>
                  <ReviewCard title="Academics" onEdit={() => goTo(3)}>
                    <div>Biology {form.biologyGrade}% · Chemistry {form.chemistryGrade}%</div>
                    <div>{ENGLISH_OPTIONS.find((o) => o.value === form.englishProficiency)?.label}</div>
                  </ReviewCard>
                  <ReviewCard title="Exam & documents" onEdit={() => goTo(5)}>
                    <div>
                      Exam:{' '}
                      {form.examDate === EXAM_DECIDE_WITH_ADVISOR
                        ? 'decide with advisor'
                        : EXAM_SESSIONS.find((s) => s.date === form.examDate)?.label}
                    </div>
                    <div>All 5 documents confirmed</div>
                    <div className="truncate">Pickup: {form.dhlPickupAddress}</div>
                  </ReviewCard>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <img src={APP_IMAGES.elenaAdvisor} alt="Elena Dimitrova" className="w-11 h-11 rounded-xl object-cover" referrerPolicy="no-referrer" />
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <CalendarClock className="w-4 h-4 text-[#006644]" /> Book your 45-min call with Elena Dimitrova
                      </div>
                      <div className="text-[0.6875rem] text-slate-500">Senior Legal & MOES Officer. Included in your €180 fee.</div>
                    </div>
                  </div>
                  <div>
                    <span id="grp-call-day" className="block text-xs font-semibold text-slate-700 mb-2">Preferred day</span>
                    <div role="group" aria-labelledby="grp-call-day" className="flex flex-wrap gap-2">
                      {callDays.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => update({ consultationDate: day })}
                          aria-pressed={form.consultationDate === day} className={`px-3 py-2 text-xs font-semibold ${choiceClass(form.consultationDate === day)}`}
                        >
                          {formatDay(day)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span id="grp-call-time" className="block text-xs font-semibold text-slate-700 mb-2">Preferred time</span>
                    <div role="group" aria-labelledby="grp-call-time" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {CONSULTATION_WINDOWS.map((w) => (
                        <button key={w} type="button" onClick={() => update({ consultationWindow: w })} aria-pressed={form.consultationWindow === w} className={`px-3 py-2 text-xs font-semibold ${choiceClass(form.consultationWindow === w)}`}>
                          {w}
                        </button>
                      ))}
                    </div>
                    <p className="text-[0.6875rem] text-slate-500 mt-2 flex items-center gap-1">
                      <Globe2 className="w-3 h-3" /> Your timezone: {timezone}. We confirm the exact time by email.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {(
                    [
                      ['accuracySigned', 'I confirm that my secondary credentials and grades are authentic and accurate.'],
                      [
                        'termsAgreed',
                        <>
                          I accept the StudyBg <LegalLink href="#/terms">Terms &amp; Conditions</LegalLink> for the €180 onboarding & advisory package.
                        </>,
                      ],
                      [
                        'gdprAgreed',
                        <>
                          I consent to processing of my data as described in the <LegalLink href="#/privacy">Privacy Policy</LegalLink> and to
                          representation before the Bulgarian MOES.
                        </>,
                      ],
                    ] as const
                  ).map(([key, text]) => (
                    <label key={key} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => update({ [key]: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-[#006644]"
                      />
                      <span className="text-slate-700">{text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 8 */}
            {currentStep === PAYMENT_STEP && (
              <PaymentStep
                app={app}
                onIntentCreated={(paymentIntentId) =>
                  onChange((a) => (a.payment.paymentIntentId === paymentIntentId ? a : { ...a, payment: { ...a.payment, paymentIntentId } }))
                }
                onPaid={(info) =>
                  onChange((a) => ({
                    ...a,
                    payment: {
                      status: 'paid',
                      paymentIntentId: info.paymentIntentId,
                      receiptRef: info.receiptRef,
                      amount: info.amount,
                      currency: info.currency,
                      paidAt: new Date().toISOString(),
                    },
                  }))
                }
              />
            )}

            {/* Controls */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goTo(currentStep - 1)}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              {currentStep < PAYMENT_STEP && (
                <button
                  type="button"
                  onClick={handleNext}
                  id="wizard-continue-btn"
                  className="px-5 py-2.5 bg-[#006644] hover:bg-[#005538] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow flex items-center gap-2 transition-all"
                >
                  {currentStep === PAYMENT_STEP - 1 ? 'Continue to payment' : 'Save & Continue'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sidebar (hidden on the payment step, which has its own summary) */}
          {currentStep !== PAYMENT_STEP && (
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Application summary</div>
                <div className="border-b border-slate-100 pb-3">
                  <div className="font-bold text-sm text-slate-900">{selectedUni?.shortName ?? 'University not selected'}</div>
                  <div className="text-xs text-slate-500">
                    {form.degree}
                    {selectedUni && ` • ${selectedUni.city}`}
                  </div>
                  {selectedUni && <div className="text-xs text-[#006644] font-semibold mt-1">Tuition: {selectedUni.tuitionFee}</div>}
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <SummaryRow label="Applicant" value={form.fullName || '—'} />
                  <SummaryRow label="Citizenship" value={form.citizenshipCountry || '—'} />
                  <SummaryRow label="Bio / Chem avg" value={average != null ? `${average}%` : '—'} />
                  <SummaryRow
                    label="Exam session"
                    value={
                      form.examDate === EXAM_DECIDE_WITH_ADVISOR
                        ? 'With advisor'
                        : EXAM_SESSIONS.find((s) => s.date === form.examDate)?.label ?? '—'
                    }
                  />
                  <div className="flex justify-between">
                    <span>Onboarding fee</span>
                    <span className="font-bold text-[#006644]">€180 (paid at step 8)</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                  <img src={APP_IMAGES.elenaAdvisor} alt="Elena Dimitrova" className="w-9 h-9 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800">Elena Dimitrova</div>
                    <div className="text-[0.625rem] text-slate-500">Your Sofia legal advisor</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Opens a legal page in a new tab, so the applicant keeps their place in the form. */
const LegalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-[#006644] font-semibold underline">
    {children}
  </a>
);

const StepHeading: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="border-b border-slate-100 pb-4">
    <h2 className="text-lg font-bold font-heading text-slate-900">{title}</h2>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </div>
);

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
    <div className="text-slate-600">{children}</div>
  </div>
);

const ReviewCard: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-0.5 text-slate-600 min-w-0">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">{title}</span>
      <button type="button" onClick={onEdit} className="text-[0.6875rem] font-semibold text-[#006644] hover:underline inline-flex items-center gap-1">
        <Pencil className="w-3 h-3" /> Edit
      </button>
    </div>
    {children}
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3">
    <span>{label}</span>
    <span className="font-semibold text-slate-900 truncate">{value}</span>
  </div>
);
