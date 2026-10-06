import React, { useEffect, useState } from "react";
import { ApplicationState } from "../types";
import {
  getApplication,
  listApplications,
  saveOnline,
  reopenApplication,
  request,
} from "../lib/api";
import { liveAccountApi } from "../lib/account";
import { SignIn } from "./AccountView";
import { applicationStatus, TONE_CLASS } from "../lib/statusLabels";
import { UNIVERSITIES } from "../../shared/admissions.js";

const button =
  "rounded-lg bg-[#006644] text-white px-4 py-2 text-sm disabled:opacity-50";
export function OnlineSave({
  app,
  onSaved,
}: {
  app: ApplicationState;
  onSaved: (app: ApplicationState) => void;
}) {
  const [open, setOpen] = useState(false),
    [signed, setSigned] = useState(liveAccountApi.isSignedIn()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [savedOnline, setSavedOnline] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const saved = await saveOnline(app);
      onSaved(saved);
      setSavedOnline(true);
      setMessage(
        "Saved to your account. You can resume it from My Account on any device.",
      );
    } catch (e) {
      setSavedOnline(false);
      setMessage(
        `Couldn't save to your account: ${(e as Error).message} Your draft is still saved on this device.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
      <p className="text-sm text-slate-700 flex-1">
        <strong>{savedOnline ? "Saved to your account." : "Saved on this device only."}</strong>{" "}
        {savedOnline
          ? "Save again after making changes."
          : "To continue on another device, sign in and save it to your account."}
      </p>
      <button
        className={button + " min-h-11 self-start sm:self-auto"}
        onClick={() => (signed ? save() : setOpen(!open))}
        disabled={busy || app.status === "checkout"}
      >
        {busy ? "Saving…" : signed ? "Save to my account" : "Sign in to save online"}
      </button>
      {app.status === "checkout" && (
        <p className="text-sm basis-full">
          Checkout is locked to your saved details. Use My Account to cancel the
          unpaid checkout and edit.
        </p>
      )}
      {open && !signed && (
        <div className="basis-full">
        <SignIn embedded
          api={liveAccountApi}
          defaultEmail={app.form.email}
          onSignedIn={() => {
            setSigned(true);
            setOpen(false);
            setMessage("Signed in. Select “Save to my account” to save this draft.");
          }}
        />
        </div>
      )}
      {message && (
        <p role="status" className="text-sm basis-full">
          {message}
        </p>
      )}
    </div>
  );
}
export function SavedApplications({
  onResume,
}: {
  onResume: (app: ApplicationState) => void;
}) {
  const [apps, setApps] = useState<ApplicationState[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [staff, setStaff] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    listApplications()
      .then((r) => setApps(r.applications))
      .catch((e) =>
        setError(
          `We couldn't load your saved applications: ${e.message} Drafts on this device are not affected.`,
        ),
      )
      .finally(() => setLoading(false));
    request("/api/staff/me")
      .then(() => setStaff(true))
      .catch(() => {});
  }, []);
  async function open(a: ApplicationState, reopen = false) {
    setBusy(true);
    setError("");
    try {
      const saved = reopen
        ? await reopenApplication(a.id)
        : await getApplication(a.id);
      onResume({
        ...saved,
        currentStep: saved.status === "checkout" ? 8 : saved.currentStep,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="saved-apps-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="saved-apps-title" className="font-bold font-heading text-lg text-slate-900">
          Your applications
        </h2>
        {staff && (
          <a href="/review/" className="min-h-11 inline-flex items-center text-sm font-semibold underline text-[#006644]">
            Open staff review
          </a>
        )}
      </div>
      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading your applications…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm rounded-xl bg-red-50 border border-red-200 text-red-900 p-3">
          {error}
        </p>
      )}
      {!loading && !apps.length && !error && (
        <p className="text-sm text-slate-600">
          Nothing saved to your account yet. In your application, choose{" "}
          <strong>Save to my account</strong> to keep a copy you can open on any device.
        </p>
      )}
      <ul className="space-y-3">
        {apps.map((a) => {
          const st = applicationStatus(a.status);
          return (
            <li
              key={a.id}
              className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-slate-900">
                    {a.form.degree}
                    {UNIVERSITIES.find((u) => u.id === a.form.universityId)?.name.replace(/^/, " · ") ?? ""}
                  </strong>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TONE_CLASS[st.tone]}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{a.form.fullName || "Name not entered yet"}</p>
                {st.next && (
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Next: </span>
                    {st.next}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} className={button + " min-h-11"} onClick={() => open(a)}>
                  {a.status === "draft" ? "Resume" : "Open"}
                </button>
                {a.status === "checkout" && a.payment.status !== "paid" && (
                  <button
                    disabled={busy}
                    className="min-h-11 px-3 underline text-sm font-semibold text-slate-800"
                    onClick={() => open(a, true)}
                  >
                    Cancel checkout &amp; edit
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
export function ServiceNotice() {
  const [state, setState] = useState(
    "Checking account and payment availability…",
  );
  useEffect(() => {
    let active = true;
    request<{ accountsReady: boolean; paymentsReady: boolean }>("/api/health")
      .then((s) => {
        if (active)
          setState(
            s.paymentsReady
              ? ""
              : s.accountsReady
                ? "Online payment opens soon. You can already fill in your application and save it to your account."
                : "Online payment and accounts open soon. You can already fill in your application; it is saved on this device.",
          );
      })
      .catch(() => {
        if (active)
          setState(
            "We can't reach our online service right now. Your application is still saved on this device.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return state ? (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 px-5 py-3 text-sm text-amber-950"
    >
      {state}
    </div>
  ) : null;
}
