import { ServiceNotice } from "./components/ApplicationWorkspace";
import { AdmissionsCalendar } from "./components/AdmissionsCalendar";
import { StaffReviewView } from "./components/StaffReviewView";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { scrollBehavior } from "./lib/a11y";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { AccountView } from "./components/AccountView";
import { AccessibilityStatementView } from "./components/legal/AccessibilityStatementView";
import { GdprView } from "./components/legal/GdprView";
import { PrivacyPolicyView } from "./components/legal/PrivacyPolicyView";
import { TermsView } from "./components/legal/TermsView";
import { SiteFooter } from "./components/SiteFooter";
import { TopNavbar } from "./components/TopNavbar";
import { PublicSiteView } from "./components/PublicSiteView";
import { WizardView } from "./components/WizardView";
import { StudentPortalView } from "./components/StudentPortalView";
import { StaffOpsView } from "./components/StaffOpsView";
import { QuickFitModal } from "./components/QuickFitModal";
import {
  applyPrefill,
  createApplication,
  loadApplication,
  PAYMENT_STEP,
  saveApplication,
  WizardPrefill,
} from "./lib/application";
import { liveAccountApi } from "./lib/account";
import { getCheckoutStatus, getPaymentStatus } from "./lib/api";
import { createDemoAccountApi } from "./lib/demoAccount";
import { ApplicationState, AppView } from "./types";
import {
  GuideView,
  NotFoundView,
  UniversitiesView,
  UniversityPage,
} from "./components/content/ContentPages";
import { applyPageMeta } from "./data/seo";
import {
  isLegacyHash,
  isUniversityView,
  pathFor,
  viewFromLocation,
} from "./lib/routes";

const DEMO_KEY = "studybg.demo";

/**
 * The persona switcher (Student Portal / Staff Ops with sample data) is only shown in demo mode.
 * Turn it on with ?demo=1 and off with ?demo=0; it lasts for the browser tab.
 */
