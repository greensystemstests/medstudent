import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleAlert } from "lucide-react";
import { ErrorEventRow, ErrorGroup, FlowData, SystemStatus, adminApi, adminCan } from "../../lib/adminApi";
import { STEP_TITLES } from "../../lib/application";
import type { PageContext } from "./AdminShell";
import { Badge, Card, GhostButton, Notice, formatDate, inputClass } from "./ui";

export const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

const KIND_LABELS: Record<string, string> = {
  js_error: "Page error",
  unhandled_rejection: "Unhandled failure",
  render_error: "Page crashed",
  api_error: "Request didn't complete",
  payment_form: "Payment form",
  server_error: "Server error",
  email_failed: "Email not sent",
  webhook_failed: "Stripe webhook",
  payment_failed: "Payment failed",
};
const kindLabel = (k: string) => KIND_LABELS[k] ?? k.replaceAll("_", " ");
const WINDOWS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

type Tab = "status" | "errors" | "flow";

export const MonitoringPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [tab, setTab] = useState<Tab>("status");
  const tabs: [Tab, string][] = [
    ["status", "System status"],
    ["errors", "Errors"],
    ["flow", "User flow"],
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900">Monitoring</h1>
        <p className="text-sm text-slate-600 mt-1">Is the site healthy, what is breaking, and where do people get stuck.</p>
      </div>
      <div role="tablist" aria-label="Monitoring" className="flex gap-1 border-b border-slate-200">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`mon-tab-${id}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 ${tab === id ? "border-[#006644] text-[#006644]" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "status" && <StatusTab ctx={ctx} onOpenErrors={() => setTab("errors")} />}
      {tab === "errors" && <ErrorsTab ctx={ctx} />}
      {tab === "flow" && <FlowTab ctx={ctx} />}
    </div>
  );
};

/* ---------------------------------------------------------------- status */

export const useStatus = (ctx: PageContext) => {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi
      .monitoringStatus()
      .then(setData)
      .catch((e) => setError(ctx.fail(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error };
};

export const ModeBadge: React.FC<{ mode: SystemStatus["stripeMode"] }> = ({ mode }) =>
  mode === "live" ? <Badge tone="green">LIVE payments</Badge> : mode === "test" ? <Badge tone="amber">TEST mode: no real money</Badge> : <Badge tone="red">Stripe not set up</Badge>;

const StatusTab: React.FC<{ ctx: PageContext; onOpenErrors: () => void }> = ({ ctx, onOpenErrors }) => {
  const { data, error } = useStatus(ctx);
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-slate-500" role="status">Loading…</p>;
  const blockers = [
    !data.billingReady && "emails and invoices aren't configured",
    !data.accountsReady && "student accounts aren't configured",
    !data.checkoutEnabled && "the checkout switch is off",
    !data.legalApproved && "the legal pages aren't approved",
  ].filter(Boolean) as string[];
  const e = data.emails;
  const emailsOk = e.retrying === 0 && e.needsReview === 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="status-grid">
      <Card title="Payments">
        <div className="space-y-2.5 text-sm">
          <ModeBadge mode={data.stripeMode} />
          <p className="flex items-center gap-2">
            {data.paymentsReady ? <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <CircleAlert className="w-4 h-4 text-amber-600" aria-hidden="true" />}
            <span className="font-semibold">{data.paymentsReady ? "Checkout is open to students" : "Checkout is closed to students"}</span>
          </p>
          {!data.paymentsReady && blockers.length > 0 && <p className="text-xs text-slate-600">Because {blockers.join(", ")}.</p>}
          {data.stripeMode === "test" && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Students can't pay real money while this reads TEST. Switch to live keys to take real payments.</p>}
        </div>
      </Card>
      <Card title="Stripe is reaching us">
        {data.lastWebhook ? (
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Last event {timeAgo(data.lastWebhook.at)}
            </p>
            <p className="text-xs text-slate-600">
              {data.lastWebhook.type} · {data.lastWebhook.live ? "live mode" : "test mode"}
            </p>
            {data.stripeMode === "live" && !data.lastWebhook.live && <p className="text-xs text-amber-800">The last event was from test mode. Place a live payment to confirm the live webhook works.</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No events received yet. After the first payment you should see one here. If payments happen and this stays empty, the webhook isn't connected.</p>
        )}
      </Card>
      <Card title="Emails">
        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            {emailsOk ? <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />}
            {emailsOk ? "Receipts are going out" : "Some receipts are stuck"}
          </p>
          <p className="text-xs text-slate-600">
            {e.pending} waiting · {e.retrying} retrying · {e.needsReview} need a look{e.pending > 0 ? ` · oldest waiting ${e.oldestPendingMinutes} min` : ""}
          </p>
        </div>
      </Card>
      <Card
        title="Errors in the last 24 hours"
        action={
          <button type="button" onClick={onOpenErrors} className="text-xs font-semibold text-[#006644] underline">
            See errors
          </button>
        }
      >
        <p className="text-3xl font-extrabold font-heading text-slate-900">{data.errors24h.total}</p>
        <p className="text-xs text-slate-600 mt-1">
          {data.errors24h.client} in visitors' browsers · {data.errors24h.server} on the server
        </p>
      </Card>
      <Card title="System">
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-slate-500">Database</dt><dd className="font-semibold">{data.database ? "Connected" : "Not responding"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Student accounts</dt><dd className="font-semibold">{data.accountsReady ? "Ready" : "Not ready"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Version</dt><dd className="font-mono text-xs">{String(data.build).slice(0, 8)}</dd></div>
        </dl>
      </Card>
    </div>
  );
};

/* ---------------------------------------------------------------- errors */

const ErrorsTab: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [windowSel, setWindowSel] = useState("7d");
  const [kind, setKind] = useState("");
  const [state, setState] = useState<"open" | "resolved" | "ignored">("open");
  const [data, setData] = useState<{ groups: ErrorGroup[]; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canManage = adminCan(ctx.admin, "monitoring.manage");

  const load = useCallback(async () => {
    try {
      setData(await adminApi.errorGroups(windowSel, kind, state));
      setError(null);
    } catch (e) {
      setError(ctx.fail(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSel, kind, state]);
  useEffect(() => {
    void load();
  }, [load]);

  const setGroupState = async (g: ErrorGroup, status: "open" | "resolved" | "ignored") => {
    const note = status === "resolved" ? (window.prompt("Note (optional): what fixed it?") ?? "") : "";
    try {
      await adminApi.setErrorState(g.fingerprint, status, note);
      setMessage(status === "open" ? "Reopened." : status === "resolved" ? "Marked as resolved. It comes back here if it happens again." : "Ignored.");
      await load();
    } catch (e) {
      setError(ctx.fail(e));
    }
  };

  const tabs: ["open" | "resolved" | "ignored", string][] = [
    ["open", "Open"],
    ["resolved", "Resolved"],
    ["ignored", "Ignored"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="err-window" className="block text-[0.6875rem] font-bold text-slate-600 mb-1">Period</label>
          <select id="err-window" value={windowSel} onChange={(e) => setWindowSel(e.target.value)} className={`${inputClass} !py-2 text-xs !w-auto`}>
            {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="err-kind" className="block text-[0.6875rem] font-bold text-slate-600 mb-1">Type</label>
          <select id="err-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} !py-2 text-xs !w-auto`}>
            <option value="">All types</option>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div role="group" aria-label="State" className="flex gap-1 ml-auto">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={state === id} onClick={() => setState(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${state === id ? "bg-[#006644] text-white border-[#006644]" : "bg-white text-slate-700 border-slate-200"}`}>
              {label}{data ? ` (${data.counts[id] ?? 0})` : ""}
            </button>
          ))}
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="ok">{message}</Notice>}
      {data && data.groups.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> {state === "open" ? "No open problems in this period." : "Nothing here."}
          </p>
        </Card>
      )}
      <ul className="space-y-3" aria-label="Errors">
        {data?.groups.map((g) => (
          <GroupCard key={g.fingerprint} g={g} ctx={ctx} canManage={canManage} onState={setGroupState} />
        ))}
      </ul>
    </div>
  );
};

const GroupCard: React.FC<{ g: ErrorGroup; ctx: PageContext; canManage: boolean; onState: (g: ErrorGroup, s: "open" | "resolved" | "ignored") => void }> = ({ g, ctx, canManage, onState }) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ErrorEventRow[] | null>(null);
  const toggle = async () => {
    setOpen(!open);
    if (!events) {
      try {
        setEvents((await adminApi.errorEvents(g.fingerprint)).events);
      } catch (e) {
        ctx.fail(e);
      }
    }
  };
  return (
    <li className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2.5" data-testid="error-group">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={g.source === "server" ? "red" : "amber"}>{kindLabel(g.kind)}</Badge>
        {g.recurred && <Badge tone="red">Came back after being resolved</Badge>}
        <span className="text-xs text-slate-500">{g.source === "server" ? "Server" : "Visitor's browser"}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 break-words">{g.message}</p>
      <p className="text-xs text-slate-600">
        {g.location && <>On <code className="font-mono">{g.location}</code> · </>}
        {g.count} time{g.count === 1 ? "" : "s"}
        {g.users > 0 && <> · {g.users} signed-in {g.users === 1 ? "person" : "people"}</>} · first {timeAgo(g.firstSeen)} · last {timeAgo(g.lastSeen)}
      </p>
      {g.note && <p className="text-xs text-slate-700">Note from {g.stateBy}: {g.note}</p>}
      <div className="flex flex-wrap gap-2">
        <GhostButton onClick={toggle} aria-expanded={open}>
          {open ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />} Details
        </GhostButton>
        {canManage && g.state === "open" && (
          <>
            <GhostButton onClick={() => onState(g, "resolved")}>Mark resolved</GhostButton>
            <GhostButton onClick={() => onState(g, "ignored")}>Ignore</GhostButton>
          </>
        )}
        {canManage && g.state !== "open" && <GhostButton onClick={() => onState(g, "open")}>Reopen</GhostButton>}
      </div>
      {open && (
        <div className="border-t border-slate-100 pt-3">
          {!events ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((ev) => (
                <li key={ev.id} className="text-xs text-slate-700 flex flex-wrap gap-x-3">
                  <span className="text-slate-500">{formatDate(ev.at)}</span>
                  {ev.page && <span>page {ev.page}</span>}
                  {ev.step && <span>step {ev.step}</span>}
                  {ev.status !== null && ev.status > 0 && <span>HTTP {ev.status}</span>}
                  {ev.user ? (
                    <a className="text-[#006644] underline" href={ev.user.applicationId ? `#students/${encodeURIComponent(ev.user.applicationId)}` : "#students"} onClick={() => window.setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 0)}>
                      {ev.user.email}
                    </a>
                  ) : ev.signedIn ? (
                    <span>signed-in student</span>
                  ) : (
                    <span className="text-slate-400">not signed in</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

/* ------------------------------------------------------------------ flow */

const FlowTab: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [windowSel, setWindowSel] = useState("30d");
  const [data, setData] = useState<FlowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi
      .flow(windowSel)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(ctx.fail(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSel]);
  if (error) return <Notice kind="error">{error}</Notice>;
  const base = Math.max(1, data?.applicationsSaved ?? 1);
  const rows = data
    ? [
        { label: "Accounts created", count: data.accountsCreated },
        { label: "Applications saved online", count: data.applicationsSaved },
        ...data.reachedStep.map((r) => ({ label: `Reached step ${r.step}: ${STEP_TITLES[r.step - 1]}`, count: r.count })),
        { label: "Started checkout", count: data.checkoutStarted },
        { label: "Paid", count: data.paid },
      ]
    : [];
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="flow-window" className="block text-[0.6875rem] font-bold text-slate-600 mb-1">Period</label>
        <select id="flow-window" value={windowSel} onChange={(e) => setWindowSel(e.target.value)} className={`${inputClass} !py-2 text-xs !w-auto`}>
          {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>
      {!data ? (
        <p className="text-sm text-slate-500" role="status">Loading…</p>
      ) : (
        <>
          <Card title="How far people get">
            <ul className="space-y-2.5" data-testid="flow-rows">
              {rows.map((r, i) => (
                <li key={i} className="text-sm">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-700 truncate">{r.label}</span>
                    <span className="font-semibold text-slate-900">
                      {r.count}
                      {i > 0 && <span className="text-slate-400 font-normal"> · {Math.round((r.count / base) * 100)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#006644] rounded-full" style={{ width: `${Math.min(100, (r.count / Math.max(base, rows[0].count)) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {data.abandonedCheckout > 0 && <p className="text-xs text-amber-800 mt-4">{data.abandonedCheckout} started checkout more than an hour ago and haven't paid.</p>}
            <p className="text-xs text-slate-500 mt-3">Counts people who signed in and saved an application. Visitors who haven't signed in aren't tracked.</p>
          </Card>
          <Card title="Where people get blocked">
            {data.topBlocks.length === 0 ? (
              <p className="text-sm text-slate-500">No blocked steps recorded in this period.</p>
            ) : (
              <ul className="space-y-2">
                {data.topBlocks.map((b, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="text-xs text-slate-500">Step {b.step}: </span>
                      {b.message}
                    </span>
                    <span className="font-semibold shrink-0">{b.count}×</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500 mt-3">Each time someone presses Continue and is told something is missing, it is counted here. The messages are the fixed texts the form shows, never what people typed.</p>
          </Card>
        </>
      )}
    </div>
  );
};

/** A compact health line for the overview page. */
export const HealthStrip: React.FC<{ ctx: PageContext; onNavigate: (id: string) => void }> = ({ ctx, onNavigate }) => {
  const { data } = useStatus(ctx);
  if (!data) return null;
  return (
    <Card
      title="Site health"
      action={
        <button type="button" onClick={() => onNavigate("monitoring")} className="text-xs font-semibold text-[#006644] underline">
          Open monitoring
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="health-strip">
        <ModeBadge mode={data.stripeMode} />
        <span className="text-slate-700">{data.paymentsReady ? "Checkout open" : "Checkout closed"}</span>
        <span className="text-slate-700">{data.errors24h.total} error{data.errors24h.total === 1 ? "" : "s"} in 24 h</span>
        {(data.emails.retrying > 0 || data.emails.needsReview > 0) && <Badge tone="amber">Receipts stuck</Badge>}
      </div>
    </Card>
  );
};
