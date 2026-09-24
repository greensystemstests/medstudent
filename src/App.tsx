import React, { useCallback, useEffect, useState } from 'react';
import { TopNavbar } from './components/TopNavbar';
import { PublicSiteView } from './components/PublicSiteView';
import { WizardView } from './components/WizardView';
import { StudentPortalView } from './components/StudentPortalView';
import { StaffOpsView } from './components/StaffOpsView';
import { QuickFitModal } from './components/QuickFitModal';
import { applyPrefill, createApplication, loadApplication, PAYMENT_STEP, saveApplication, WizardPrefill } from './lib/application';
import { getPaymentStatus } from './lib/api';
import { ApplicationState, AppView } from './types';

const DEMO_KEY = 'studybg.demo';

/**
 * The persona switcher (Student Portal / Staff Ops with sample data) is only shown in demo mode.
 * Turn it on with ?demo=1 and off with ?demo=0; it lasts for the browser tab.
 */
function readDemoMode(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('demo');
    if (param === '1') sessionStorage.setItem(DEMO_KEY, '1');
    if (param === '0') sessionStorage.removeItem(DEMO_KEY);
    return sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

/** Stripe sends some payment methods (e.g. bank redirects) back here with ?payment_intent=... */
function readPaymentReturn(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('payment_return') ? params.get('payment_intent') : null;
}

export default function App() {
  const [demoMode] = useState(readDemoMode);
  const [returningPaymentIntent] = useState(readPaymentReturn);
  const [application, setApplication] = useState<ApplicationState>(loadApplication);
  const [currentView, setCurrentView] = useState<AppView>(returningPaymentIntent ? 'wizard' : 'home');
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [isQuickFitOpen, setIsQuickFitOpen] = useState(false);

  useEffect(() => saveApplication(application), [application]);

  // Finish a redirect-based payment: ask the server (which asks Stripe) whether it really succeeded.
  useEffect(() => {
    if (!returningPaymentIntent) return;
    const url = new URL(window.location.href);
    ['payment_return', 'payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, '', url.toString());
    setApplication((a) => ({ ...a, currentStep: PAYMENT_STEP }));

    getPaymentStatus(returningPaymentIntent, application.id)
      .then((info) => {
        if (!info.paid) return;
        setApplication((a) => ({
          ...a,
          payment: {
            status: 'paid',
            paymentIntentId: info.paymentIntentId,
            receiptRef: info.receiptRef,
            amount: info.amount,
            currency: info.currency,
            paidAt: new Date().toISOString(),
          },
        }));
      })
      .catch(() => {
        // Leave the applicant on the payment step; it re-checks the intent when it loads.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback(
    (view: AppView) => {
      // Sample-data views are demo-only; real applicants go to their own application instead.
      let target = view;
      if (!demoMode && target === 'student') target = 'wizard';
      if (!demoMode && target === 'staff') target = 'home';
      setCurrentView(target);
      setPendingSection(null);
      window.scrollTo({ top: 0 });
    },
    [demoMode],
  );

  const navigateToSection = useCallback((sectionId: string) => {
    setCurrentView('home');
    setPendingSection(sectionId);
  }, []);

  // Scroll once the home view (and its sections) has actually rendered.
  useEffect(() => {
    if (currentView !== 'home' || !pendingSection) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(pendingSection)?.scrollIntoView({ behavior: 'smooth' });
      setPendingSection(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentView, pendingSection]);

  const startWithPrefill = (prefill: WizardPrefill) => {
    setApplication((a) => applyPrefill(a, prefill));
    navigate('wizard');
  };

  const startNewApplication = () => {
    setApplication(createApplication());
    navigate('wizard');
  };

  const isPaid = application.payment.status === 'paid';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0b1c30] flex flex-col font-sans selection:bg-[#006644] selection:text-white">
      <TopNavbar
        currentView={currentView}
        demoMode={demoMode}
        hasPaidApplication={isPaid}
        onNavigate={navigate}
        onNavigateToSection={navigateToSection}
        onOpenQuickFit={() => setIsQuickFitOpen(true)}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <PublicSiteView
            onNavigate={navigate}
            onOpenQuickFit={() => setIsQuickFitOpen(true)}
            onSelectUniversity={(uniId) => startWithPrefill({ selectedUniversityId: uniId })}
          />
        )}

        {currentView === 'wizard' && (
          <WizardView
            app={application}
            onChange={setApplication}
            onNavigate={navigate}
            onStartNewApplication={startNewApplication}
            demoMode={demoMode}
          />
        )}

        {currentView === 'student' && demoMode && <StudentPortalView onNavigate={navigate} />}
        {currentView === 'staff' && demoMode && <StaffOpsView onNavigate={navigate} />}
      </main>

      <QuickFitModal isOpen={isQuickFitOpen} onClose={() => setIsQuickFitOpen(false)} onStartApplication={startWithPrefill} />
    </div>
  );
}
