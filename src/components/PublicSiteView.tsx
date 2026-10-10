import React, { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FolderLock,
  MapPin,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  UNIVERSITIES as SOURCES,
  SOURCE_REVIEW_DATE,
} from "../../shared/admissions.js";
import {
  AFTER_PAYMENT_STEPS,
  APP_IMAGES,
  FAQS,
  GATEWAY_EXCLUSIONS,
  GATEWAY_NAME,
  INDEPENDENCE_STATEMENT,
  ONBOARDING_FEE_EUR,
  ONBOARDING_INCLUSIONS,
  UNIVERSITIES,
} from "../data/constants";
import { AppView } from "../types";
import { formatLongDate } from "../lib/admissions";
import { pathFor, universityView } from "../lib/routes";

type Programme = "Medicine" | "Dentistry" | "Pharmacy";

interface PublicSiteViewProps {
  onNavigate: (view: AppView) => void;
  /** Opens the free eligibility check, optionally with a university already chosen. */
  onOpenQuickFit: (universityId?: string) => void;
}

/**
 * Decision-support wording only: geography plus what the official source says. No rankings or
 * "best for" claims — the university decides, and facts are checked against its own pages.
 */
const WORTH_COMPARING: Record<string, string> = {
  "mu-sofia":
    "Worth comparing if you want to study in the capital, Bulgaria’s largest city, and plan to look into its teaching-hospital network.",
  "mu-plovdiv":
    "Worth comparing if you want Bulgaria’s second-largest city and a published school-grade threshold you can check before applying.",
  "mu-varna":
    "Worth comparing if you’d prefer a city on the Black Sea coast.",
  "mu-pleven":
    "Worth comparing if you’d like a smaller city in northern Bulgaria, or you’re looking at a February start.",
};

const reviewDate = formatLongDate(new Date(`${SOURCE_REVIEW_DATE}T12:00:00`));

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ block: "start" });

const JOURNEY: {
  title: string;
  text: string;
  who: string;
  link?: { label: string; action: "quickfit" | "universities" | "gateway" | "calendar" };
}[] = [
  {
    title: "Check your situation",
    text: "Your passport country, where your school qualification comes from, and your science grades.",
    who: "Free check, on your own",
    link: { label: "Start the free check", action: "quickfit" },
  },
  {
    title: "Compare universities",
    text: "Four state medical universities, each with its own requirements and dates.",
    who: "You, with our comparison",
    link: { label: "Compare the four routes", action: "universities" },
  },
  {
    title: "Prepare documents",
    text: "Diploma and transcript first; legalisation and sworn translation depend on the issuing country.",
    who: "StudyBg helps plan this in the Gateway",
    link: { label: "See what the Gateway covers", action: "gateway" },
  },
  {
    title: "Prepare for entrance requirements",
    text: "Entrance tests and language evidence differ by university. Dates are published by each university.",
    who: "You, with the official calendar",
    link: { label: "Open the admissions calendar", action: "calendar" },
  },
  {
    title: "Apply and check visa requirements",
    text: "You submit to the university. Non-EU applicants check visa requirements with the authorities.",
    who: "You and the university; StudyBg explains the steps",
  },
  {
    title: "Plan arrival and enrollment",
    text: "Enrollment, housing and residence registration after admission.",
    who: "Discussed on your call. Arrival tools are planned, not live",
  },
];

