import React, { useState } from "react";
import { StudyBgLogo } from "./StudyBgLogo";
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  FileText,
  Calendar,
  ChevronRight,
  GraduationCap,
  Euro,
  Building2,
  Award,
  Globe,
  AlertTriangle,
  HelpCircle,
  Stethoscope,
  ChevronDown,
  Plane,
  FileCheck,
  Search,
} from "lucide-react";
import {
  UNIVERSITIES,
  FAQS,
  APP_IMAGES,
  ONBOARDING_INCLUSIONS,
} from "../data/constants";
import { AppView, University } from "../types";
import {
  formatLongDate,
  intakeYearLabel,
  universityDeadline,
} from "../lib/admissions";
import { scrollBehavior } from "../lib/a11y";

interface PublicSiteViewProps {
  onNavigate: (view: AppView) => void;
  onOpenQuickFit: () => void;
  onSelectUniversity: (
    uniId: string,
    degree?: "Medicine" | "Dentistry" | "Pharmacy",
  ) => void;
}

export const PublicSiteView: React.FC<PublicSiteViewProps> = ({
  onNavigate,
  onOpenQuickFit,
  onSelectUniversity,
}) => {
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<
    "All" | "Medicine" | "Dentistry" | "Pharmacy"
  >("All");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const filteredUniversities =
    selectedProgramFilter === "All"
      ? UNIVERSITIES
      : UNIVERSITIES.filter((u) =>
          u.programs.includes(selectedProgramFilter as any),
        );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f1e36] via-[#0b1c30] to-[#00281b] text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Subtle background overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline, Subtitle, CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold tracking-wide">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>INDEPENDENT ADMISSIONS SUPPORT</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight leading-[1.15]">
                Study Medicine & Dentistry in Bulgaria —{" "}
                <span className="text-emerald-400">
                  English-taught programmes
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed font-normal">
                Compare universities, prepare your documents and request an
                admissions consultation. StudyBg is an independent service.
                Admission, visas and professional registration are decided by
                the relevant institutions.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onNavigate("wizard")}
                  className="px-6 py-3.5 bg-[#006644] hover:bg-[#007a52] text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-900/40 transition-all flex items-center gap-2 text-sm"
                  id="hero-apply-btn"
                >
                  <span>Start 8-Step Application (€180)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onOpenQuickFit}
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all flex items-center gap-2 text-sm"
                  id="hero-quick-fit-btn"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Check My Eligibility (Free)</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="pt-4 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>University-specific requirements</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Check professional registration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Review official admission guides</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Clear onboarding fee</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card with Verified Metrics */}
            <div className="lg:col-span-5">
              <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-2xl border border-slate-700 p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <StudyBgLogo
                      variant="mark"
                      size="md"
                      className="p-0.5 bg-slate-900/80 rounded-lg border border-slate-700"
                    />
                    <div>
                      <div className="font-heading font-bold text-sm text-white flex items-center gap-1.5">
                        <span>StudyBg Admissions Snapshot</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Admission planning
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                    Dates require confirmation
                  </span>
                </div>

                {/* Hero Graphic */}
                <div className="mt-4 relative rounded-xl overflow-hidden aspect-video border border-slate-700">
                  <img
                    src={APP_IMAGES.muSofia}
                    alt="Medical University Rectorate"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                    <span className="text-xs font-medium text-slate-200">
                      University illustration
                    </span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Annual Tuition</div>
                    <div className="text-xl font-extrabold text-emerald-400 font-heading">
                      Varies by degree
                    </div>
                    <div className="text-[0.6875rem] text-slate-500">
                      See the official tuition schedule
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">
                      University options
                    </div>
                    <div className="text-xl font-extrabold text-white font-heading">
                      4 universities
                    </div>
                    <div className="text-[0.6875rem] text-slate-500">
                      Across 4 medical faculties
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Visa planning</div>
                    <div className="text-xl font-extrabold text-sky-400 font-heading">
                      Case by case
                    </div>
                    <div className="text-[0.6875rem] text-slate-500">
                      For non-EU candidates
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Onboarding Fee</div>
                    <div className="text-xl font-extrabold text-amber-400 font-heading">
                      €180 Flat
                    </div>
                    <div className="text-[0.6875rem] text-slate-500">
                      Includes consultation request
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access Strip */}
      <div className="bg-white border-b border-slate-200 py-4 px-4 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar
              className="w-5 h-5 text-[#006644] shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-800">
              Application windows vary by university and applicant route.
            </span>
          </div>
          <button
            onClick={() => onNavigate("calendar")}
            className="text-xs font-semibold text-[#006644] hover:underline flex items-center gap-1 py-1"
          >
            <span>View official admissions calendar</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The 6-Stage Journey Section */}
      <section
        id="six-stages-section"
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#006644] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            End-to-End Structured Process
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900 mt-3">
            The 6-Stage Bulgarian Medical Journey
          </h2>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            From your secondary school certificate in your home country to
            continuous residency and clinical graduation in Bulgaria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Stage 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                01
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                1–3 Days
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Eligibility & Science GPA Audit
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We review your qualification against the selected university’s
              published requirements. For Plovdiv, the published 2026/27
              school-science threshold uses the Biology and Chemistry average;
              other routes differ.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                02
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                2–3 Weeks
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Hague Apostille & Sworn Sofia Legalization
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Assisting with MOFA Hague Apostille verification in your home
              country, certified sworn translation into Bulgarian in Sofia, and
              physical filing at MOES.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                03
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                Online / In Sofia
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Entrance Exam & Academic Ranking
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Multiple-choice exam in Biology & Chemistry (plus English test if
              non-native). Access comprehensive past exam question banks and
              proctored mock testing.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                04
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                4–6 Weeks
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              MOES Certificate & Type-D Visa
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sofia Ministry issues the Certificate of Academic Admission.
              Non-EU candidates lodge their Bulgarian Long-Stay Type-D visa
              application with our consular dossier.
            </p>
          </div>

          {/* Stage 5 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                05
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                Arrival & Matriculation
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              On-Campus Enrollment & Housing
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              In-person registration at the Dean’s Office, student ID and
              library card issuance, local SIM card, student bank account, and
              certified housing contracts.
            </p>
          </div>

          {/* Stage 6 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center font-heading">
                06
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                All 6 Years
              </span>
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Planning beyond admission
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Discuss relocation and renewal responsibilities with your advisor.
              Automated renewal reminders and appointment booking are planned
              features; the portal preview is a demo.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Medical Universities Showcase */}
      <section
        id="universities-section"
        className="py-16 bg-slate-100/70 border-y border-slate-200 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#006644] bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">
                Independent State Institutions
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900 mt-2">
                Bulgaria’s 4 Premier Medical Faculties
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                State universities offering 6-year Master of Medicine and
                5.5-year Dental programs in English.
              </p>
            </div>

            {/* Filter Pills */}
            <div
              role="group"
              aria-label="Filter universities by program"
              className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs"
            >
              {(["All", "Medicine", "Dentistry", "Pharmacy"] as const).map(
                (prog) => (
                  <button
                    key={prog}
                    aria-pressed={selectedProgramFilter === prog}
                    onClick={() => setSelectedProgramFilter(prog)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedProgramFilter === prog
                        ? "bg-[#006644] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {prog}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Grid of Universities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredUniversities.map((uni) => (
              <div
                key={uni.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col"
              >
                {/* Image and badges */}
                <div className="relative aspect-16/9 overflow-hidden bg-slate-900">
                  <img
                    src={uni.image}
                    alt={uni.name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-[#0f1e36]/90 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1 rounded-lg border border-slate-700">
                    {uni.city}
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-lg">
                    <span className="text-xs text-emerald-300 font-semibold">
                      {uni.badge}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3 className="font-heading font-bold text-lg text-slate-900">
                        {uni.name}
                      </h3>
                      <span className="text-xs font-extrabold text-[#006644] bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                        {uni.tuitionFee}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      {uni.description}
                    </p>

                    {/* Strengths */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      {uni.strengths.map((str, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-slate-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata key details */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3 text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-900">
                        Seats:
                      </span>{" "}
                      {uni.intakeSeats}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">
                        Deadline:
                      </span>{" "}
                      {universityDeadline(uni)}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        onSelectUniversity(
                          uni.id,
                          selectedProgramFilter === "All"
                            ? undefined
                            : selectedProgramFilter,
                        );
                        onNavigate("wizard");
                      }}
                      className="flex-1 py-2.5 px-4 bg-[#006644] hover:bg-[#005538] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span>Apply to {uni.shortName}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={onOpenQuickFit}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                    >
                      Check GPA
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing & Ethical Agency Comparison Section */}
      <section
        id="pricing-section"
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#006644] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Ethical Direct Admissions
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900 mt-3">
            Your €180 onboarding package
          </h2>
          <p className="text-slate-600 mt-2 text-sm">
            Review the included service and separate third-party costs before
            choosing a package. Admission and visa outcomes are not guaranteed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* StudyBg Plan */}
          <div className="lg:col-span-6 bg-gradient-to-b from-[#0f1e36] to-[#00281b] text-white rounded-2xl p-8 border border-emerald-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#006644] text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl">
              Independent advisory service
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-heading font-bold text-xl">
                  StudyBg Direct Admissions & Portal
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl sm:text-5xl font-extrabold font-heading text-emerald-400">
                  €180
                </span>
                <span className="text-slate-300 text-sm">
                  One-Time Onboarding Fee
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Covers an application review, a consultation request and your
                application workspace. University and third-party charges are
                separate.
              </p>

              <div className="space-y-3 text-xs text-slate-200">
                {ONBOARDING_INCLUSIONS.map((item) => (
                  <div key={item.title} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>{item.title}:</strong> {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => onNavigate("wizard")}
                className="w-full py-3.5 px-4 bg-[#006644] hover:bg-[#007a52] text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <span>Enroll in Gateway for €180</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Traditional Predatory Agencies */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-8 border border-slate-200 shadow-xs flex flex-col justify-between text-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-2 text-rose-600 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Plan your total budget</span>
              </div>
              <h3 className="font-heading font-bold text-xl text-slate-900 mb-1">
                Costs outside the onboarding fee
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-500">
                  Quoted separately
                </span>
                <span className="text-rose-600 font-semibold text-xs">
                  Third-party charges
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Ask for a written quote before ordering additional services. The
                €180 fee does not include the costs listed below.
              </p>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </span>
                  <span>
                    <strong>University charges:</strong> Tuition, entrance
                    examinations and university application fees.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </span>
                  <span>
                    <strong>Document preparation:</strong> Translation,
                    certification, legalization and courier charges.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </span>
                  <span>
                    <strong>Living expenses:</strong> Housing, travel, insurance
                    and day-to-day costs.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </span>
                  <span>
                    <strong>Immigration costs:</strong> Visa, residence permit
                    and any separately agreed professional services.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 mt-6">
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                💡 <strong>Your choice:</strong> You can also review and use
                each university’s own application process. StudyBg does not
                claim exclusive or official representative status.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section
        id="faqs-section"
        className="py-16 bg-slate-50 border-t border-slate-200 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#006644] bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200">
              Clear Answers
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 mt-2">
              Frequently Asked Questions & Non-EU Regulations
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : index)}
                    className="w-full text-left p-4.5 sm:p-5 flex items-center justify-between gap-4 focus:outline-none"
                  >
                    <span className="font-heading font-bold text-sm text-slate-900">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[#006644]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
