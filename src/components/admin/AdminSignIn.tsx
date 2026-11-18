import React, { useEffect, useRef, useState } from "react";
import { KeyRound, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { AdminApiError, AdminProfile, adminApi, setAdminToken } from "../../lib/adminApi";
import { CodeInput, Field, Notice, PrimaryButton, errorText, inputClass } from "./ui";

export type SignInStep =
  | { kind: "email" }
  | { kind: "code"; email: string }
  | { kind: "totp"; email: string }
  | { kind: "enroll"; email: string };

interface Props {
  initial?: SignInStep;
  onDone: (admin: AdminProfile, recoveryCodes?: string[]) => void;
}

/**
 * Two steps, both needed: a code we email (proves the mailbox) and a code from an authenticator app
 * such as Google Authenticator (proves the phone). The first time, the app is set up by scanning a QR code.
 */
export const AdminSignIn: React.FC<Props> = ({ initial = { kind: "email" }, onDone }) => {
  const [step, setStep] = useState<SignInStep>(initial);
  const stepNo = step.kind === "email" || step.kind === "code" ? 1 : 2;
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-xl bg-[#006644] text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="font-heading font-extrabold text-xl text-slate-900">StudyBg Admin</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-7">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Step {stepNo} of 2</p>
          {step.kind === "email" && <EmailStep onNext={(email) => setStep({ kind: "code", email })} />}
          {step.kind === "code" && (
            <CodeStep
              email={step.email}
              onBack={() => setStep({ kind: "email" })}
              onNext={(stage) => setStep({ kind: stage, email: step.email })}
            />
          )}
          {step.kind === "totp" && <TotpStep onDone={onDone} onRestart={() => setStep({ kind: "email" })} />}
          {step.kind === "enroll" && <EnrollStep onDone={onDone} onRestart={() => setStep({ kind: "email" })} />}
        </div>
        <p className="text-center text-xs text-slate-500 mt-5">Staff only. Every sign-in is recorded.</p>
      </div>
    </div>
  );
};

const EmailStep: React.FC<{ onNext: (email: string) => void }> = ({ onNext }) => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.requestCode(email.trim());
      onNext(email.trim().toLowerCase());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold font-heading text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#006644]" aria-hidden="true" /> Sign in
        </h1>
        <p className="text-sm text-slate-600 mt-1">Enter your work email. We'll email you a code, then ask for the code from your authenticator app.</p>
      </div>
      <Field label="Email" htmlFor="admin-email">
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@company.com"
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <PrimaryButton type="submit" busy={busy} className="w-full" id="admin-email-btn">
        Email me a code
      </PrimaryButton>
    </form>
  );
};

