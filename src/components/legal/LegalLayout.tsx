import React from 'react';
import { FileText, Scale, ShieldCheck } from 'lucide-react';
import { hasRealEmail, LEGAL_ENTITY, LEGAL_LAST_UPDATED } from '../../data/legal';
import { AppView } from '../../types';

export type LegalView = 'privacy' | 'terms' | 'gdpr';

const PAGES: { view: LegalView; label: string; icon: React.ElementType }[] = [
  { view: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { view: 'terms', label: 'Terms & Conditions', icon: FileText },
  { view: 'gdpr', label: 'GDPR Compliance', icon: Scale },
];

interface LegalLayoutProps {
  view: LegalView;
  title: string;
  intro: React.ReactNode;
  sections: { id: string; title: string }[];
  onNavigate: (view: AppView) => void;
  children: React.ReactNode;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({ view, title, intro, sections, onNavigate, children }) => (
  <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8" id={`legal-${view}`}>
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1e36] to-[#00281b] text-white p-6 sm:p-8 border border-emerald-500/30 shadow-lg">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-emerald-400/10" aria-hidden />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Legal</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading mt-1">{title}</h1>
          <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">{intro}</p>
          <p className="text-xs text-slate-400 mt-3">Last updated: {LEGAL_LAST_UPDATED}</p>
        </div>
      </div>

      {/* Switch between the three documents */}
      <nav aria-label="Legal documents" className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 shadow-2xs">
        {PAGES.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => onNavigate(v)}
            aria-current={v === view ? 'page' : undefined}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              v === view ? 'bg-[#006644] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4 hidden sm:block" />
            {label}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-28 bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">On this page</div>
          <ol className="space-y-1.5 text-xs">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    // Scroll in-page without replacing the #/route in the address bar.
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-slate-600 hover:text-[#006644] flex gap-2"
                >
                  <span className="text-slate-400 w-4 shrink-0">{i + 1}.</span>
                  <span>{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="lg:col-span-9 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-10 space-y-10 text-sm text-slate-700 leading-relaxed">
          {children}
        </article>
      </div>
    </div>
  </div>
);

export const Section: React.FC<{ id: string; n: number; title: string; children: React.ReactNode }> = ({ id, n, title, children }) => (
  <section id={id} className="scroll-mt-32 space-y-3">
    <h2 className="text-lg font-bold font-heading text-slate-900 flex gap-2">
      <span className="text-[#006644]">{n}.</span>
      {title}
    </h2>
    {children}
  </section>
);

export const Sub: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <h3 className="font-bold text-slate-900">{title}</h3>
    {children}
  </div>
);

export const List: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 marker:text-[#006644]">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

export const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-xs text-left">
      <thead className="bg-slate-50 text-slate-600">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 align-top">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={`px-3 py-2.5 ${j === 0 ? 'font-semibold text-slate-900' : ''}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">{children}</div>
);

/** An email address as a mailto link, or plain text while it's still a placeholder. */
export const Email: React.FC<{ address: string }> = ({ address }) =>
  hasRealEmail(address) ? (
    <a href={`mailto:${address}`} className="text-[#006644] font-semibold underline">
      {address}
    </a>
  ) : (
    <span className="font-semibold">{address}</span>
  );

/** Link to another page of the site that opens in place. */
export const PageLink: React.FC<{ to: AppView; onNavigate: (view: AppView) => void; children: React.ReactNode }> = ({ to, onNavigate, children }) => (
  <button type="button" onClick={() => onNavigate(to)} className="text-[#006644] font-semibold underline">
    {children}
  </button>
);

export const ControllerBlock: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-0.5">
    <div className="font-bold text-slate-900">{LEGAL_ENTITY.name}</div>
    <div>ЕИК / UIC: {LEGAL_ENTITY.eik}</div>
    {LEGAL_ENTITY.vatNumber && <div>VAT number: {LEGAL_ENTITY.vatNumber}</div>}
    <div>{LEGAL_ENTITY.address}</div>
    <div>
      Privacy contact: <Email address={LEGAL_ENTITY.privacyEmail} />
    </div>
    <div>Website: {LEGAL_ENTITY.website}</div>
  </div>
);
