import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006644]/30 focus:border-[#006644] disabled:bg-slate-50";

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }> = ({
  busy,
  children,
  className = "",
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || busy}
    className={`inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#006644] hover:bg-[#005538] disabled:opacity-60 ${className}`}
  >
    {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }> = ({
  tone = "default",
  children,
  className = "",
  ...rest
}) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
      tone === "danger"
        ? "border-red-200 text-red-700 hover:bg-red-50"
        : "border-slate-200 text-slate-700 hover:bg-slate-50"
    } ${className}`}
  >
    {children}
  </button>
);

export const Card: React.FC<{ title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  action,
  children,
  className = "",
}) => (
  <section className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${className}`}>
    {(title || action) && (
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="text-base font-bold font-heading text-slate-900">{title}</h2>
        {action}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const Notice: React.FC<{ kind: "error" | "ok" | "info"; children: React.ReactNode }> = ({ kind, children }) => (
  <p
    role={kind === "error" ? "alert" : "status"}
    className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
      kind === "error"
        ? "bg-red-50 border-red-200 text-red-800"
        : kind === "ok"
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-slate-50 border-slate-200 text-slate-700"
    }`}
  >
    {kind === "error" ? (
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
    ) : kind === "ok" ? (
      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
    ) : null}
    <span>{children}</span>
  </p>
);

export const Badge: React.FC<{ tone?: "green" | "amber" | "slate" | "red"; children: React.ReactNode }> = ({ tone = "slate", children }) => (
  <span
    className={`inline-flex items-center text-[0.6875rem] font-bold px-2 py-0.5 rounded-full border ${
      tone === "green"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : tone === "red"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-slate-100 text-slate-700 border-slate-200"
    }`}
  >
    {children}
  </span>
);

export const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div>
    <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 mb-1.5">
      {label}
    </label>
    {children}
    {hint && <p className="text-[0.6875rem] text-slate-500 mt-1">{hint}</p>}
  </div>
);

/** A six-digit code box that suits phones (numeric keypad, one-time-code autofill). */
export const CodeInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}> = ({ id, value, onChange, autoFocus, disabled }) => (
  <input
    id={id}
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9]*"
    maxLength={6}
    autoFocus={autoFocus}
    disabled={disabled}
    placeholder="123456"
    className={`${inputClass} text-center text-2xl font-extrabold tracking-[0.5em] font-mono`}
  />
);

export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
