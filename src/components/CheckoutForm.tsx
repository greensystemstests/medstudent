import React, { useEffect, useState } from "react";
// "/pure" loads Stripe.js only when loadStripe() is called (the main entry loads it on every page).
import { loadStripe } from "@stripe/stripe-js/pure";
import { AlertCircle, Loader2 } from "lucide-react";

/** Look and feel configured in Stripe Checkout Studio. */
const appearance = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "default",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
} as const;

interface CheckoutFormProps {
  publishableKey: string;
  clientSecret: string;
  sessionId: string;
}

/**
 * Stripe's embedded Checkout form (ui_mode "form"). Stripe.js is loaded from js.stripe.com when this
 * mounts (never bundled), and card details go straight to Stripe's iframe. When the payment goes
 * through we return to /apply/?checkout=success…, where App confirms it with the server.
 */
export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  publishableKey,
  clientSecret,
  sessionId,
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let form: { unmount: () => void; destroy: () => void } | undefined;
    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled) {
          if (!stripe) throw new Error("Stripe could not be loaded. Check your connection and try again.");
          return;
        }
        const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance });
        const checkoutForm = checkout.createForm({ layout: "expanded" });
        form = checkoutForm;
        checkoutForm.on("ready", () => !cancelled && setReady(true));
        checkoutForm.mount("#checkout-form");
        const loaded = await checkout.loadActions();
        if (loaded.type !== "success") throw new Error(loaded.error.message);
        checkoutForm.on("confirm", async (event) => {
          setError(null);
          const returnUrl = `${window.location.origin}/apply/?checkout=success&session_id=${encodeURIComponent(sessionId)}`;
          try {
            const result = await loaded.actions.confirm({
              formConfirmEvent: event,
              returnUrl,
              redirect: "if_required",
            });
            if (result.type === "error") setError(result.error.message);
            // Paid without a bank redirect: the same return page confirms it with the server.
            else window.location.assign(returnUrl);
          } catch (e) {
            setError((e as Error).message || "The payment could not be confirmed.");
          }
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "The payment form could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
      try {
        form?.unmount();
        form?.destroy();
      } catch {
        // Already gone.
      }
    };
  }, [publishableKey, clientSecret, sessionId]);

  return (
    <div className="space-y-3">
      {!ready && !error && (
        <p role="status" className="flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading the secure payment form…
        </p>
      )}
      <div id="checkout-form" role="group" aria-label="Payment form" />
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