export const PublicSiteView: React.FC<PublicSiteViewProps> = ({
  onNavigate,
  onOpenQuickFit,
}) => {
  const [programme, setProgramme] = useState<"All" | Programme>("All");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const routes = SOURCES.filter(
    (u) => programme === "All" || u.programs.includes(programme),
  ).map((source) => ({
    source,
    profile: UNIVERSITIES.find((u) => u.id === source.id),
  }));

  const runJourneyLink = (action: "quickfit" | "universities" | "gateway" | "calendar") => {
    if (action === "quickfit") onOpenQuickFit();
    else if (action === "calendar") onNavigate("calendar");
    else scrollTo(action === "universities" ? "universities-section" : "pricing-section");
  };

  return (
    <div className="bg-[#F8FAFC]">
      {/* ------------------------------------------------------------------ */}
      {/* Hero: one job — get the visitor to take the free check.              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f1e36] via-[#0b1c30] to-[#00281b] text-white pt-10 pb-16 sm:pt-14 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Independent admissions support · Medicine &amp; Dentistry</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold font-heading tracking-tight leading-[1.15]">
              Want to study medicine in Bulgaria?{" "}
              <span className="text-emerald-400">Find out where you stand first.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Thinking of studying Medicine or Dentistry in English at a
              Bulgarian medical university, but not sure which one may fit your
              situation? Start with a free preliminary check before deciding
              whether to use StudyBg.
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 pt-1">
              <button
                onClick={() => onOpenQuickFit()}
                className="min-h-11 px-6 py-3.5 bg-[#00a86b] hover:bg-[#00bf7a] text-[#04150f] font-bold rounded-xl shadow-lg transition-colors inline-flex items-center justify-center gap-2 text-sm"
                id="hero-quick-fit-btn"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Check your eligibility — Free</span>
              </button>
              <button
                onClick={() => scrollTo("pricing-section")}
                className="min-h-11 px-5 py-3.5 text-white font-semibold rounded-xl border border-white/25 hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2 text-sm"
                id="hero-gateway-btn"
              >
                <span>Explore the €{ONBOARDING_FEE_EUR} {GATEWAY_NAME}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-slate-300">
              5 questions · runs in your browser · no sign-up, no payment
            </p>
          </div>

          {/* What the free check actually does (mirrors QuickFitModal). */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/80 rounded-2xl border border-slate-700 p-6 shadow-2xl overflow-hidden">
              <div className="relative aspect-video bg-slate-900 -mx-6 -mt-6 mb-5">
                <img
                  src={APP_IMAGES.muSofia}
                  alt="Medical University of Sofia"
                  width={800}
                  height={450}
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3">
                  <span className="text-xs font-medium text-slate-100">Medical University of Sofia</span>
                </div>
              </div>
              <h2 className="font-heading font-bold text-base text-white">
                What the free check shows you
              </h2>
              <ol className="mt-4 space-y-3 text-sm text-slate-200">
                {[
                  "How your Biology and Chemistry grades compare with any threshold your chosen university publishes",
                  "Which parts of your situation still need checking, and why",
                  "Where your passport and school country change the document steps",
                  "A link to that university’s official requirements",
                ].map((line, i) => (
                  <li key={line} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-slate-400 border-t border-slate-700 pt-3">
                Preliminary guidance only. Universities make admission decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Why StudyBg                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="why-section"
        aria-labelledby="why-title"
        className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <h2 id="why-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
          Why StudyBg?
        </h2>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Four universities, four sets of rules, documents from your own country,
          and deadlines that don’t line up. Here’s where we help.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[
            {
              icon: Scale,
              title: "Compare the four routes",
              text: "See each university side by side, with a link to its official admissions page and the date we last checked it.",
            },
            {
              icon: ClipboardCheck,
              title: "Understand what they’ll ask for",
              text: "Get an independent read of the qualification and document requirements for your situation, in plain language.",
            },
            {
              icon: FolderLock,
              title: "Keep everything in one place",
              text: "Your application, documents and our review notes live in your StudyBg account, not scattered across emails.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-5">
              <Icon className="w-6 h-6 text-[#006644]" aria-hidden="true" />
              <h3 className="font-heading font-bold text-slate-900 mt-3">{title}</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <strong>You can apply directly to each university.</strong> StudyBg is
          an independent service for applicants who want structured guidance and
          support.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* University comparison (stacked cards; no horizontal table)           */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="universities-section"
        aria-labelledby="universities-title"
        className="py-14 bg-slate-100/70 border-y border-slate-200 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <h2 id="universities-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
                Compare the four medical universities
              </h2>
              <p className="text-slate-600 mt-2 max-w-3xl text-sm sm:text-base">
                Requirements are set by each university and change between
                years. Each card links to the official page it’s based on. The
                university makes the final decision.
              </p>
            </div>
            <div
              role="group"
              aria-label="Show universities offering"
              className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start"
            >
              {(["All", "Medicine", "Dentistry", "Pharmacy"] as const).map((p) => (
                <button
                  key={p}
                  aria-pressed={programme === p}
                  onClick={() => setProgramme(p)}
                  className={`min-h-11 px-3.5 rounded-lg text-sm font-semibold transition-colors ${
                    programme === p
                      ? "bg-[#006644] text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {routes.map(({ source, profile }) => (
              <li key={source.id} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col gap-4 overflow-hidden">
                {profile && (
                  <div className="relative aspect-video overflow-hidden bg-slate-900 -mx-5 -mt-5 sm:-mx-6 sm:-mt-6">
                    <img
                      src={profile.image}
                      alt={source.name}
                      width={800}
                      height={450}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-[#0f1e36]/90 text-white text-xs font-semibold px-3 py-1 rounded-lg border border-slate-700">
                      {profile.city.replace(/\s*\(.*\)$/, "")}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    <a href={pathFor(universityView(source.id))} className="hover:text-[#006644] hover:underline underline-offset-2">
                      {source.name}
                    </a>
                  </h3>
                  {profile && (
                    <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      {profile.city.replace(/\s*\(.*\)$/, "")}
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="font-semibold text-slate-900">Programmes</dt>
                  <dd className="text-slate-700">
                    {source.programs.join(", ")}{" "}
                    <span className="text-slate-500">(confirm language and places for your citizenship)</span>
                  </dd>
                  <dt className="font-semibold text-slate-900">Published rule</dt>
                  <dd className="text-slate-700">{source.rule}</dd>
                  <dt className="font-semibold text-slate-900">Tuition</dt>
                  <dd className="text-slate-700">Confirm on the official page</dd>
                </dl>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">
                  {WORTH_COMPARING[source.id]}
                </p>
                <div className="mt-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <button
                    onClick={() => onOpenQuickFit(source.id)}
                    className="min-h-11 px-4 bg-[#006644] hover:bg-[#005538] text-white font-semibold rounded-xl text-sm inline-flex items-center justify-center gap-1.5"
                  >
                    Check my fit for {profile?.shortName ?? source.name}
                  </button>
                  <a
                    href={pathFor(universityView(source.id))}
                    className="min-h-11 inline-flex items-center text-sm font-semibold text-[#006644] underline underline-offset-2"
                  >
                    Requirements &amp; deadlines
                    <span className="sr-only"> for {source.name}</span>
                  </a>
                  <a
                    href={source.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-[#006644] underline underline-offset-2"
                  >
                    Official page
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
                <p className="text-xs text-slate-500">Last checked: {reviewDate}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Six steps                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="six-stages-section"
        aria-labelledby="journey-title"
        className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <h2 id="journey-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
          How it works, in six steps
        </h2>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Who does what, so there are no surprises. Want the detail first? Read
          our step-by-step{" "}
          <a href={pathFor("guide")} className="font-semibold text-[#006644] underline underline-offset-2">
            guide to studying medicine in Bulgaria in English
          </a>
          .
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {JOURNEY.map((step, i) => (
            <li key={step.title} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#006644] font-bold text-sm flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <h3 className="font-heading font-bold text-slate-900">{step.title}</h3>
              </div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.text}</p>
              <p className="text-xs font-semibold text-slate-500 mt-2">{step.who}</p>
              {step.link && (
                <button
                  onClick={() => runJourneyLink(step.link!.action)}
                  className="mt-auto pt-2 min-h-11 self-start text-sm font-semibold text-[#006644] underline underline-offset-2 inline-flex items-center gap-1"
                >
                  {step.link.label}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The €180 Admissions Gateway: price, contents, after-payment, exclusions */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="pricing-section"
        aria-labelledby="gateway-title"
        className="py-14 bg-white border-y border-slate-200 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <h2 id="gateway-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
            The {GATEWAY_NAME}: €{ONBOARDING_FEE_EUR}, once
          </h2>
          <p className="text-slate-600 mt-2 max-w-3xl">
            For when you’ve decided on Bulgaria and want someone independent to
            go through your file with you. One payment, no subscription.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
            <div className="lg:col-span-7 rounded-2xl bg-gradient-to-b from-[#0f1e36] to-[#00281b] text-white p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl sm:text-5xl font-extrabold font-heading text-emerald-400">
                  €{ONBOARDING_FEE_EUR}
                </span>
                <span className="text-slate-300 text-sm">one-time fee, taxes included</span>
              </div>
              <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-emerald-300">
                What’s included
              </h3>
              <ul className="mt-3 space-y-3 text-sm text-slate-200">
                {ONBOARDING_INCLUSIONS.map((item) => (
                  <li key={item.title} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      <strong className="text-white">{item.title}.</strong> {item.detail}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-emerald-300">
                After you pay
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-200 list-decimal pl-5">
                {AFTER_PAYMENT_STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={() => onNavigate("wizard")}
                  id="gateway-start-btn"
                  className="shrink-0 whitespace-nowrap min-h-11 px-5 py-3 bg-[#00a86b] hover:bg-[#00bf7a] text-[#04150f] font-bold rounded-xl text-sm inline-flex items-center justify-center gap-2"
                >
                  Start my application
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <p className="text-sm text-slate-300">
                  You fill in 7 short steps first. Payment is the last step, after
                  you’ve reviewed everything.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 p-6">
                <h3 className="font-heading font-bold text-slate-900">Not included in the €{ONBOARDING_FEE_EUR}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Paid to the organisations concerned. If we help arrange one of
                  these, we tell you the cost before you agree to it.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {GATEWAY_EXCLUSIONS.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 space-y-3">
                <p className="flex gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#006644] shrink-0" aria-hidden="true" />
                  <span>{INDEPENDENCE_STATEMENT}</span>
                </p>
                <p>
                  Full details are in our{" "}
                  <a
                    href="/terms/"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("terms");
                    }}
                    className="font-semibold text-[#006644] underline"
                  >
                    Terms &amp; Conditions
                  </a>
                  , including your 14-day withdrawal right.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="faqs-section"
        aria-labelledby="faq-title"
        className="py-14 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
            Questions people ask before they start
          </h2>
          <div className="space-y-3 mt-6">
            {FAQS.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div key={faq.q} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <h3>
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${index}`}
                      className="w-full min-h-11 text-left p-4 sm:p-5 flex items-center justify-between gap-4"
                    >
                      <span className="font-heading font-bold text-sm sm:text-base text-slate-900">{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? "rotate-180 text-[#006644]" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  {/* Always in the page (hidden when closed), so search engines and AI tools can read every answer. */}
                  <div id={`faq-${index}`} hidden={!isOpen} className="px-4 sm:px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing call to action: same single primary action as the hero.      */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-4xl mx-auto rounded-2xl bg-[#0f1e36] text-white p-6 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading">
            Still deciding? Start with the free check.
          </h2>
          <p className="text-slate-300 mt-2 max-w-2xl mx-auto">
            Five questions, a clear list of what’s ready and what needs
            checking, and a link to the official requirements. Then decide if
            you want our help.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onOpenQuickFit()}
              className="min-h-11 w-full sm:w-auto px-6 py-3 bg-[#00a86b] hover:bg-[#00bf7a] text-[#04150f] font-bold rounded-xl text-sm inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Check your eligibility — Free
            </button>
            <button
              onClick={() => onNavigate("calendar")}
              className="min-h-11 w-full sm:w-auto px-5 py-3 border border-white/25 hover:bg-white/10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              Admissions calendar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

