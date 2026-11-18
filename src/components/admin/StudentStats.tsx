import React, { useEffect, useState } from "react";
import { OverviewData, adminApi } from "../../lib/adminApi";
import { applicationStatus } from "../../lib/statusLabels";
import { universityName } from "./StudentsPage";
import type { PageContext } from "./AdminShell";
import { Card, Notice } from "./ui";

const STATUS_ORDER = ["draft", "checkout", "submitted", "in_review", "action_needed", "review_complete"];

/** Numbers at a glance: how many students, where they are in the process, where they came from. */
export const StudentStats: React.FC<{ ctx: PageContext; onNavigate: (id: string) => void }> = ({ ctx, onNavigate }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi
      .overview()
      .then(setData)
      .catch((e) => setError(ctx.fail(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-slate-500" role="status">Loading numbers…</p>;
  const t = data.totals;
  const max = Math.max(1, ...data.perDay.map((d) => d.count));
  return (
    <div className="space-y-5" data-testid="student-stats">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Applications" value={t.total} />
        <Stat label="Paid" value={t.paid} sub={t.total ? `${Math.round((t.paid / t.total) * 100)}% of all` : ""} />
        <Stat label="New in 7 days" value={t.new7} />
        <Stat label="New in 30 days" value={t.new30} />
      </div>

      <Card
        title="Where students are in the process"
        action={
          <button type="button" onClick={() => onNavigate("students")} className="text-xs font-semibold text-[#006644] underline">
            Open students
          </button>
        }
      >
        <ul className="space-y-2.5">
          {STATUS_ORDER.map((s) => (
            <Bar key={s} label={applicationStatus(s).label} value={t[s] ?? 0} max={Math.max(1, t.total)} />
          ))}
        </ul>
      </Card>

      <Card title="New applications, last 30 days">
        <div className="flex items-end gap-[3px] h-24" role="img" aria-label={`${t.new30} new applications in the last 30 days`}>
          {data.perDay.map((d) => (
            <div key={d.day} className="flex-1 bg-emerald-100 rounded-t-sm relative group" style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / max) * 100)}%` }} title={`${d.day}: ${d.count}`}>
              <div className={`absolute inset-0 rounded-t-sm ${d.count ? "bg-[#006644]" : "bg-slate-200"}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[0.6875rem] text-slate-400 mt-1.5">
          <span>{data.perDay[0]?.day}</span>
          <span>{data.perDay[data.perDay.length - 1]?.day}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Top title="Where they came from" rows={data.bySource} />
        <Top title="Passport country" rows={data.byCountry} />
        <Top title="What they want to study" rows={data.byDegree} />
        <Top title="Universities" rows={data.byUniversity.map((r) => ({ ...r, value: universityName(r.value) }))} />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="text-3xl font-extrabold font-heading text-slate-900 mt-1">{value}</div>
    {sub && <div className="text-[0.6875rem] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

const Bar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => (
  <li className="text-sm">
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-700 truncate">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
      <div className="h-full bg-[#006644] rounded-full" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  </li>
);

const Top: React.FC<{ title: string; rows: { value: string; count: number }[] }> = ({ title, rows }) => (
  <Card title={title}>
    {rows.length === 0 ? (
      <p className="text-sm text-slate-500">Nothing yet.</p>
    ) : (
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <Bar key={r.value} label={r.value} value={r.count} max={rows[0].count} />
        ))}
      </ul>
    )}
  </Card>
);
