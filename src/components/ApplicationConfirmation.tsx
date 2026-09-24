import React from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, FileCheck2, FolderUp, Home, Mail, Receipt, Truck, UserCheck, Video } from 'lucide-react';
import { APP_IMAGES, EXAM_DECIDE_WITH_ADVISOR, UNIVERSITIES } from '../data/constants';
import { examSessionLabel } from '../lib/admissions';
import { formatDay } from '../lib/application';
import { ApplicationState, AppView } from '../types';
import { formatMoney } from './PaymentStep';

interface Props {
  app: ApplicationState;
  demoMode: boolean;
  onNavigate: (view: AppView) => void;
  onStartNewApplication: () => void;
}

export const ApplicationConfirmation: React.FC<Props> = ({ app, demoMode, onNavigate, onStartNewApplication }) => {
  const { form, payment } = app;
  const uni = UNIVERSITIES.find((u) => u.id === form.universityId);
  const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;

  const nextSteps = [
    {
      icon: Mail,
      title: 'Call confirmation by email',
      detail: `We confirm your exact call time and send the Zoom link to ${form.email}.`,
    },
    {
      icon: Video,
      title: '45-minute consultation with Elena Dimitrova',
      detail: `Requested for ${form.consultationDate ? formatDay(form.consultationDate, { weekday: 'long', day: 'numeric', month: 'long' }) : 'your chosen day'}, ${form.consultationWindow}.`,
    },
    {
      icon: Truck,
      title: 'Document legalization & DHL dispatch',
      detail: 'After the call we start your Apostille, sworn translation and courier dispatch to Sofia.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 sm:px-6 lg:px-8" id="application-confirmation">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#006644]" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Payment received. Your application is in!</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto">
            Thank you, {form.fullName.split(' ')[0]}. Your onboarding package for {form.degree} at {uni?.name ?? 'your chosen university'} is
            active.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Receipt */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Receipt className="w-4 h-4" /> Receipt
            </div>
            <Row label="Amount paid" value={payment.amount != null ? formatMoney(payment.amount, payment.currency) : '€180.00'} strong />
            <Row label="Reference" value={payment.receiptRef ?? '—'} mono />
            <Row label="Date" value={paidAt ? paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            <Row label="Paid by" value={form.email} />
            <p className="text-[0.6875rem] text-slate-500 pt-2 border-t border-slate-100">
              Keep your reference for any questions about this payment.
            </p>
          </div>

          {/* Next steps */}
          <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">What happens next</div>
            <ol className="space-y-4">
              {nextSteps.map(({ icon: Icon, title, detail }, idx) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#006644]" />
                  </span>
                  <div className="text-xs">
                    <div className="font-bold text-slate-900">
                      {idx + 1}. {title}
                    </div>
                    <div className="text-slate-600">{detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Next: upload documents */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0f1e36] to-[#006644] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FolderUp className="w-6 h-6 text-emerald-300 shrink-0" />
            <div>
              <div className="font-bold font-heading">Upload your documents securely</div>
              <p className="text-xs text-slate-200 mt-0.5">
                Sign in to your account with {form.email} to upload your passport, diploma and certificates, and follow your application.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('account')}
            id="go-to-account-btn"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-[#006644] hover:bg-emerald-50"
          >
            Go to my account <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-[#006644] shrink-0" />
            <div>
              <div className="font-bold text-slate-900">{form.fullName}</div>
              <div className="text-slate-500">{form.citizenshipCountry}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileCheck2 className="w-4 h-4 text-[#006644] shrink-0" />
            <div>
              <div className="font-bold text-slate-900">
                {form.degree} · {uni?.shortName}
              </div>
              <div className="text-slate-500">{form.intakeSeason}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarClock className="w-4 h-4 text-[#006644] shrink-0" />
            <div>
              <div className="font-bold text-slate-900">Entrance exam</div>
              <div className="text-slate-500">
                {form.examDate === EXAM_DECIDE_WITH_ADVISOR
                  ? 'Chosen with your advisor on the call'
                  : examSessionLabel(form.examDate)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={APP_IMAGES.elenaAdvisor} alt="Elena Dimitrova" className="w-9 h-9 rounded-lg object-cover" referrerPolicy="no-referrer" />
            <span className="text-xs text-slate-600">Elena Dimitrova is your Sofia legal advisor.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {demoMode && (
              <button
                type="button"
                onClick={() => onNavigate('student')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Preview student portal (demo)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Start a separate application for another applicant? Your payment stays on record with us, but this page will switch to the new application.')) {
                  onStartNewApplication();
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              New application
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#006644] hover:bg-[#005538] inline-flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" /> Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean; mono?: boolean }> = ({ label, value, strong, mono }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500">{label}</span>
    <span className={`text-right truncate ${strong ? 'font-extrabold text-slate-900 text-sm' : 'font-semibold text-slate-800'} ${mono ? 'font-mono' : ''}`}>
      {value}
    </span>
  </div>
);