const CodeStep: React.FC<{ email: string; onBack: () => void; onNext: (stage: "totp" | "enroll") => void }> = ({ email, onBack, onNext }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.verifyCode(email, code);
      setAdminToken(res.token);
      onNext(res.stage === "enroll" ? "enroll" : "totp");
    } catch (err) {
      setError(errorText(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setError(null);
    try {
      await adminApi.requestCode(email);
      setResent(true);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold font-heading text-slate-900">Check your email</h1>
        <p className="text-sm text-slate-600 mt-1">
          If <strong>{email}</strong> has an admin account, a 6-digit code is on its way. It expires in 10 minutes.
        </p>
      </div>
      <Field label="Code from the email" htmlFor="admin-email-code">
        <CodeInput id="admin-email-code" value={code} onChange={setCode} autoFocus />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      {resent && <Notice kind="info">If the account exists, a new code was sent. Codes can be re-sent every 30 seconds.</Notice>}
      <PrimaryButton type="submit" busy={busy} disabled={code.length !== 6} className="w-full" id="admin-code-btn">
        Continue
      </PrimaryButton>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={onBack} className="text-slate-600 underline">
          Use a different email
        </button>
        <button type="button" onClick={resend} className="text-[#006644] font-semibold underline">
          Send the code again
        </button>
      </div>
    </form>
  );
};

const TotpStep: React.FC<{ onDone: Props["onDone"]; onRestart: () => void }> = ({ onDone, onRestart }) => {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.verifyTotp(useRecovery ? { recoveryCode: recovery } : { code });
      setAdminToken(res.token);
      onDone(res.admin);
    } catch (err) {
      setCode("");
      setRecovery("");
      if (err instanceof AdminApiError && err.status === 401 && /sign in again/i.test(err.message)) {
        setAdminToken(null);
        setError(err.message);
        window.setTimeout(onRestart, 1500);
      } else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold font-heading text-slate-900 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#006644]" aria-hidden="true" /> Authenticator code
        </h1>
        <p className="text-sm text-slate-600 mt-1">Open your authenticator app (Google Authenticator or similar) and enter the 6-digit code for StudyBg Admin.</p>
      </div>
      {useRecovery ? (
        <Field label="Recovery code" htmlFor="admin-recovery" hint="Each recovery code works once.">
          <input
            id="admin-recovery"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="abcd-efgh"
            className={`${inputClass} font-mono`}
          />
        </Field>
      ) : (
        <Field label="Code from your app" htmlFor="admin-totp">
          <CodeInput id="admin-totp" value={code} onChange={setCode} autoFocus />
        </Field>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <PrimaryButton type="submit" busy={busy} disabled={useRecovery ? recovery.trim().length < 8 : code.length !== 6} className="w-full" id="admin-totp-btn">
        Sign in
      </PrimaryButton>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={() => { setUseRecovery(!useRecovery); setError(null); }} className="text-[#006644] font-semibold underline">
          {useRecovery ? "Use my authenticator app" : "I lost my phone: use a recovery code"}
        </button>
        <button type="button" onClick={() => { setAdminToken(null); onRestart(); }} className="text-slate-600 underline">
          Start over
        </button>
      </div>
    </form>
  );
};

const EnrollStep: React.FC<{ onDone: Props["onDone"]; onRestart: () => void }> = ({ onDone, onRestart }) => {
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await adminApi.enrollStart();
        setSecret(res.secret);
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(res.uri, { margin: 1, width: 224 }));
      } catch (err) {
        setError(errorText(err));
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.enrollConfirm(code);
      setAdminToken(res.token);
      onDone(res.admin, res.recoveryCodes);
    } catch (err) {
      setCode("");
      if (err instanceof AdminApiError && /sign in again/i.test(err.message)) {
        setAdminToken(null);
        setError(err.message);
        window.setTimeout(onRestart, 1500);
      } else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold font-heading text-slate-900 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#006644]" aria-hidden="true" /> Set up your authenticator
        </h1>
        <p className="text-sm text-slate-600 mt-1">One-time setup. From now on you'll sign in with an emailed code and a code from your phone.</p>
      </div>
      <ol className="text-sm text-slate-700 space-y-1 list-decimal pl-5">
        <li>Install <strong>Google Authenticator</strong> (or Authy, 1Password, Microsoft Authenticator).</li>
        <li>Add an account and scan this QR code.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 bg-white">
        {qr ? (
          <img src={qr} alt="QR code to add StudyBg Admin to your authenticator app" width={224} height={224} />
        ) : (
          <div className="w-56 h-56 rounded-lg bg-slate-100 animate-pulse" aria-hidden="true" />
        )}
        {secret && (
          <p className="text-[0.6875rem] text-slate-500 text-center">
            Can't scan? Enter this key in the app:
            <br />
            <code className="font-mono text-xs text-slate-800 break-all select-all" id="admin-totp-secret">{secret}</code>
          </p>
        )}
      </div>
      <Field label="Code from your app" htmlFor="admin-enroll-code">
        <CodeInput id="admin-enroll-code" value={code} onChange={setCode} />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <PrimaryButton type="submit" busy={busy} disabled={code.length !== 6 || !secret} className="w-full" id="admin-enroll-btn">
        Turn on two-step sign-in
      </PrimaryButton>
      <button type="button" onClick={() => { setAdminToken(null); onRestart(); }} className="text-xs text-slate-600 underline">
        Start over
      </button>
    </form>
  );
};
