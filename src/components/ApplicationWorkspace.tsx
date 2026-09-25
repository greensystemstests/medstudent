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
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    try {
      const saved = await saveOnline(app);
      onSaved(saved);
      setMessage(
        "Saved online. Resume this draft from My Account on any device.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-6 p-4 rounded-xl border bg-white space-y-3">
      <p className="text-sm">
        Your draft is kept on this device. Sign in and save online to keep a
        copy in your account.
      </p>
      <button
        className={button}
        onClick={() => (signed ? save() : setOpen(!open))}
        disabled={busy || app.status === "checkout"}
      >
        {busy ? "Saving…" : "Save online"}
      </button>
      {app.status === "checkout" && (
        <p className="text-sm">
          Checkout is locked to your saved details. Use My Account to cancel the
          unpaid checkout and edit.
        </p>
      )}
      {open && !signed && (
        <SignIn
          api={liveAccountApi}
          defaultEmail={app.form.email}
          onSignedIn={() => {
            setSigned(true);
            setOpen(false);
            setMessage("Signed in. Select Save online to save this draft.");
          }}
        />
      )}
      {message && (
        <p role="status" className="text-sm">
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
    [error, setError] = useState(""),
    [staff, setStaff] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    listApplications()
      .then((r) => setApps(r.applications))
      .catch((e) => setError(e.message));
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
    <section className="rounded-xl border bg-white p-5 mb-6 space-y-3">
      <h2 className="font-bold text-lg">Saved applications</h2>
      {staff && (
        <a href="#/review" className="underline text-[#006644]">
          Open staff review
        </a>
      )}
      {error && <p role="alert">{error}</p>}
      {!apps.length && !error && (
        <p className="text-sm">
          No online drafts yet. Choose Save online in your application.
        </p>
      )}
      {apps.map((a) => (
        <div
          key={a.id}
          className="border-t pt-3 flex flex-wrap gap-3 items-center"
        >
          <div className="flex-1 min-w-0">
            <strong>
              {a.form.fullName || "Untitled draft"} · {a.form.degree}
            </strong>
            <p className="text-sm break-all">
              {a.id} · {a.status?.replaceAll("_", " ")}
            </p>
          </div>
          <button disabled={busy} className={button} onClick={() => open(a)}>
            Open
          </button>
          {a.status === "checkout" && a.payment.status !== "paid" && (
            <button
              disabled={busy}
              className="underline text-sm"
              onClick={() => open(a, true)}
            >
              Cancel checkout & edit
            </button>
          )}
        </div>
      ))}
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
                ? "Online payments are not available yet. You can save a draft to your account."
                : "Accounts and payments are being configured. You can explore the site and keep a draft on this device.",
          );
      })
      .catch(() => {
        if (active)
          setState(
            "The online service is temporarily unavailable. Your local draft remains on this device.",
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
