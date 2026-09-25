import { SignIn } from "./AccountView";
import { liveAccountApi } from "../lib/account";
import { getApplication, saveOnline } from "../lib/api";
import React, { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
// The /pure entry only loads Stripe.js when the payment step opens, not on every page.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import {
  APP_IMAGES,
  CONSULTATION_AGENDA,
  ONBOARDING_FEE_EUR,
  ONBOARDING_INCLUSIONS,
  UNIVERSITIES,
} from "../data/constants";
import {
  ApiError,
  createOrUpdatePaymentIntent,
  getPaymentConfig,
  getPaymentStatus,
  PaymentConfig,
  PaymentIntentInfo,
} from "../lib/api";
import { formatDay } from "../lib/application";
import { ApplicationState } from "../types";

interface PaymentStepProps {
  app: ApplicationState;
  onSaved: (app: ApplicationState) => void;
  /** Remember the PaymentIntent so a reload or edit reuses it instead of creating another. */
  onIntentCreated: (paymentIntentId: string) => void;
  /** Called only after the server has confirmed with Stripe that the payment succeeded. */
  onPaid: (info: PaymentIntentInfo) => void;
}

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(publishableKey: string) {
  if (!stripeCache.has(publishableKey))
    stripeCache.set(publishableKey, loadStripe(publishableKey));
  return stripeCache.get(publishableKey)!;
}

export const formatMoney = (amountMinor: number, currency = "eur") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);

const appearance: StripeElementsOptions["appearance"] = {
  theme: "stripe",
  variables: {
    colorPrimary: "#006644",
    colorText: "#0b1c30",
    colorTextSecondary: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSizeBase: "15px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #cbd5e1", boxShadow: "none" },
    ".Input:focus": { borderColor: "#006644", boxShadow: "0 0 0 1px #006644" },
    ".Label": { fontWeight: "600", fontSize: "12px", color: "#334155" },
    ".Tab": { border: "1px solid #e2e8f0", boxShadow: "none" },
    ".Tab--selected": {
      borderColor: "#006644",
      boxShadow: "0 0 0 1px #006644",
    },
  },
};

