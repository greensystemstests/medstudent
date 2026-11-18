import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { StudentDetailData, adminApi, adminCan } from "../../lib/adminApi";
import { FIELD_LABELS, showField } from "../../lib/applicationLabels";
import { documentStatus, TONE_CLASS } from "../../lib/statusLabels";
import { formatBytes } from "../../lib/account";
import type { PageContext } from "./AdminShell";
import { StatusBadge, universityName } from "./StudentsPage";
import { Badge, Card, Field, GhostButton, Notice, PrimaryButton, formatDate, inputClass } from "./ui";

const REVIEW_STATUSES = [
  { value: "in_review", label: "Being reviewed" },
  { value: "action_needed", label: "Action needed (student must do something)" },
  { value: "review_complete", label: "Review complete" },
];
const DOC_STATUSES = [
  { value: "in_review", label: "Being reviewed" },
  { value: "action_needed", label: "Action needed" },
  { value: "verified", label: "Checked" },
];
const ACTIVITY_LABELS: Record<string, string> = {
  account_created: "Created the account",
  signed_in: "Signed in",
  signed_out: "Signed out",
  document_uploaded: "Uploaded a document",
  document_deleted: "Deleted a document",
  document_viewed: "Opened a document",
  application_in_review: "Review started",
  application_action_needed: "Action requested",
  application_review_complete: "Review completed",
};
const activityLabel = (t: string) => ACTIVITY_LABELS[t] ?? t.replaceAll("_", " ");

