import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { AffiliateData, AffiliateDetail, AffiliateLink, AffiliateLinkInput, AffiliateRollup, adminApi, adminCan } from "../../lib/adminApi";
import type { PageContext } from "./AdminShell";
import { Badge, Card, Field, GhostButton, Notice, PrimaryButton, formatDate, inputClass } from "./ui";

export const money = (cents: number) => `${cents < 0 ? "−" : ""}€${(Math.abs(cents) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "–");
export const linkUrl = (l: Pick<AffiliateLink, "destination" | "code">) => `${window.location.origin}${l.destination}?ref=${l.code}`;

const WINDOWS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];
const LANDING = [
  { path: "/", label: "Home page" },
  { path: "/apply/", label: "Start an application" },
  { path: "/study-medicine-in-bulgaria/", label: "Guide to studying medicine in Bulgaria" },
  { path: "/universities/", label: "Universities" },
  { path: "/student-stories/", label: "Student stories" },
  { path: "/admissions-calendar/", label: "Admissions calendar" },
];

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="text-2xl font-extrabold font-heading text-slate-900 mt-1">{value}</div>
    {hint && <div className="text-[0.6875rem] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = "Copy link" }) => {
  const [done, setDone] = useState(false);
  return (
    <GhostButton
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copy this link:", text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
      {done ? "Copied" : label}
    </GhostButton>
  );
};

const emptyForm = (sourceId: string): AffiliateLinkInput => ({ name: "", sourceId, commissionEur: "20", destination: "/", notes: "", code: "", status: "active" });

const LinkForm: React.FC<{
  data: AffiliateData;
  initial?: AffiliateLink;
  onDone: (message: string) => void;
  onCancel: () => void;
  ctx: PageContext;
}> = ({ data, initial, onDone, onCancel, ctx }) => {
  const [f, setF] = useState<AffiliateLinkInput>(
    initial
      ? { name: initial.name, sourceId: initial.sourceId, commissionEur: (initial.commissionCents / 100).toString(), destination: initial.destination, notes: initial.notes, status: initial.status }
      : emptyForm(data.sources[0]?.id ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AffiliateLinkInput>) => setF((cur) => ({ ...cur, ...patch }));
  const presetPaths = LANDING.map((l) => l.path);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (initial) {
        await adminApi.updateLink(initial.id, f);
        onDone("Link saved.");
      } else {
        const r = await adminApi.createLink(f);
        onDone(`Link created. Its code is “${r.code}”.`);
      }
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setError(text);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4" id="link-form">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Who or what is this link for?" htmlFor="lf-name" hint="For example “Maria, Instagram” or “Medschool Fair 2027”.">
          <input id="lf-name" required maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Source (brand or channel)" htmlFor="lf-source" hint="Used to group results, and shown as “came from” on each student.">
          <select id="lf-source" required value={f.sourceId} onChange={(e) => set({ sourceId: e.target.value })} className={inputClass}>
            {data.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Commission per paying student (€)"
          htmlFor="lf-commission"
          hint={initial ? "Changing this only affects students who sign up from now on." : "Fixed amount, earned once the student has paid. Use 0 to only track."}
        >
          <input id="lf-commission" required inputMode="decimal" value={f.commissionEur} onChange={(e) => set({ commissionEur: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Where the link opens" htmlFor="lf-dest">
          <select
            id="lf-dest"
            value={presetPaths.includes(f.destination) ? f.destination : "custom"}
            onChange={(e) => set({ destination: e.target.value === "custom" ? "/" : e.target.value })}
            className={inputClass}
          >
            {LANDING.map((l) => (
              <option key={l.path} value={l.path}>
                {l.label}
              </option>
            ))}
            <option value="custom">Another page on the site…</option>
          </select>
          {!presetPaths.includes(f.destination) && (
            <input aria-label="Page address" value={f.destination} onChange={(e) => set({ destination: e.target.value })} className={`${inputClass} mt-2`} placeholder="/universities/medical-university-of-sofia/" />
          )}
        </Field>
        {!initial && (
          <Field label="Code (optional)" htmlFor="lf-code" hint="Part of the link, e.g. maria-ig. Leave empty to make one from the name. It can't be changed later.">
            <input id="lf-code" maxLength={40} value={f.code ?? ""} onChange={(e) => set({ code: e.target.value.toLowerCase() })} className={inputClass} />
          </Field>
        )}
        {initial && (
          <Field label="Status" htmlFor="lf-status" hint="A paused link keeps working for visitors but stops counting and attributing.">
            <select id="lf-status" value={f.status} onChange={(e) => set({ status: e.target.value as "active" | "paused" })} className={inputClass}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
        )}
      </div>
      <Field label="Notes (only admins see these)" htmlFor="lf-notes">
        <textarea id="lf-notes" rows={2} maxLength={500} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" busy={busy} id="lf-save">
          {initial ? "Save link" : "Create link"}
        </PrimaryButton>
        <GhostButton type="button" onClick={onCancel} className="!min-h-11 !px-4">
          Cancel
        </GhostButton>
      </div>
    </form>
  );
};

const DailyBars: React.FC<{ daily: { day: string; clicks: number }[] }> = ({ daily }) => {
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-16" role="img" aria-label={`Visits per day over the last 30 days, ${daily.reduce((n, d) => n + d.clicks, 0)} in total`}>
        {daily.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.clicks}`} className="flex-1 bg-emerald-600/80 rounded-t" style={{ height: `${Math.max(d.clicks ? 8 : 2, (d.clicks / max) * 100)}%`, opacity: d.clicks ? 1 : 0.25 }} />
        ))}
      </div>
      <div className="flex justify-between text-[0.625rem] text-slate-400 mt-1">
        <span>30 days ago</span>
        <span>today</span>
      </div>
    </div>
  );
};

