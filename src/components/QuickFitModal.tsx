import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, ExternalLink, X } from "lucide-react";
import { UNIVERSITIES, preliminaryResult } from "../../shared/admissions.js";
import { useDialogFocus } from "../lib/useDialogFocus";
import { WizardPrefill } from "../lib/application";
import { MIN_SCIENCE_GRADE } from "../data/constants";

interface Props {
  isOpen: boolean;
  initialUniversityId?: string;
  onClose: () => void;
  onStartApplication: (prefill: WizardPrefill) => void;
}

type Level = "ready" | "info" | "verify" | "review";
interface Factor {
  level: Level;
  title: string;
  detail: string;
}

const LEVEL: Record<Level, { label: string; icon: React.ElementType; tone: string }> = {
  ready: { label: "Ready to discuss", icon: CheckCircle2, tone: "text-emerald-700" },
  info: { label: "Needs more information", icon: AlertCircle, tone: "text-amber-700" },
  verify: { label: "Requirements to verify", icon: CircleHelp, tone: "text-sky-700" },
  review: { label: "Needs review", icon: AlertCircle, tone: "text-amber-700" },
};

const inRange = (v: string) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

/** Explainable, route-specific factors. Never an admission prediction. */
function assess(universityId: string, citizenship: string, schoolCountry: string, biology: string, chemistry: string): Factor[] {
  const uni = UNIVERSITIES.find((u) => u.id === universityId)!;
  const factors: Factor[] = [];
  if (!inRange(biology) || !inRange(chemistry)) {
    factors.push({
      level: "info",
      title: "Science grades",
      detail: "Enter your Biology and Chemistry grades as percentages (0–100).",
    });
  } else if (uni.id === "mu-plovdiv") {
    const avg = (Number(biology) + Number(chemistry)) / 2;
    factors.push({
      level: avg >= MIN_SCIENCE_GRADE ? "ready" : "review",
      title: `Science average: ${Math.round(avg * 10) / 10}%`,
      detail: preliminaryResult(uni.id, biology, chemistry),
    });
  } else {
    factors.push({
      level: "verify",
      title: "Science grades",
      detail: `${uni.name} doesn’t publish a single grade threshold we can check here. ${uni.rule}`,
    });
  }
  factors.push(
    schoolCountry.trim()
      ? {
          level: "verify",
          title: `School documents from ${schoolCountry.trim()}`,
          detail: "The legalisation and translation steps depend on the country that issued your school qualification.",
        }
      : {
          level: "info",
          title: "School country",
          detail: "Tell us which country issued your school qualification. It decides the document steps.",
        },
  );
  factors.push(
    citizenship.trim()
      ? {
          level: "verify",
          title: `Citizenship: ${citizenship.trim()}`,
          detail: "Visa and residence requirements depend on your citizenship and are decided by the authorities.",
        }
      : {
          level: "info",
          title: "Passport country",
          detail: "Tell us your passport country. It affects visa planning and some university routes.",
        },
  );
  return factors;
}

/** Missing answers first, then anything below a published threshold; otherwise ready to talk it through. */
function overall(factors: Factor[]): Level {
  if (factors.some((f) => f.level === "info")) return "info";
  if (factors.some((f) => f.level === "review")) return "review";
  return "ready";
}

export function QuickFitModal({ isOpen, initialUniversityId, onClose, onStartApplication }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, isOpen, onClose);
  const [schoolCountry, setSchoolCountry] = useState(""),
    [citizenship, setCitizenship] = useState(""),
    [biology, setBiology] = useState(""),
    [chemistry, setChemistry] = useState(""),
    [university, setUniversity] = useState(initialUniversityId ?? "mu-sofia");
  useEffect(() => {
    if (isOpen && initialUniversityId) setUniversity(initialUniversityId);
  }, [isOpen, initialUniversityId]);
  if (!isOpen) return null;

  const uni = UNIVERSITIES.find((u) => u.id === university)!;
  const gradesEntered = inRange(biology) && inRange(chemistry);
  const factors = assess(university, citizenship, schoolCountry, biology, chemistry);
  const summary = LEVEL[overall(factors)];
  const SummaryIcon = summary.icon;
  const field = "w-full border border-slate-300 rounded-lg px-3 py-2.5 mt-1 bg-white text-base";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 p-3 sm:p-4 overflow-auto flex items-start sm:items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickfit-title"
        aria-describedby="quickfit-desc"
        className="bg-white rounded-2xl w-full max-w-xl shadow-xl"
      >
        <div className="bg-[#0f1e36] text-white p-5 sm:p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Close Quick Fit"
          >
            <X aria-hidden="true" />
          </button>
          <h2 id="quickfit-title" className="text-xl sm:text-2xl font-bold pr-12">
            Free eligibility check
          </h2>
          <p id="quickfit-desc" className="text-sm mt-2 text-slate-200">
            Five questions, answered in your browser. Nothing is sent to StudyBg.
            This is preliminary guidance, not an admission decision.
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <label className="block text-sm font-medium text-slate-800" htmlFor="quickfit-university">
            University you’re interested in
          </label>
          <select
            id="quickfit-university"
            className={field + " !mt-1"}
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
          >
            {UNIVERSITIES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-slate-800">
              Passport country
              <input className={field} autoComplete="country-name" value={citizenship} onChange={(e) => setCitizenship(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Country issuing your school qualification
              <input className={field} value={schoolCountry} onChange={(e) => setSchoolCountry(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-slate-800" htmlFor="quickfit-biology">
              Biology (%)
              <input id="quickfit-biology" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={biology} onChange={(e) => setBiology(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-medium text-slate-800" htmlFor="quickfit-chemistry">
              Chemistry (%)
              <input id="quickfit-chemistry" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={chemistry} onChange={(e) => setChemistry(e.target.value)} className={field} />
            </label>
          </div>

          <section aria-labelledby="quickfit-result-title" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 id="quickfit-result-title" className="sr-only">
              Your preliminary result
            </h3>
            <p role="status" className={`font-bold flex items-center gap-2 ${summary.tone}`}>
              <SummaryIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              {summary.label}
            </p>
            {overall(factors) === "ready" && (
              <p className="text-sm text-slate-700 mt-1">
                You have enough for an adviser to go through your situation. It
                doesn’t mean you’re eligible: the points below still need
                checking against the official requirements.
              </p>
            )}
            <ul className="mt-3 space-y-2.5 text-sm">
              {factors.map((f) => {
                const L = LEVEL[f.level];
                const Icon = L.icon;
                return (
                  <li key={f.title} className="flex gap-2">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${L.tone}`} aria-hidden="true" />
                    <span>
                      <strong className="text-slate-900">{f.title}</strong>{" "}
                      <span className="sr-only">({L.label}).</span>
                      <span className="text-slate-700">{f.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <a
              className="mt-3 min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-[#006644] underline"
              href={uni.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official requirements: {uni.name}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </section>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <button
              disabled={!gradesEntered}
              onClick={() => {
                onStartApplication({
                  schoolCountry,
                  citizenship,
                  biology: Number(biology),
                  chemistry: Number(chemistry),
                  selectedUniversityId: university,
                });
                onClose();
              }}
              className="block w-full min-h-11 bg-[#006644] hover:bg-[#005538] text-white font-semibold p-3 rounded-xl disabled:opacity-50"
            >
              Continue to the application
            </button>
            <p className="text-xs text-slate-600">
              {gradesEntered
                ? "Your answers carry over to the application, saved on this device. Filling it in is free; the €180 Admissions Gateway is only charged at the final step, after you’ve reviewed it."
                : "Enter both grades to continue to the application. You can also just close this and read the official page."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
