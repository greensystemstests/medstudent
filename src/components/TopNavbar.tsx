import React, { useEffect, useRef, useState } from 'react';
import { AppView } from '../types';
import { intakeYearLabel } from '../lib/admissions';
import { StudyBgLogo } from './StudyBgLogo';
import { 
  GraduationCap, 
  UserCheck, 
  ShieldAlert, 
  FileText, 
  Home, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Layers,
  Menu,
  CircleUserRound,
  X
} from 'lucide-react';

/** Homepage sections reachable from the menu. Every id here must exist in PublicSiteView. */
const NAV_SECTIONS: [string, string][] = [
  ['universities-section', 'Universities'],
  ['six-stages-section', 'How it works'],
  ['pricing-section', 'Pricing (€180)'],
  ['faqs-section', 'FAQ'],
];

interface TopNavbarProps {
  currentView: AppView;
  demoMode: boolean;
  hasPaidApplication: boolean;
  onNavigate: (view: AppView) => void;
  onNavigateToSection: (sectionId: string) => void;
  onOpenQuickFit: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentView,
  demoMode,
  hasPaidApplication,
  onNavigate,
  onNavigateToSection,
  onOpenQuickFit,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  // Close the mobile menu when the page changes, and on Escape (focus goes back to the menu button).
  useEffect(() => setMobileMenuOpen(false), [currentView]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMobileMenuOpen(false);
      menuToggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top micro-bar with status and rapid persona switcher */}
      <div className="bg-[#0f1e36] text-slate-200 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#006644]/40 text-[#6ee7b7] font-medium text-[0.6875rem] border border-[#10b981]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              Plan your next application
            </span>
            <span className="hidden sm:inline text-slate-300">
              Independent admissions support · university rules apply
            </span>
          </div>

          {demoMode && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1 hidden md:inline">Demo Switcher:</span>
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
              <button
                id="switcher-home-btn"
                onClick={() => onNavigate('home')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  currentView === 'home'
                    ? 'bg-[#006644] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Public Site</span>
              </button>

              <button
                id="switcher-wizard-btn"
                onClick={() => onNavigate('wizard')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  currentView === 'wizard'
                    ? 'bg-[#006644] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Wizard Demo</span>
              </button>

              <button
                id="switcher-student-btn"
                onClick={() => onNavigate('student')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  currentView === 'student'
                    ? 'bg-[#006644] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Student Portal</span>
                <span className="bg-amber-400/20 text-amber-300 text-[0.6875rem] px-1 rounded">1 Action</span>
              </button>

              <button
                id="switcher-staff-btn"
                onClick={() => onNavigate('staff')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  currentView === 'staff'
                    ? 'bg-[#006644] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                <span>Staff Ops</span>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Main header navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 py-2 min-h-16 sm:min-h-20">
          {/* Logo & Brand Identity */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-left focus:outline-none group py-1"
            id="brand-logo-btn"
          >
            <StudyBgLogo size="lg" />
            <div className="hidden lg:block xl:hidden pl-2 border-l border-slate-200">
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 block w-fit">
                Medical Gateway
              </span>
              <p className="text-[0.6875rem] text-slate-500 font-medium">Bulgaria English Medical & Dental Admissions</p>
            </div>
          </button>

          {/* Primary Navigation Links */}
          <nav aria-label="Main" className="desktop-nav hidden xl:flex items-center space-x-1">
            {NAV_SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => onNavigateToSection(id)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-[#006644] hover:bg-slate-50 rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => onNavigate('calendar')}
              aria-current={currentView === 'calendar' ? 'page' : undefined}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-[#006644] hover:bg-slate-50 rounded-lg transition-colors"
            >
              Calendar
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onOpenQuickFit}
              className="inline-flex items-center gap-1.5 min-h-11 px-2.5 min-[380px]:px-3 sm:px-4 text-xs font-semibold text-white bg-[#006644] hover:bg-[#005538] rounded-lg shadow-sm transition-colors"
              id="header-quick-fit-btn"
            >
              <Sparkles className="w-3.5 h-3.5 max-[379px]:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Free eligibility check</span>
              <span className="sm:hidden">Free check</span>
            </button>

            <button
              onClick={() => onNavigate('account')}
              aria-label="My account"
              title="My account"
              className={`hidden md:inline-flex items-center gap-1.5 min-h-11 px-3 sm:px-3.5 text-xs font-semibold rounded-lg border transition-colors ${
                currentView === 'account'
                  ? 'text-[#006644] bg-emerald-50 border-[#006644]/30'
                  : 'text-slate-700 bg-white border-slate-200 hover:border-[#006644]/40 hover:text-[#006644]'
              }`}
              id="header-account-btn"
            >
              <CircleUserRound className="w-4 h-4" />
              <span className="hidden sm:inline">My Account</span>
            </button>

            <button
              onClick={() => onNavigate('wizard')}
              className="hidden lg:inline-flex items-center gap-1.5 min-h-11 px-3.5 text-xs font-semibold text-[#006644] bg-white border border-[#006644]/40 hover:bg-emerald-50 rounded-lg transition-colors"
              id="header-apply-btn"
            >
              <span>{hasPaidApplication ? 'My application' : 'Apply (€180)'}</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              ref={menuToggleRef}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-nav-toggle xl:hidden w-11 h-11 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="xl:hidden border-t border-slate-200 py-3 space-y-1">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenQuickFit();
              }}
              className="w-full min-h-11 text-left px-3 py-2 text-sm font-semibold text-[#006644] hover:bg-emerald-50 rounded-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Free eligibility check</span>
            </button>
            {NAV_SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToSection(id);
                }}
                className="w-full min-h-11 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => onNavigate('calendar')}
              className="w-full min-h-11 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Admissions calendar
            </button>
            <button
              onClick={() => onNavigate('account')}
              className="w-full min-h-11 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
            >
              <CircleUserRound className="w-4 h-4" aria-hidden="true" />
              <span>My Account</span>
            </button>
            <button
              onClick={() => onNavigate('wizard')}
              className="w-full min-h-11 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              {hasPaidApplication ? 'My application' : 'Start an application (€180 Admissions Gateway)'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

