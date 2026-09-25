import React, { useRef, useState } from "react";
import { X } from "lucide-react";
import { UNIVERSITIES, preliminaryResult } from "../../shared/admissions.js";
import { useDialogFocus } from "../lib/useDialogFocus";
import { WizardPrefill } from "../lib/application";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStartApplication: (prefill: WizardPrefill) => void;
}
export function QuickFitModal({ isOpen, onClose, onStartApplication }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, isOpen, onClose);
  const [schoolCountry, setSchoolCountry] = useState(""),
    [citizenship, setCitizenship] = useState(""),
    [biology, setBiology] = useState(""),
    [chemistry, setChemistry] = useState(""),
    [university, setUniversity] = useState("mu-sofia");
  if (!isOpen) return null;
  const valid =
    biology !== "" &&
    chemistry !== "" &&
    [Number(biology), Number(chemistry)].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    );
  const field = "w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white";
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 overflow-auto flex items-start sm:items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickfit-title"
        aria-describedby="quickfit-desc"
        className="bg-white rounded-2xl w-full max-w-xl shadow-xl"
      >
        <div className="bg-[#0f1e36] text-white p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2"
            aria-label="Close Quick Fit"
          >
            <X />
          </button>
          <h2 id="quickfit-title" className="text-2xl font-bold pr-10">
            Quick Fit
          </h2>
          <p id="quickfit-desc" className="text-sm mt-2">
            Prepare for an admissions review. This is preliminary guidance, not
            an admission decision.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <label className="block text-sm">
            Country of passport
            <input
              className={field}
              value={citizenship}
              onChange={(e) => setCitizenship(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Country issuing your school qualification
            <input
              className={field}
              value={schoolCountry}
              onChange={(e) => setSchoolCountry(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            University
            <select
              className={field}
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            >
              {UNIVERSITIES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              Biology (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={biology}
                onChange={(e) => setBiology(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              Chemistry (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={chemistry}
                onChange={(e) => setChemistry(e.target.value)}
                className={field}
              />
            </label>
          </div>
          <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm">
            {preliminaryResult(university, biology, chemistry)}
          </p>
          <a
            className="underline text-sm text-[#006644]"
            href={UNIVERSITIES.find((u) => u.id === university)?.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read official university requirements ↗
          </a>
          <p className="text-xs text-slate-600">
            Legalization depends on the country issuing the document. Your
            nationality and school country may be different.
          </p>
          <button
            disabled={!valid}
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
            className="block w-full bg-[#006644] text-white p-3 rounded-xl disabled:opacity-50"
          >
            Continue to application
          </button>
        </div>
      </div>
    </div>
  );
}
