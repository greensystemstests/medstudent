import React, { useEffect, useState } from "react";
import { request } from "../lib/api";
import { getSessionToken, liveAccountApi } from "../lib/account";
import { SignIn } from "./AccountView";
import { ApplicationState } from "../types";
type Row = {
  id: string;
  name: string;
  email: string;
  degree: string;
  status: string;
};
type Detail = {
  application: ApplicationState;
  documents: {
    id: string;
    filename: string;
    status: string;
    review_note: string;
  }[];
  history: {
    action: string;
    detail: Record<string, unknown>;
    created_at: string;
  }[];
  deliveries: {
    id: string;
    kind: string;
    state: string;
    attempts: number;
    last_error: string;
  }[];
};
const button =
  "px-4 py-2 rounded-lg bg-[#006644] text-white disabled:opacity-50";
export function StaffReviewView() {
  const [signed, setSigned] = useState(liveAccountApi.isSignedIn()),
    [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setRows(
        (await request<{ applications: Row[] }>("/api/staff/applications"))
          .applications,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (signed) refresh();
  }, [signed]);
  async function open(id: string) {
    setBusy(true);
    try {
      setDetail(
        await request<Detail>(
          `/api/staff/applications/${encodeURIComponent(id)}`,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(path: string, status: string, note: string) {
    setBusy(true);
    try {
      await request(path, {
        method: "POST",
        body: JSON.stringify({ status, note }),
      });
      if (detail) await open(detail.application.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function document(id: string) {
    setBusy(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
        /\/+$/,
        "",
      );
      const res = await fetch(`${base}/api/staff/documents/${id}/file`, {
        headers: { authorization: `Bearer ${getSessionToken()}` },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error("Document could not be opened.");
      const url = URL.createObjectURL(await res.blob());
      const a = window.document.createElement("a");
      a.href = url;
      a.download =
        detail?.documents.find((d) => d.id === id)?.filename || "document";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!signed)
    return (
      <div className="p-6">
        <SignIn api={liveAccountApi} onSignedIn={() => setSigned(true)} />
      </div>
    );
  return (
    <div className="max-w-6xl mx-auto p-5 space-y-6">
      <h1 className="text-3xl font-bold">Staff review</h1>
      <p>
        Access is restricted to configured staff accounts. Reviews and document
        access are recorded.
      </p>
      {error && (
        <p role="alert" className="bg-red-50 p-4">
          {error}
        </p>
      )}
      <button className={button} onClick={refresh}>
        Refresh
      </button>
      <div className="grid md:grid-cols-[1fr_2fr] gap-6">
        <section aria-label="Applications" className="space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              disabled={busy}
              onClick={() => open(r.id)}
              className="block w-full text-left border rounded-xl p-4 bg-white"
            >
              <strong>{r.name || r.email}</strong>
              <p>
                {r.degree} · {r.status.replaceAll("_", " ")}
              </p>
            </button>
          ))}
        </section>
        {detail && (
          <section className="space-y-5 min-w-0">
            <h2 className="text-xl font-bold">
              {detail.application.form.fullName}
            </h2>
            <dl className="bg-white p-4 border rounded-xl grid sm:grid-cols-2 gap-3">
              {Object.entries(detail.application.form).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">
                    {k.replace(/([A-Z])/g, " $1")}
                  </dt>
                  <dd className="break-words">
                    {typeof v === "boolean"
                      ? v
                        ? "Yes"
                        : "No"
                      : String(v) || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <ReviewForm
              busy={busy}
              statuses={["in_review", "action_needed", "review_complete"]}
              onSave={(s, n) =>
                review(
                  `/api/staff/applications/${detail.application.id}/review`,
                  s,
                  n,
                )
              }
            />
            <h3 className="font-bold">Documents</h3>
            {detail.documents.map((d) => (
              <div
                key={d.id}
                className="bg-white border rounded-xl p-4 space-y-3"
              >
                <strong>{d.filename}</strong>
                <p>
                  {d.status} · {d.review_note}
                </p>
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => document(d.id)}
                >
                  Download for review
                </button>
                <ReviewForm
                  busy={busy}
                  statuses={["in_review", "action_needed", "verified"]}
                  onSave={(s, n) =>
                    review(`/api/staff/documents/${d.id}/review`, s, n)
                  }
                />
              </div>
            ))}
            <h3 className="font-bold">Email processing</h3>
            <p className="text-sm">
              Accepted means accepted by the email provider; it does not confirm
              inbox delivery. Jobs needing review must be reconciled with the
              provider before retrying.
            </p>
            {detail.deliveries.map((d) => (
              <p key={d.id} className="text-sm break-words">
                {d.kind}: {d.state} · {d.attempts} attempts{" "}
                {d.last_error && `· ${d.last_error}`}
              </p>
            ))}
            <h3 className="font-bold">Review history</h3>
            {detail.history.map((h, i) => (
              <p key={i} className="text-sm">
                {new Date(h.created_at).toLocaleString()} · {h.action} ·{" "}
                {String(h.detail.note || "")}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
function ReviewForm({
  statuses,
  busy,
  onSave,
}: {
  statuses: string[];
  busy: boolean;
  onSave: (s: string, n: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(statuses[0]),
    [note, setNote] = useState("");
  return (
    <form
      className="space-y-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(status, note).then(() => setNote(""));
      }}
    >
      <label className="block">
        Review status
        <select
          className="block border rounded p-2 w-full"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Note for applicant
        <textarea
          required
          maxLength={2000}
          className="block border rounded p-2 w-full"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button disabled={busy || !note.trim()} className={button}>
        Save review & queue notification
      </button>
    </form>
  );
}