export const PaymentStep: React.FC<PaymentStepProps> = ({
  app,
  onSaved,
  onIntentCreated,
  onPaid,
}) => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [intent, setIntent] = useState<PaymentIntentInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const { form } = app;
  const uni = UNIVERSITIES.find((u) => u.id === form.universityId);

  const [signed, setSigned] = useState(liveAccountApi.isSignedIn());
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    getPaymentConfig()
      .then(setConfig)
      .catch((e) => setLoadError(e.message));
  }, [attempt]);
  async function prepare() {
    setPreparing(true);
    setLoadError(null);
    try {
      let saved: ApplicationState;
      let remote: ApplicationState | null = null;
      try {
        remote = await getApplication(app.id);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 404) throw e;
      }
      if (remote && remote.status !== "draft") saved = remote;
      else saved = await saveOnline(app);
      onSaved(saved);
      const pi = await createOrUpdatePaymentIntent(saved);
      setIntent(pi);
      onSaved({
        ...saved,
        status: "checkout",
        currentStep: 8,
        payment: { ...saved.payment, paymentIntentId: pi.paymentIntentId },
      });
      onIntentCreated(pi.paymentIntentId);
      if (pi.paid) onPaid(pi);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }

  const amount = config?.amount ?? ONBOARDING_FEE_EUR * 100;
  const currency = config?.currency ?? "eur";
  const total = formatMoney(amount, currency);

  const elementsOptions = useMemo<StripeElementsOptions | undefined>(
    () =>
      intent?.clientSecret
        ? {
            clientSecret: intent.clientSecret,
            appearance,
            fonts: [
              {
                cssSrc:
                  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
              },
            ],
          }
        : undefined,
    [intent?.clientSecret],
  );

  return (
    <div
      className="space-y-6 animate-in fade-in duration-200"
      id="payment-step"
    >
      <div className="border-b border-slate-100 pb-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#006644] text-[0.6875rem] font-bold border border-emerald-200 mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Secure checkout</span>
        </div>
        <h2 className="text-lg font-bold font-heading text-slate-900">
          Step 8: Your Onboarding Package & Payment
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Here's exactly what your one-time {total} fee covers, and what happens
          on your consultation call.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ---------- Left: what you are paying for ---------- */}
        <div className="xl:col-span-7 space-y-5">
          {/* Package hero */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1e36] to-[#00281b] text-white p-6 border border-emerald-500/30 shadow-lg">
            <div
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-400/10"
              aria-hidden
            />
            <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-emerald-300">
              StudyBg Direct Admissions
            </div>
            <div className="mt-1 font-heading font-bold text-lg">
              Onboarding & Advisory Package
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-extrabold font-heading text-emerald-400">
                {total}
              </span>
              <span className="text-slate-300 text-xs">
                one-time · no hidden fees
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[0.6875rem]">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
                {form.degree} · {uni?.shortName ?? "University"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                <CalendarClock className="w-3.5 h-3.5 text-emerald-300" />
                {form.intakeSeason}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                <Mail className="w-3.5 h-3.5 text-emerald-300" />
                {form.email}
              </span>
            </div>
          </div>

          {/* Inclusions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              What's included
            </div>
            <ul className="space-y-3">
              {ONBOARDING_INCLUSIONS.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-2.5 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#006644] shrink-0 mt-0.5" />
                  <span className="text-slate-600">
                    <strong className="text-slate-900">{item.title}:</strong>{" "}
                    {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The call */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Your consultation call
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    StudyBg admissions team
                  </div>
                  <div className="text-[0.6875rem] text-slate-500">
                    Advisor assigned after review
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[0.6875rem] text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#006644]" /> 45 min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-[#006644]" /> Zoom video
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-emerald-100 p-3 text-xs flex items-start gap-2">
              <CalendarClock className="w-4 h-4 text-[#006644] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">
                  Requested:{" "}
                  {form.consultationDate
                    ? formatDay(form.consultationDate, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "—"}
                  {" · "}
                  {form.consultationWindow}
                </div>
                <div className="text-slate-500 mt-0.5 flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  We'll confirm the exact time and send your Zoom link to{" "}
                  {form.email}.
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-800 mb-2">
                What we'll cover on the call
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CONSULTATION_AGENDA.map((item, idx) => (
                  <li
                    key={item.title}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#006644] text-white text-[0.6875rem] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-900 block">
                        {item.title}
                      </span>
                      <span className="text-slate-600">{item.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* ---------- Right: checkout card ---------- */}
        <div className="xl:col-span-5 xl:sticky xl:top-28">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <CreditCard className="w-4 h-4 text-[#006644]" />
                Payment details
              </div>
              <span className="text-[0.6875rem] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Secured by Stripe
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Order summary */}
              <div className="text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Onboarding & advisory package</span>
                  <span>{total}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>45-min consultation call</span>
                  <span className="text-[#006644] font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-slate-200">
                  <span className="font-bold text-slate-900">
                    Total due today
                  </span>
                  <span className="font-extrabold text-lg text-slate-900">
                    {total}{" "}
                    <span className="text-[0.6875rem] font-semibold text-slate-500">
                      {currency.toUpperCase()}
                    </span>
                  </span>
                </div>
              </div>

              {config?.testMode && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[0.6875rem] text-amber-900">
                  <strong>Test mode:</strong> no real money moves. Use card{" "}
                  <code className="font-mono">4242 4242 4242 4242</code>, any
                  future expiry and any CVC.
                </div>
              )}

              {!signed ? (
                <SignIn
                  api={liveAccountApi}
                  defaultEmail={form.email}
                  onSignedIn={() => setSigned(true)}
                />
              ) : loadError ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-3"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loadError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadError(null);
                      setAttempt((n) => n + 1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 font-semibold hover:bg-red-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try again
                  </button>
                </div>
              ) : config && elementsOptions ? (
                <Elements
                  key={elementsOptions.clientSecret}
                  stripe={getStripe(config.publishableKey)}
                  options={elementsOptions}
                >
                  <CheckoutForm app={app} total={total} onPaid={onPaid} />
                </Elements>
              ) : (
                <div className="space-y-3" aria-busy={preparing}>
                  <button
                    type="button"
                    disabled={preparing || !config}
                    onClick={prepare}
                    className="w-full px-4 py-3 bg-[#006644] text-white rounded-xl disabled:opacity-50"
                  >
                    {preparing
                      ? "Preparing checkout…"
                      : "Save application & prepare checkout"}
                  </button>
                  <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                  </div>
                  <div
                    className="text-[0.6875rem] text-slate-500 flex items-center gap-1.5"
                    role="status"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Your
                    application is saved before payment.
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[0.6875rem] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Card details go directly to Stripe (PCI-DSS Level 1). We never
                  see or store them.
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  3D Secure bank verification supported.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckoutForm: React.FC<{
  app: ApplicationState;
  total: string;
  onPaid: (info: PaymentIntentInfo) => void;
}> = ({ app, total, onPaid }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Some payment methods settle asynchronously; poll the server until Stripe reports a final state.
  const verify = async (paymentIntentId: string) => {
    for (let i = 0; i < 10; i++) {
      const status = await getPaymentStatus(paymentIntentId, app.id);
      if (status.paid) return onPaid(status);
      if (status.status !== "processing") break;
      setProcessing(true);
      await new Promise((r) => setTimeout(r, 3000));
    }
    setProcessing(false);
    setMessage(
      "Your payment has not completed yet. If you were charged, contact us with your email and we will sort it out.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setMessage(null);

    const returnUrl = new URL(window.location.href);
    returnUrl.search = "";
    returnUrl.hash = "";
    returnUrl.searchParams.set("payment_return", "1");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.toString() },
      // Cards (incl. 3D Secure) finish in place; only redirect-based methods leave the page.
      redirect: "if_required",
    });

    if (error) {
      setMessage(
        error.type === "card_error" || error.type === "validation_error"
          ? (error.message ?? "Your card was declined.")
          : "Something went wrong while processing your payment. Check the payment status before trying again.",
      );
      setSubmitting(false);
      return;
    }

    try {
      if (paymentIntent) await verify(paymentIntent.id);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not confirm your payment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="checkout-form">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: { name: app.form.fullName, email: app.form.email },
          },
        }}
      />

      {message && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !ready || submitting}
        id="pay-button"
        className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#006644] hover:bg-[#005538] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {processing ? "Waiting for your bank…" : "Processing payment…"}
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {total}
          </>
        )}
      </button>
    </form>
  );
};
