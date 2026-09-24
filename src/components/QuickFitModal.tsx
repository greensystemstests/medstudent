import React, { useRef, useState } from 'react';
import { X, CheckCircle2, AlertCircle, ArrowRight, Sparkles, BookOpen, ShieldCheck, HelpCircle } from 'lucide-react';
import { MIN_SCIENCE_GRADE, UNIVERSITIES } from '../data/constants';
import { useDialogFocus } from '../lib/useDialogFocus';

interface QuickFitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartApplication: (prefill: {
    curriculum: string;
    citizenship: string;
    biology: number;
    chemistry: number;
    selectedUniversityId: string;
  }) => void;
}

export const QuickFitModal: React.FC<QuickFitModalProps> = ({ isOpen, onClose, onStartApplication }) => {
  const [curriculum, setCurriculum] = useState('tawjihi');
  const [citizenship, setCitizenship] = useState('Jordan');
  const [biology, setBiology] = useState(88);
  const [chemistry, setChemistry] = useState(84);
  const [englishLevel, setEnglishLevel] = useState('fluent');
  const [selectedUniversity, setSelectedUniversity] = useState('mu-sofia');
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, isOpen, onClose);

  if (!isOpen) return null;

  const averageScience = Math.round((Number(biology) + Number(chemistry)) / 2);
  // Same rule the application enforces: at least MIN_SCIENCE_GRADE in BOTH subjects.
  const isEligible = biology >= MIN_SCIENCE_GRADE && chemistry >= MIN_SCIENCE_GRADE;
  const isCompetitive = averageScience >= 78;

  const getApostilleNote = () => {
    if (citizenship === 'Jordan') {
      return 'Jordan joined the Hague Apostille Convention in 2023! Your Tawjihi diploma only requires Apostille from Jordan Ministry of Foreign Affairs (MOFA), bypassing lengthy consular legalization.';
    }
    if (citizenship === 'United Kingdom') {
      return 'UK FCDO Legalisation Office provides Hague Apostille on certified GCSE / A-Level Certificates.';
    }
    if (citizenship === 'Germany' || citizenship === 'Greece' || citizenship === 'Italy' || citizenship === 'Sweden') {
      return 'EU Candidate: Simplified admission under EU Directive 2005/36/EC. No Type-D student visa required.';
    }
    return 'Non-EU candidate: High school diploma requires Hague Apostille from originating country, sworn Bulgarian translation in Sofia, and Bulgarian MOES Certificate for Type-D Visa.';
  };

  const handleApply = () => {
    onStartApplication({
      curriculum,
      citizenship,
      biology,
      chemistry,
      selectedUniversityId: selectedUniversity,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickfit-title"
        aria-describedby="quickfit-desc"
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f1e36] to-[#006644] text-white p-6 relative">
          <button
            onClick={onClose}
            aria-label="Close eligibility calculator"
            className="absolute top-5 right-5 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-emerald-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Admission Pre-Checker</span>
          </div>
          <h2 id="quickfit-title" className="text-xl sm:text-2xl font-bold font-heading">
            Quick Fit Eligibility Calculator
          </h2>
          <p id="quickfit-desc" className="text-sm text-slate-200 mt-1">
            Determine your Bulgarian MOES qualification status and Science score threshold instantly.
          </p>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Country & Curriculum Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quickfit-country" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Country of High School / Passport
              </label>
              <select
                id="quickfit-country"
                value={citizenship}
                onChange={(e) => setCitizenship(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#006644] focus:ring-1 focus:ring-[#006644] outline-none"
              >
                <option value="Jordan">Jordan (Hashemite Kingdom)</option>
                <option value="United Kingdom">United Kingdom (UK)</option>
                <option value="Germany">Germany (EU)</option>
                <option value="United Arab Emirates">United Arab Emirates (UAE)</option>
                <option value="Saudi Arabia">Saudi Arabia (KSA)</option>
                <option value="Lebanon">Lebanon</option>
                <option value="Egypt">Egypt</option>
                <option value="India">India</option>
                <option value="Nigeria">Nigeria</option>
                <option value="United States">United States</option>
                <option value="Other">Other Non-EU / EU Country</option>
              </select>
            </div>

            <div>
              <label htmlFor="quickfit-curriculum" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                High School Diploma Type
              </label>
              <select
                id="quickfit-curriculum"
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#006644] focus:ring-1 focus:ring-[#006644] outline-none"
              >
                <option value="tawjihi">Jordanian Tawjihi (Scientific Stream)</option>
                <option value="a_levels">British A-Levels / Cambridge</option>
                <option value="ib">International Baccalaureate (IB)</option>
                <option value="american_diploma">American High School Diploma (with AP/SAT II)</option>
                <option value="national_curriculum">Other National Secondary School Certificate</option>
              </select>
            </div>
          </div>

          {/* Sliders for Biology & Chemistry */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#006644]" />
                Bulgarian MOES Prerequisite: Minimum 62% in Bio + Chem
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Avg: {averageScience}%
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <label htmlFor="quickfit-biology">Biology Score</label>
                  <span className="font-bold text-[#006644]">{biology}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  id="quickfit-biology"
                  aria-valuetext={`${biology}%`}
                  value={biology}
                  onChange={(e) => setBiology(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#006644]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <label htmlFor="quickfit-chemistry">Chemistry Score</label>
                  <span className="font-bold text-[#006644]">{chemistry}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  id="quickfit-chemistry"
                  aria-valuetext={`${chemistry}%`}
                  value={chemistry}
                  onChange={(e) => setChemistry(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#006644]"
                />
              </div>
            </div>
          </div>

          {/* Preferred Medical Faculty */}
          <div>
            <span id="quickfit-uni-label" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Target Bulgarian University
            </span>
            <div role="group" aria-labelledby="quickfit-uni-label" className="grid grid-cols-2 gap-2">
              {UNIVERSITIES.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUniversity(u.id)}
                  aria-pressed={selectedUniversity === u.id}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedUniversity === u.id
                      ? 'border-[#006644] bg-emerald-50/70 text-[#006644] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">{u.shortName}</div>
                  <div className="text-[0.6875rem] text-slate-500">{u.city}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Eligibility Result Banner */}
          <div
            aria-live="polite"
            className={`p-4 rounded-xl border ${
              isEligible
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {isEligible ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm">
                  {isEligible
                    ? isCompetitive
                      ? 'High Admission Probability (Exceeds Competitive Threshold)'
                      : 'MOES Requirement Satisfied (≥62% in Biology and Chemistry)'
                    : 'Below the 62% Minimum in Biology or Chemistry - Consult an Advisor About a Preparatory Route'}
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {getApostilleNote()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official MOES Legal Compliance Audit</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#006644] hover:bg-[#005538] shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span>Transfer to 8-Step Gateway</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
