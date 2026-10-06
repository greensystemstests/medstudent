import { UNIVERSITIES } from "../../shared/admissions.js";
import React from "react";
import { AppView } from "../types";
import { hasRealEmail, LEGAL_ENTITY } from "../data/legal";
import { StudyBgLogo } from "./StudyBgLogo";
import { pathFor, universityView } from "../lib/routes";
import { UNIVERSITY_GUIDES } from "../data/guides";

const LEGAL_LINKS: { view: AppView; label: string }[] = [
  { view: "privacy", label: "Privacy Policy" },
  { view: "terms", label: "Terms & Conditions" },
  { view: "gdpr", label: "GDPR Compliance" },
  { view: "accessibility", label: "Accessibility" },
];

const GUIDE_LINKS: { view: AppView; label: string }[] = [
  { view: "guide", label: "How to study medicine in Bulgaria" },
  { view: "universities", label: "Compare the four universities" },
  { view: "calendar", label: "Admissions calendar" },
  { view: "wizard", label: "Apply: €180 Admissions Gateway" },
];

const linkClass = "inline-block py-1 text-slate-300 hover:text-white underline-offset-2 hover:underline";

/** Shown at the bottom of every page, so the legal documents are always one click away. */
export const SiteFooter: React.FC<{ onNavigate: (view: AppView) => void }> = () => (
  <footer
    className="bg-[#0f1e36] text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs"
    id="site-footer"
  >
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
      <div className="space-y-3 md:col-span-1">
        <div className="flex items-center gap-2">
          <StudyBgLogo variant="white" size="md" />
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">
          Independent admissions support for English-taught medical & dental
          degrees across Bulgaria.
        </p>
      </div>

      <div>
        <h2 className="font-bold text-white mb-2 uppercase tracking-wider text-[0.6875rem]">
          Universities
        </h2>
        <ul>
          {UNIVERSITIES.map((u) => (
            <li key={u.id}>
              <a className={linkClass} href={pathFor(universityView(u.id))}>
                {UNIVERSITY_GUIDES[universityView(u.id)].name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-bold text-white mb-2 uppercase tracking-wider text-[0.6875rem]">
          Before you apply
        </h2>
        <ul>
          {GUIDE_LINKS.map((link) => (
            <li key={link.view}>
              <a className={linkClass} href={pathFor(link.view)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-bold text-white mb-2 uppercase tracking-wider text-[0.6875rem]">
          Contact
        </h2>
        <p className="leading-relaxed">
          {LEGAL_ENTITY.name.startsWith("[")
            ? "Business contact details are being finalized."
            : `${LEGAL_ENTITY.name} · ${LEGAL_ENTITY.address}`}
          {hasRealEmail(LEGAL_ENTITY.contactEmail) && (
            <>
              <br />
              Email:{" "}
              <a
                href={`mailto:${LEGAL_ENTITY.contactEmail}`}
                className="text-slate-300 hover:text-white underline underline-offset-2"
              >
                {LEGAL_ENTITY.contactEmail}
              </a>
            </>
          )}
        </p>
      </div>

      <nav aria-label="Legal">
        <h2 className="font-bold text-white mb-2 uppercase tracking-wider text-[0.6875rem]">
          Legal
        </h2>
        <ul>
          {LEGAL_LINKS.map((link) => (
            <li key={link.view}>
              <a href={pathFor(link.view)} className={linkClass}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>

    <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-[0.6875rem]">
      <div>
        © {new Date().getFullYear()} StudyBg Medical Gateway. All rights
        reserved.
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("studybg:open-a11y"))}
        className="inline-block py-1 text-slate-300 hover:text-white underline underline-offset-2"
      >
        Accessibility settings
      </button>
    </div>
  </footer>
);