export const StudentDetail: React.FC<{
  ctx: PageContext;
  id: string;
  assignable: { id: string; name: string }[];
  onBack: () => void;
  onChanged: () => void;
}> = ({ ctx, id, assignable, onBack, onChanged }) => {
  const [d, setD] = useState<StudentDetailData | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const canManage = adminCan(ctx.admin, "students.manage");
  const canAssign = canManage && ctx.admin.role.studentsScope === "all";

  const load = useCallback(async () => {
    try {
      setD(await adminApi.student(id));
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "ok", text: success });
      await load();
      onChanged();
      return true;
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
      return false;
    }
  };

  const back = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#006644] mb-3" id="student-back">
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All students
    </button>
  );
  if (!d)
    return (
      <div>
        {back}
        {message ? <Notice kind={message.kind}>{message.text}</Notice> : <p className="text-sm text-slate-500" role="status">Loading…</p>}
      </div>
    );

  const form = d.application.form as Record<string, unknown>;
  const paid = d.application.payment.status === "paid";
  const src = d.student.source || {};

  return (
    <div className="space-y-5">
      <div>
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold font-heading text-slate-900">{String(form.fullName || "Name not entered")}</h1>
          <StatusBadge status={d.application.status} />
          {paid ? <Badge tone="green">Paid</Badge> : <Badge tone="amber">Not paid</Badge>}
        </div>
        <p className="text-sm text-slate-600 mt-1">
          {d.student.email} · {String(form.degree || "—")}
          {form.universityId ? ` · ${universityName(String(form.universityId))}` : ""}
        </p>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 space-y-5 min-w-0">
          <Card title="Application answers">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {FIELD_LABELS.map(([k, label]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide">{label}</dt>
                  <dd className="text-slate-900 break-words">{showField(k, form[k])}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title={`Documents (${d.documents.length})`}>
            {d.documents.length === 0 && <p className="text-sm text-slate-500">Nothing uploaded yet.</p>}
            <ul className="space-y-3">
              {d.documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} canManage={canManage} run={run} ctx={ctx} />
              ))}
            </ul>
          </Card>

          <Card title="Activity">
            {d.activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded.</p>
            ) : (
              <ol className="space-y-2.5">
                {d.activity.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800">{activityLabel(a.type)}</span>
                      {a.detail && <span className="text-slate-600"> · {a.detail}</span>}
                      <div className="text-[0.6875rem] text-slate-400">{formatDate(a.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5 min-w-0">
          <Card title="Status">
            <StatusForm paid={paid} canManage={canManage} current={d.application.status} onSubmit={(status, note) => run(() => adminApi.setStatus(id, status, note), "Status updated and the student was notified by email.")} />
          </Card>

          <Card title="Assigned to">
            {canAssign ? (
              <>
                <label htmlFor="assign-select" className="sr-only">
                  Assign this student
                </label>
                <select
                  id="assign-select"
                  value={d.assignedTo?.id ?? ""}
                  onChange={(e) => run(() => adminApi.assign(id, e.target.value || null), e.target.value ? "Assigned." : "Unassigned.")}
                  className={inputClass}
                >
                  <option value="">Nobody yet</option>
                  {assignable.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-[0.6875rem] text-slate-500 mt-2">People with a “only assigned students” role see only the students assigned to them.</p>
              </>
            ) : (
              <p className="text-sm text-slate-700">{d.assignedTo?.name ?? "Nobody yet"}</p>
            )}
          </Card>

          <Card title="Where they came from">
            <dl className="space-y-2 text-sm">
              <Row label="Source" value={src.utm_source || src.referrer || "Direct (no referrer)"} />
              {src.referrer && <Row label="Referring site" value={src.referrer} />}
              {src.utm_medium && <Row label="Medium" value={src.utm_medium} />}
              {src.utm_campaign && <Row label="Campaign" value={src.utm_campaign} />}
              {src.landing && <Row label="First page" value={src.landing} />}
              <Row label="Country (from IP)" value={d.student.signupCountry || "Unknown"} />
              <Row label="Passport country" value={String(form.citizenshipCountry || "—")} />
              <Row label="Account created" value={formatDate(d.student.createdAt)} />
              <Row label="Last sign-in" value={formatDate(d.student.lastLoginAt)} />
            </dl>
          </Card>

          <Card title="Payment">
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={paid ? "Paid" : "Not paid"} />
              {paid && <Row label="Paid on" value={formatDate(d.application.payment.paidAt)} />}
              {paid && <Row label="Amount" value="€180.00 (VAT incl.)" />}
              {d.invoiceNumber && <Row label="Invoice" value={d.invoiceNumber} />}
              {d.application.payment.receiptRef && <Row label="Reference" value={d.application.payment.receiptRef} />}
              <Row label="Step reached" value={`${d.application.currentStep} of 8`} />
            </dl>
          </Card>

          <Card title={`Notes (${d.notes.length})`}>
            <NoteForm canManage={canManage} onAdd={(note) => run(() => adminApi.addNote(id, note), "Note saved.")} />
            <ul className="space-y-3 mt-4">
              {d.notes.map((n) => (
                <li key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                  <p className="text-slate-800 whitespace-pre-wrap break-words">{n.note}</p>
                  <p className="text-[0.6875rem] text-slate-400 mt-0.5">
                    {n.admin_email} · {formatDate(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-slate-500 shrink-0">{label}</dt>
    <dd className="text-right font-semibold text-slate-900 break-words min-w-0">{value}</dd>
  </div>
);

const StatusForm: React.FC<{ paid: boolean; canManage: boolean; current: string; onSubmit: (status: string, note: string) => Promise<boolean> }> = ({ paid, canManage, current, onSubmit }) => {
  const [status, setStatus] = useState(REVIEW_STATUSES.some((s) => s.value === current) ? current : "in_review");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canManage) return <p className="text-sm text-slate-600">Your role can view this student but not change their status.</p>;
  if (!paid) return <p className="text-sm text-slate-600">The status can be changed once the student has paid.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onSubmit(status, note)) setNote("");
        setBusy(false);
      }}
    >
      <Field label="New status" htmlFor="status-select">
        <select id="status-select" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          {REVIEW_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Message for the student" htmlFor="status-note" hint="They see this note in their account and get an email.">
        <textarea id="status-note" required rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      <PrimaryButton type="submit" busy={busy} disabled={!note.trim()} className="w-full" id="status-save">
        Update status and notify
      </PrimaryButton>
    </form>
  );
};

const NoteForm: React.FC<{ canManage: boolean; onAdd: (note: string) => Promise<boolean> }> = ({ canManage, onAdd }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canManage) return <p className="text-xs text-slate-500">Internal notes. Your role can read them but not add.</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onAdd(note)) setNote("");
        setBusy(false);
      }}
    >
      <label htmlFor="note-text" className="sr-only">
        Internal note
      </label>
      <textarea id="note-text" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (the student doesn't see this)" className={inputClass} />
      <PrimaryButton type="submit" busy={busy} disabled={!note.trim()} className="!min-h-9 !px-4 !py-1.5 !text-xs" id="note-save">
        Add note
      </PrimaryButton>
    </form>
  );
};

const DocumentRow: React.FC<{
  doc: StudentDetailData["documents"][number];
  canManage: boolean;
  ctx: PageContext;
  run: (action: () => Promise<unknown>, success: string) => Promise<boolean>;
}> = ({ doc, canManage, ctx, run }) => {
  const [status, setStatus] = useState(doc.status === "received" ? "in_review" : doc.status);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = documentStatus(doc.status);

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      const { url } = await adminApi.documentFile(doc.id);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(ctx.fail(err));
    } finally {
      setOpening(false);
    }
  };

  return (
    <li className="rounded-xl border border-slate-200 p-3.5 space-y-2.5" data-testid="doc-row">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-900 break-all">{doc.filename}</span>
        <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full border ${TONE_CLASS[st.tone]}`}>{st.label}</span>
      </div>
      <p className="text-xs text-slate-500">
        {doc.categoryLabel} · {formatBytes(doc.sizeBytes)} · uploaded {formatDate(doc.createdAt)}
      </p>
      {doc.reviewNote && <p className="text-xs text-slate-700">Last note: {doc.reviewNote}</p>}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <GhostButton onClick={open} disabled={opening}>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> {opening ? "Opening…" : "Open"}
        </GhostButton>
        {canManage && (
          <GhostButton onClick={() => setReviewing(!reviewing)}>{reviewing ? "Cancel" : "Review"}</GhostButton>
        )}
      </div>
      {reviewing && (
        <form
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => adminApi.reviewDocument(doc.id, status, note), "Document reviewed and the student was notified.")) setReviewing(false);
          }}
        >
          <select aria-label="Document status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} !py-2 text-xs`}>
            {DOC_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input aria-label="Note for the student" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the student" className={`${inputClass} !py-2 text-xs sm:col-span-2`} />
          <PrimaryButton type="submit" disabled={!note.trim()} className="!min-h-9 !px-4 !py-1.5 !text-xs sm:col-span-3 sm:w-fit">
            Save review
          </PrimaryButton>
        </form>
      )}
    </li>
  );
};