function readDemoMode(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1") sessionStorage.setItem(DEMO_KEY, "1");
    if (param === "0") sessionStorage.removeItem(DEMO_KEY);
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

const openAccessibilitySettings = () =>
  window.dispatchEvent(new Event("studybg:open-a11y"));

/** Moves keyboard/screen-reader focus to the page's main heading, so the new page is announced. */
function focusMainHeading() {
  const heading =
    document.querySelector<HTMLElement>("main h1") ??
    document.getElementById("main-content");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

/** Stripe sends some payment methods (e.g. bank redirects) back here with ?payment_intent=... */
function readPaymentReturn(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("payment_return") ? params.get("payment_intent") : null;
}

/** Stripe Checkout sends the browser back with ?checkout=success&session_id=… or ?checkout=cancel. */
function readCheckoutReturn(): { result: "success" | "cancel"; sessionId: string | null } | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("checkout");
  if (result !== "success" && result !== "cancel") return null;
  return { result, sessionId: params.get("session_id") };
}

export default function App() {
  const [demoMode] = useState(readDemoMode);
  const [returningPaymentIntent] = useState(readPaymentReturn);
  const [checkoutReturn] = useState(readCheckoutReturn);
  const [checkoutNotice, setCheckoutNotice] = useState<"cancel" | "pending" | null>(
    () => (checkoutReturn ? (checkoutReturn.result === "cancel" ? "cancel" : "pending") : null),
  );
  const [application, setApplication] =
    useState<ApplicationState>(loadApplication);
  const guardView = useCallback(
    (view: AppView): AppView => {
      // Sample-data views are demo-only; real applicants go to their own application instead.
      if (!demoMode && view === "student") return "wizard";
      if (!demoMode && view === "staff") return "home";
      return view;
    },
    [demoMode],
  );
  const [currentView, setCurrentView] = useState<AppView>(() =>
    returningPaymentIntent || checkoutReturn
      ? "wizard"
      : guardView(viewFromLocation(window.location)),
  );
  const accountApi = useMemo(
    () => (demoMode ? createDemoAccountApi() : liveAccountApi),
    [demoMode],
  );
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [isQuickFitOpen, setIsQuickFitOpen] = useState(false);
  const [quickFitUniversity, setQuickFitUniversity] = useState<string | undefined>();
  const openQuickFit = (universityId?: string) => {
    setQuickFitUniversity(universityId);
    setIsQuickFitOpen(true);
  };

  useEffect(() => saveApplication(application), [application]);

  // Finish a redirect-based payment: ask the server (which asks Stripe) whether it really succeeded.
  useEffect(() => {
    const checkingIntent =
      returningPaymentIntent || application.payment.paymentIntentId;
    if (!checkingIntent) return;
    const url = new URL(window.location.href);
    [
      "payment_return",
      "payment_intent",
      "payment_intent_client_secret",
      "redirect_status",
    ].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.toString());
    setApplication((a) => ({ ...a, currentStep: PAYMENT_STEP }));

    getPaymentStatus(checkingIntent, application.id)
      .then((info) => {
        if (!info.paid) return;
        setApplication((a) => ({
          ...a,
          payment: {
            status: "paid",
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

  // Back from the Stripe-hosted payment page: confirm with the server (which asks Stripe).
  useEffect(() => {
    if (!checkoutReturn) return;
    const url = new URL(window.location.href);
    ["checkout", "session_id"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.toString());
    setApplication((a) => ({ ...a, currentStep: PAYMENT_STEP }));
    const { sessionId } = checkoutReturn;
    if (checkoutReturn.result !== "success" || !sessionId) return;
    let cancelled = false;
    (async () => {
      // The webhook may arrive a few seconds after the redirect; check a handful of times.
      for (let i = 0; i < 6 && !cancelled; i++) {
        try {
          const info = await getCheckoutStatus(sessionId, application.id);
          if ("paymentIntentId" in info && info.paid) {
            setApplication((a) => ({
              ...a,
              payment: {
                status: "paid",
                paymentIntentId: info.paymentIntentId,
                receiptRef: info.receiptRef,
                amount: info.amount,
                currency: info.currency,
                paidAt: new Date().toISOString(),
              },
            }));
            setCheckoutNotice(null);
            return;
          }
        } catch {
          // Keep the "waiting for confirmation" notice; the next check may succeed.
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback(
    (view: AppView) => {
      setCurrentView(guardView(view));
      setPendingSection(null);
      window.scrollTo({ top: 0 });
    },
    [guardView],
  );

  // Title, description, robots and canonical follow the page (the wizard sets its own title per step).
  useEffect(() => {
    applyPageMeta(currentView, { skipTitle: currentView === "wizard" });
  }, [currentView]);

  // After an in-app page change (not the first load), focus the new page's heading.
  const firstRender = React.useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const frame = requestAnimationFrame(focusMainHeading);
    return () => cancelAnimationFrame(frame);
  }, [currentView]);

  // Keep the address bar in step with the view...
  const addressSynced = React.useRef(false);
  const currentViewRef = React.useRef(currentView);
  currentViewRef.current = currentView;
  useEffect(() => {
    if (currentView === "not-found") return; // keep the address that was asked for
    const target = pathFor(currentView);
    const legacy = isLegacyHash(window.location.hash);
    const hash = legacy ? "" : window.location.hash;
    const url = `${target}${window.location.search}${hash}`;
    if (!addressSynced.current) {
      // The first view was read from the address: only tidy it (old #/… links, missing trailing slash).
      addressSynced.current = true;
      if (window.location.pathname !== target || legacy)
        window.history.replaceState(null, "", url);
      return;
    }
    if (window.location.pathname === target && !legacy) return;
    window.history.pushState(null, "", `${target}${window.location.search}`);
  }, [currentView]);

  // ...and the view in step with the address bar (back/forward buttons, typed URLs, old #/… links).
  useEffect(() => {
    const onAddressChange = () => {
      const view = guardView(viewFromLocation(window.location));
      if (view === currentViewRef.current) return; // e.g. a #section link on the same page
      setCurrentView(view);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onAddressChange);
    window.addEventListener("hashchange", onAddressChange);
    return () => {
      window.removeEventListener("popstate", onAddressChange);
      window.removeEventListener("hashchange", onAddressChange);
    };
  }, [guardView]);

  const navigateToSection = useCallback((sectionId: string) => {
    setCurrentView("home");
    setPendingSection(sectionId);
  }, []);

  // Links are ordinary <a href="/page/"> so crawlers can follow them; clicks stay inside the app.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!link || !link.href || link.hasAttribute("download")) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const view = viewFromLocation(url);
      if (view === "not-found") return;
      const section = isLegacyHash(url.hash) ? "" : url.hash.slice(1);
      // A #section on the page already showing: let the browser scroll to it.
      if (view === currentViewRef.current && section && url.pathname === window.location.pathname) return;
      e.preventDefault();
      if (view === "home" && section) navigateToSection(section);
      else navigate(view);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate, navigateToSection]);

  // Scroll once the home view (and its sections) has actually rendered.
  useEffect(() => {
    if (currentView !== "home" || !pendingSection) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(pendingSection)
        ?.scrollIntoView({ behavior: scrollBehavior() });
      setPendingSection(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentView, pendingSection]);

  const startWithPrefill = (prefill: WizardPrefill) => {
    setApplication((a) => applyPrefill(a, prefill));
    navigate("wizard");
  };

  const startNewApplication = () => {
    setApplication(createApplication());
    navigate("wizard");
  };

  const isPaid = application.payment.status === "paid";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0b1c30] flex flex-col font-sans selection:bg-[#006644] selection:text-white">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
      <TopNavbar
        currentView={currentView}
        demoMode={demoMode}
        hasPaidApplication={isPaid}
        onNavigate={navigate}
        onNavigateToSection={navigateToSection}
        onOpenQuickFit={() => openQuickFit()}
      />

      {/* Only where it affects what the visitor is doing: applying or signing in. */}
      {(currentView === "wizard" || currentView === "account") && <ServiceNotice />}
      <main className="flex-1" id="main-content" tabIndex={-1}>
        {currentView === "home" && (
          <PublicSiteView onNavigate={navigate} onOpenQuickFit={openQuickFit} />
        )}

        {currentView === "wizard" && (
          <WizardView
            app={application}
            onChange={setApplication}
            onNavigate={navigate}
            onStartNewApplication={startNewApplication}
            demoMode={demoMode}
            checkoutNotice={checkoutNotice}
          />
        )}

        {currentView === "account" && (
          <AccountView
            onResume={(saved) => {
              setApplication(saved);
              navigate("wizard");
            }}
            api={accountApi}
            defaultEmail={application.form.email || undefined}
            onNavigate={navigate}
          />
        )}

        {currentView === "guide" && <GuideView onOpenQuickFit={openQuickFit} />}
        {currentView === "universities" && (
          <UniversitiesView onOpenQuickFit={openQuickFit} />
        )}
        {isUniversityView(currentView) && (
          <UniversityPage view={currentView} onOpenQuickFit={openQuickFit} />
        )}
        {currentView === "not-found" && <NotFoundView />}
        {currentView === "calendar" && <AdmissionsCalendar />}
        {currentView === "staff-live" && <StaffReviewView />}
        {currentView === "privacy" && (
          <PrivacyPolicyView onNavigate={navigate} />
        )}
        {currentView === "terms" && <TermsView onNavigate={navigate} />}
        {currentView === "gdpr" && <GdprView onNavigate={navigate} />}
        {currentView === "accessibility" && (
          <AccessibilityStatementView
            onNavigate={navigate}
            onOpenSettings={openAccessibilitySettings}
          />
        )}

        {currentView === "student" && demoMode && (
          <StudentPortalView onNavigate={navigate} />
        )}
        {currentView === "staff" && demoMode && (
          <StaffOpsView onNavigate={navigate} />
        )}
      </main>

      <SiteFooter onNavigate={navigate} />

      <AccessibilityPanel onOpenStatement={() => navigate("accessibility")} />

      <QuickFitModal
        isOpen={isQuickFitOpen}
        initialUniversityId={quickFitUniversity}
        onClose={() => setIsQuickFitOpen(false)}
        onStartApplication={startWithPrefill}
      />
    </div>
  );
}
