import React from 'react';
import { AppView } from '../types';
import { StudyBgLogo } from './StudyBgLogo';

const LEGAL_LINKS: { view: AppView; hash: string; label: string }[] = [
  { view: 'privacy', hash: '#/privacy', label: 'Privacy Policy' },
  { view: 'terms', hash: '#/terms', label: 'Terms & Conditions' },
  { view: 'gdpr', hash: '#/gdpr', label: 'GDPR Compliance' },
];

/** Shown at the bottom of every page, so the legal documents are always one click away. */
export const SiteFooter: React.FC<{ onNavigate: (view: AppView) => void }> = ({ onNavigate }) => (
  <footer className="bg-[#0f1e36] text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs" id="site-footer">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
      <div className="space-y-3 md:col-span-1">
        <div className="flex items-center gap-2">
          <StudyBgLogo variant="white" size="md" />
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">
          Official legal coordination and admissions gateway for English-taught medical & dental degrees across Bulgaria.
        </p>
      </div>

      <div>
        <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Universities</h4>
        <ul className="space-y-1.5">
          <li>MU Sofia (Medical University of Sofia)</li>
          <li>MU Plovdiv (Medical University of Plovdiv)</li>
          <li>MU Varna (Prof. Dr. Paraskev Stoyanov)</li>
          <li>MU Pleven (da Vinci Robotic Faculty)</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Regulatory Compliance</h4>
        <ul className="space-y-1.5">
          <li>Bulgarian Ministry of Education (MOES)</li>
          <li>Hague Apostille Convention (1961)</li>
          <li>MVR Migration Directorate (VRN Permit)</li>
          <li>Directive 2005/36/EC EU Recognition</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Sofia Office</h4>
        <p className="leading-relaxed">
          Tsar Osvoboditel Blvd, 1000 Sofia Center, Bulgaria<br />
          Direct Legal Desk: +359 2 984 1020<br />
          Email: admissions@studybg.medical
        </p>
      </div>

      <nav aria-label="Legal">
        <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Legal</h4>
        <ul className="space-y-1.5">
          {LEGAL_LINKS.map((link) => (
            <li key={link.view}>
              <a
                href={link.hash}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(link.view);
                }}
                className="text-slate-300 hover:text-white underline-offset-2 hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>

    <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
      <div>© {new Date().getFullYear()} StudyBg Medical Gateway. All rights reserved.</div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {LEGAL_LINKS.map((link) => (
          <a
            key={link.view}
            href={link.hash}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(link.view);
            }}
            className="hover:text-slate-300"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);
