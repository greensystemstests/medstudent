import React, { useEffect, useState } from "react";
import { request } from "../lib/api";
import { getSessionToken, liveAccountApi } from "../lib/account";
import { SignIn } from "./AccountView";
import { ApplicationState } from "../types";
import { UNIVERSITIES } from "../../shared/admissions.js";
import {
  applicationStatus,
  documentStatus,
  TONE_CLASS,
} from "../lib/statusLabels";

/** Readable names for the saved form fields, in the order staff read them. */
const FIELD_LABELS: [keyof ApplicationState["form"], string][] = [
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["nationalityCategory", "Immigration category"],
  ["citizenshipCountry", "Passport country"],
  ["schoolCountry", "School qualification country"],
  ["highSchoolCurriculum", "Curriculum"],
  ["graduationYear", "Graduation year"],
  ["degree", "Degree"],
  ["universityId", "University"],
  ["intakeSeason", "Intake"],
  ["biologyGrade", "Biology (%)"],
  ["chemistryGrade", "Chemistry (%)"],
  ["englishProficiency", "English"],
  ["hasDiploma", "Has diploma"],
  ["hasTranscript", "Has transcript"],
  ["hasHagueApostilleAccess", "Can get apostille/legalisation"],
  ["hasMedicalCertificate", "Has medical certificate"],
  ["hasPoliceClearance", "Has police clearance"],
  ["examDate", "Exam session"],
  ["swornTranslationRequested", "Wants translation help"],
  ["dhlPickupAddress", "Collection address"],
  ["consultationDate", "Preferred call day"],
  ["consultationWindow", "Preferred call time"],
  ["accuracySigned", "Accuracy confirmed"],
  ["termsAgreed", "Terms accepted"],
  ["gdprAgreed", "Privacy notice acknowledged"],
];

const show = (key: string, v: unknown) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "universityId") return UNIVERSITIES.find((u) => u.id === v)?.name ?? String(v || "—");
  if (key === "examDate" && v === "advisor") return "Decide with adviser";
  return String(v ?? "").replaceAll("_", " ") || "—";
};

const Badge: React.FC<{ label: string; tone: keyof typeof TONE_CLASS }> = ({ label, tone }) => (
  <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${TONE_CLASS[tone]}`}>
    {label}
  </span>
);
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
    [loaded, setLoaded] = useState(false),
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
    } finally {
      setLoaded(true);
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
      <div className="max-w-6xl mx-auto p-5 space-y-4">
        <h1 className="text-2xl font-bold font-heading text-slate-900">Staff review</h1>
        <p className="text-sm text-slate-700">
          For StudyBg staff only. Sign in with your staff email; accounts not on
          the staff list can’t see any applications.
        </p>
        <SignIn embedded api={liveAccountApi} onSignedIn={() => setSigned(true)} />
      </div>
    );
  return (
    <div className="max-w-6xl mx-auto p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">Staff review</h1>
        <button className={button + " min-h-11"} onClick={refresh} disabled={busy}>
          Refresh queue
        </button>
      </div>
      <p className="text-sm text-slate-700">
        Only accounts on the staff list can use this page. Every document you
        open and every review you save is recorded in the audit log.
      </p>
      {error && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-sm">
          {/403|staff access/i.test(error)
            ? "This account isn’t on the staff list, so no applications are shown."
            : error}
        </p>
      )}
      {!loaded && !error && (
        <p role="status" className="text-sm text-slate-600">Loading the queue…</p>
      )}
      {loaded && !error && rows.length === 0 && (
        <p className="text-sm text-slate-600">No submitted applications in the queue.</p>
      )}
      <div className="grid md:grid-cols-[1fr_2fr] gap-6">
        <section aria-label="Application queue" className="space-y-3">
          {rows.map((r) => {
            const st = applicationStatus(r.status);
            return (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => open(r.id)}
                aria-current={detail?.application.id === r.id ? "true" : undefined}
                className={`block w-full text-left border rounded-xl p-4 bg-white space-y-1 ${detail?.application.id === r.id ? "border-[#006644] ring-1 ring-[#006644]" : "border-slate-200"}`}
              >
                <strong className="block text-slate-900 break-words">{r.name || r.email}</strong>
                <span className="block text-sm text-slate-600">{r.degree}</span>
                <Badge label={st.label} tone={st.tone} />
              </button>
            );
          })}
        </section>
        {detail && (
          <section className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                {detail.application.form.fullName}
              </h2>
              <Badge {...applicationStatus(detail.application.status)} />
            </div>
            <dl className="bg-white p-4 border border-slate-200 rounded-xl grid sm:grid-cols-2 gap-3">
              {FIELD_LABELS.map(([k, label]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-600">{label}</dt>
                  <dd className="break-words text-sm text-slate-900">
                    {show(k, detail.application.form[k])}
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className="font-bold">Application review</h3>
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
            {detail.documents.length === 0 && (
              <p className="text-sm text-slate-600">No documents uploaded yet.</p>
            )}
            {detail.documents.map((d) => (
              <div
                key={d.id}
                className="bg-white border rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-all">{d.filename}</strong>
                  <Badge {...documentStatus(d.status)} />
                </div>
                {d.review_note && (
                  <p className="text-sm text-slate-700">Last note: {d.review_note}</p>
                )}
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
              {s === "verified" ? documentStatus(s).label : applicationStatus(s).label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Note for the applicant (they will see this)
        <textarea
          required
          maxLength={2000}
          className="block border rounded p-2 w-full"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button disabled={busy || !note.trim()} className={button}>
        Save review and notify the applicant
      </button>
    </form>
  );
}
