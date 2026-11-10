import React, { useState } from "react";
import {
  CalendarCheck,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
} from "lucide-react";
import type { AccountApi, InvoiceSummary } from "../lib/account";

const money = (minor: number, currency = "eur") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);

/**
 * "Book your call". The booking link only exists in the data once the server has confirmed the
 * payment, so there is nothing to show (or to find in the page) before that.
 */
export const BookCallCard: React.FC<{ bookingUrl: string | null }> = ({
  bookingUrl,
}) => (
  <div
    className="rounded-2xl bg-gradient-to-r from-[#0f1e36] to-[#006644] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    data-testid="book-call-card"
  >
    <div className="flex items-start gap-3">
      <CalendarCheck className="w-6 h-6 text-emerald-300 shrink-0" aria-hidden="true" />
      <div>
        <div className="font-bold font-heading">
          Book your 30-minute consultation call
        </div>
        <p className="text-xs text-slate-200 mt-0.5">
          {bookingUrl
            ? "Pick the day and time that suit you. The booking page opens in a new tab and the booking system emails you the call details."
            : "Your booking button appears here as soon as your payment is confirmed. If it hasn't after a minute, refresh this page."}
        </p>
      </div>
    </div>
    {bookingUrl && (
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        id="book-call-btn"
        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold bg-white text-[#006644] hover:bg-emerald-50"
      >
        Book your call <ExternalLink className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )}
  </div>
);

/** Invoice (with the VAT split) and receipt for a payment, with download buttons. */
export const InvoiceCard: React.FC<{
  invoice: InvoiceSummary | null;
  paymentIntentId: string | undefined;
  api: Pick<AccountApi, "fetchInvoicePdf" | "getReceiptUrl">;
}> = ({ invoice, paymentIntentId, api }) => {
  const [busy, setBusy] = useState<"invoice" | "receipt" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    if (!invoice) return;
    setBusy("invoice");
    setError(null);
    try {
      const { url } = await api.fetchInvoicePdf(invoice.paymentIntentId);
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudyBg-Invoice-${invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the invoice.");
    } finally {
      setBusy(null);
    }
  };

  const openReceipt = async () => {
    if (!paymentIntentId) return;
    setBusy("receipt");
    setError(null);
    try {
      const { url } = await api.getReceiptUrl(paymentIntentId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("Stripe's card receipt isn't available yet. Your invoice below is your proof of payment.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the receipt.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3 text-xs"
      data-testid="invoice-card"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        <Receipt className="w-4 h-4" aria-hidden="true" /> Invoice and receipt
      </div>
      {invoice ? (
        <>
          <dl className="space-y-1.5">
            <Line label="Invoice number" value={invoice.number} mono />
            <Line
              label="Date"
              value={new Date(invoice.issuedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <Line label="Price excluding VAT" value={money(invoice.netAmount, invoice.currency)} />
            <Line
              label={`VAT (${invoice.vatRatePercent}%)`}
              value={money(invoice.vatAmount, invoice.currency)}
            />
            <Line label="Total paid" value={money(invoice.grossAmount, invoice.currency)} strong />
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={download}
              disabled={busy !== null}
              id="download-invoice-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#006644] hover:bg-[#005538] disabled:opacity-60"
            >
              {busy === "invoice" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Download invoice (PDF)
            </button>
            <button
              type="button"
              onClick={openReceipt}
              disabled={busy !== null || !paymentIntentId}
              id="view-receipt-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "receipt" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              View card receipt
            </button>
          </div>
        </>
      ) : (
        <p className="text-slate-600">
          Your invoice is being prepared. It appears here in a moment, and we email it to you as a PDF.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
};

const Line: React.FC<{ label: string; value: string; strong?: boolean; mono?: boolean }> = ({
  label,
  value,
  strong,
  mono,
}) => (
  <div className="flex justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd
      className={`text-right ${strong ? "font-extrabold text-slate-900 text-sm" : "font-semibold text-slate-800"} ${mono ? "font-mono" : ""}`}
    >
      {value}
    </dd>
  </div>
);