const PaymentsBox: React.FC<{ detail: AffiliateDetail; canManage: boolean; reload: () => Promise<void>; ctx: PageContext }> = ({ detail, canManage, reload, ctx }) => {
  const { link } = detail;
  const [kind, setKind] = useState<"payout" | "adjustment">("payout");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.addPayment(link.id, { kind, amountEur: amount, note });
      setAmount("");
      setNote("");
      await reload();
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setError(text);
    } finally {
      setBusy(false);
    }
  };
  const s = link.stats;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><dt className="text-xs text-slate-500">Earned (all time)</dt><dd className="font-bold">{money(s.earnedAll)}</dd></div>
        <div><dt className="text-xs text-slate-500">Corrections</dt><dd className="font-bold">{money(s.adjustments)}</dd></div>
        <div><dt className="text-xs text-slate-500">Paid out</dt><dd className="font-bold">{money(s.payouts)}</dd></div>
        <div><dt className="text-xs text-slate-500">Owed now</dt><dd className="font-bold text-[#006644]" data-testid="owed-now">{money(s.owed)}</dd></div>
      </dl>
      {detail.payments.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm border border-slate-200 rounded-xl">
          {detail.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <Badge tone={p.kind === "payout" ? "green" : "amber"}>{p.kind === "payout" ? "Paid out" : "Correction"}</Badge>
              <span className="font-semibold">{money(p.kind === "payout" ? -p.amountCents : p.amountCents)}</span>
              <span className="text-slate-600 min-w-0 flex-1 truncate">{p.note}</span>
              <span className="text-xs text-slate-500">{p.createdBy} · {formatDate(p.createdAt)}</span>
              {canManage && (
                <button
                  type="button"
                  aria-label="Remove this entry"
                  className="text-slate-400 hover:text-red-600 p-1"
                  onClick={async () => {
                    if (!window.confirm("Remove this entry? It will change what is owed.")) return;
                    try {
                      await adminApi.removePayment(link.id, p.id);
                      await reload();
                    } catch (err) {
                      const text = ctx.fail(err);
                      if (text) setError(text);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={add} className="grid sm:grid-cols-[9rem_8rem_1fr_auto] gap-2 items-end" id="payment-form">
          <Field label="Entry" htmlFor="pay-kind">
            <select id="pay-kind" value={kind} onChange={(e) => setKind(e.target.value as "payout" | "adjustment")} className={inputClass}>
              <option value="payout">Paid out</option>
              <option value="adjustment">Correction (+/−)</option>
            </select>
          </Field>
          <Field label="Amount (€)" htmlFor="pay-amount">
            <input id="pay-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </Field>
          <Field label={kind === "payout" ? "Note (optional)" : "Note (required)"} htmlFor="pay-note">
            <input id="pay-note" maxLength={300} required={kind === "adjustment"} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={kind === "payout" ? "e.g. bank transfer 18 Nov" : "e.g. student refunded: −€20"} />
          </Field>
          <PrimaryButton type="submit" busy={busy} className="!min-h-11">
            Add
          </PrimaryButton>
        </form>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
};

const LinkDetail: React.FC<{ link: AffiliateLink; data: AffiliateData; canManage: boolean; ctx: PageContext; onChanged: (message?: string) => void; onClose: () => void }> = ({
  link,
  data,
  canManage,
  ctx,
  onChanged,
  onClose,
}) => {
  const [detail, setDetail] = useState<AffiliateDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setDetail(await adminApi.affiliate(link.id));
      onChanged();
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setError(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const url = linkUrl(link);
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {link.name} <Badge tone={link.status === "active" ? "green" : "amber"}>{link.status === "active" ? "Active" : "Paused"}</Badge>
        </span>
      }
      action={
        <GhostButton type="button" onClick={onClose} id="close-detail">
          Close
        </GhostButton>
      }
    >
      <div className="space-y-5" data-testid="link-detail">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <code className="text-xs sm:text-sm break-all flex-1 min-w-0" data-testid="link-url">{url}</code>
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#006644] underline underline-offset-2">
            Test it <ExternalLink className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab; counts as a visit)</span>
          </a>
        </div>
        <p className="text-xs text-slate-500">
          {link.sourceName} · {money(link.commissionCents)} per paying student · created by {link.createdBy} on {formatDate(link.createdAt)}
          {link.notes && <> · {link.notes}</>}
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        {detail && (
          <>
            <div>
              <h3 className="text-sm font-bold mb-2">Visits, last 30 days</h3>
              <DailyBars daily={detail.daily} />
            </div>
            <div>
              <h3 className="text-sm font-bold mb-2">Commission</h3>
              <PaymentsBox detail={detail} canManage={canManage} reload={load} ctx={ctx} />
            </div>
          </>
        )}
        {canManage && (
          <div className="border-t border-slate-100 pt-4">
            {editing ? (
              <LinkForm
                data={data}
                initial={link}
                ctx={ctx}
                onCancel={() => setEditing(false)}
                onDone={(m) => {
                  setEditing(false);
                  onChanged(m);
                  void load();
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <GhostButton type="button" onClick={() => setEditing(true)} id="edit-link">
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit link
                </GhostButton>
                <GhostButton
                  type="button"
                  tone="danger"
                  onClick={async () => {
                    if (!window.confirm(`Delete “${link.name}”? This can only be done while it has no visits, sign-ups or payments.`)) return;
                    try {
                      await adminApi.deleteLink(link.id);
                      onChanged("Link deleted.");
                      onClose();
                    } catch (err) {
                      const text = ctx.fail(err);
                      if (text) setError(text);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                </GhostButton>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const SourcesBox: React.FC<{ data: AffiliateData; ctx: PageContext; onChanged: (message: string) => void }> = ({ data, ctx, onChanged }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await action();
      onChanged(message);
      return true;
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setError(text);
      return false;
    }
  };
  return (
    <Card title="Sources (brands and channels)">
      <p className="text-xs text-slate-500 -mt-2 mb-3">Every link belongs to one source. Results are grouped by source, and students show it as where they came from.</p>
      <ul className="divide-y divide-slate-100 text-sm">
        {data.sources.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 min-w-0 truncate font-semibold">{s.name}</span>
            <span className="text-xs text-slate-500">{s.links} link{s.links === 1 ? "" : "s"}</span>
            <GhostButton
              type="button"
              aria-label={`Rename ${s.name}`}
              onClick={async () => {
                const next = window.prompt("New name for this source", s.name);
                if (next && next.trim() && next !== s.name) await run(() => adminApi.renameSource(s.id, next.trim()), "Source renamed.");
              }}
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
            </GhostButton>
            <GhostButton
              type="button"
              tone="danger"
              aria-label={`Delete ${s.name}`}
              disabled={s.links > 0}
              title={s.links > 0 ? "Links still use this source" : undefined}
              onClick={async () => {
                if (window.confirm(`Delete the source “${s.name}”?`)) await run(() => adminApi.deleteSource(s.id), "Source deleted.");
              }}
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
            </GhostButton>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => adminApi.createSource(name), `Source “${name.trim()}” added.`)) setName("");
        }}
      >
        <input aria-label="New source name" id="new-source" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="New source, e.g. Podcast" className={inputClass} />
        <PrimaryButton type="submit" className="shrink-0">
          Add
        </PrimaryButton>
      </form>
      {error && (
        <div className="mt-3">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
};

const RollupRow: React.FC<{ r: AffiliateRollup; first: React.ReactNode }> = ({ r, first }) => (
  <tr className="border-t border-slate-100">
    <td className="py-2 pr-3 font-semibold">{first}</td>
    <td className="py-2 pr-3 text-right">{r.links}</td>
    <td className="py-2 pr-3 text-right">{r.clicks}</td>
    <td className="py-2 pr-3 text-right">{r.signups}</td>
    <td className="py-2 pr-3 text-right">{r.paid}</td>
    <td className="py-2 pr-3 text-right text-slate-500">{pct(r.paid, r.signups)}</td>
    <td className="py-2 text-right font-semibold">{money(r.owed)}</td>
  </tr>
);

/** Referral links: who they are for, what they bring in, and what is owed. Admins only: partners never sign in anywhere. */
export const AffiliatesPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const canManage = adminCan(ctx.admin, "affiliates.manage");
  const [window_, setWindow] = useState("30d");
  const [data, setData] = useState<AffiliateData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.affiliates(window_));
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window_]);
  useEffect(() => {
    void load();
  }, [load]);

  const changed = (text?: string) => {
    if (text) setMessage({ kind: "ok", text });
    void load();
  };
  const sel = data?.links.find((l) => l.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold font-heading">Referral links</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Make a link for each partner, brand or campaign, with a fixed commission per paying student. See visits, sign-ups and what is owed. Only admins see this.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="aff-window" className="sr-only">Period</label>
          <select id="aff-window" value={window_} onChange={(e) => setWindow(e.target.value)} className={`${inputClass} !w-auto`}>
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          {canManage && (
            <PrimaryButton type="button" id="new-link" onClick={() => { setCreating(true); setSelected(null); }}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New link
            </PrimaryButton>
          )}
        </div>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {!data && !message && <p className="text-sm text-slate-500" role="status">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="aff-totals">
            <Stat label="Visits" value={data.totals.clicks} hint="Page opens through a link" />
            <Stat label="Sign-ups" value={data.totals.signups} hint={`${data.totals.started} started an application`} />
            <Stat label="Paid" value={data.totals.paid} hint={`${pct(data.totals.paid, data.totals.signups)} of sign-ups`} />
            <Stat label="Commission earned" value={money(data.totals.earnedPeriod)} hint="From sign-ups in this period" />
            <Stat label="Owed now" value={money(data.totals.owed)} hint="All time, after payouts" />
          </div>

          {creating && (
            <Card title="New referral link">
              <LinkForm
                data={data}
                ctx={ctx}
                onCancel={() => setCreating(false)}
                onDone={(m) => {
                  setCreating(false);
                  changed(m);
                }}
              />
            </Card>
          )}

          {sel && <LinkDetail key={sel.id} link={sel} data={data} canManage={canManage} ctx={ctx} onChanged={changed} onClose={() => setSelected(null)} />}

          <Card title="By source">
            {data.bySource.length === 0 ? (
              <p className="text-sm text-slate-500">No links yet. Create the first one to start tracking.</p>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm" data-testid="by-source">
                  <thead className="text-xs text-slate-500 text-right">
                    <tr>
                      <th className="text-left font-semibold pb-2 pr-3">Source</th>
                      <th className="font-semibold pb-2 pr-3">Links</th>
                      <th className="font-semibold pb-2 pr-3">Visits</th>
                      <th className="font-semibold pb-2 pr-3">Sign-ups</th>
                      <th className="font-semibold pb-2 pr-3">Paid</th>
                      <th className="font-semibold pb-2 pr-3">Paid / sign-ups</th>
                      <th className="font-semibold pb-2">Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.map((s) => (
                      <RollupRow key={s.id} r={s} first={s.name} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="All links">
            {data.links.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing here yet.</p>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm" data-testid="links-table">
                  <thead className="text-xs text-slate-500 text-right">
                    <tr>
                      <th className="text-left font-semibold pb-2 pr-3">Link</th>
                      <th className="font-semibold pb-2 pr-3">Commission</th>
                      <th className="font-semibold pb-2 pr-3">Visits</th>
                      <th className="font-semibold pb-2 pr-3">Sign-ups</th>
                      <th className="font-semibold pb-2 pr-3">Paid</th>
                      <th className="font-semibold pb-2 pr-3">Owed</th>
                      <th className="font-semibold pb-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.links.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100" data-testid="link-row">
                        <td className="py-2 pr-3 min-w-44">
                          <button type="button" className="text-left font-semibold text-[#006644] hover:underline" onClick={() => { setSelected(l.id); setCreating(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            {l.name}
                          </button>
                          <div className="text-xs text-slate-500">
                            {l.sourceName} · <code>{l.code}</code> {l.status === "paused" && <Badge tone="amber">Paused</Badge>}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">{money(l.commissionCents)}</td>
                        <td className="py-2 pr-3 text-right">{l.stats.clicks}</td>
                        <td className="py-2 pr-3 text-right">{l.stats.signups}</td>
                        <td className="py-2 pr-3 text-right">{l.stats.paid}</td>
                        <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{money(l.stats.owed)}</td>
                        <td className="py-2 text-right"><CopyButton text={linkUrl(l)} label="Copy" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[0.6875rem] text-slate-500 mt-3">
              Visits, sign-ups and paid follow the period above (sign-ups by the day the account was created). “Owed now” is always all time. A visit is a page opening through the link: bots are left out, and the same person can count more than once.
            </p>
          </Card>

          {canManage && <SourcesBox data={data} ctx={ctx} onChanged={changed} />}
          {!canManage && <Notice kind="info">Your role can view referral links but not change them.</Notice>}
        </>
      )}
    </div>
  );
};

