import React, { useCallback, useEffect, useState } from "react";
import { AuditEntry, adminApi } from "../../lib/adminApi";
import type { PageContext } from "./AdminShell";
import { Card, GhostButton, Notice, formatDate } from "./ui";

const LABELS: Record<string, string> = {
  signin: "Signed in",
  signout: "Signed out",
  signin_code_failed: "Wrong email code",
  signin_totp_failed: "Wrong authenticator code",
  recovery_code_used: "Used a recovery code",
  recovery_codes_regenerated: "Made new recovery codes",
  totp_enrolled: "Set up two-step sign-in",
  admin_created: "Created an account",
  admin_updated: "Changed an account",
  admin_deleted: "Deleted an account",
  admin_2fa_reset: "Reset two-step sign-in",
  role_created: "Created a role",
  role_updated: "Changed a role",
  role_deleted: "Deleted a role",
};
export const actionLabel = (a: string) => LABELS[a] ?? a.replaceAll("_", " ");

export const AuditPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const res = await adminApi.audit(before);
        setEntries((cur) => (before ? [...cur, ...res.entries] : res.entries));
        setNext(res.next);
      } catch (err) {
        setError(ctx.fail(err));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-600 mt-1">Every sign-in and every change made in the admin, newest first.</p>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <Card className="overflow-hidden" title={undefined}>
        <div className="-m-5 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Audit log">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-bold">When</th>
                <th className="px-3 py-3 font-bold">Who</th>
                <th className="px-3 py-3 font-bold">What</th>
                <th className="px-3 py-3 font-bold">About</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} data-testid="audit-row">
                  <td className="px-5 py-2.5 whitespace-nowrap text-xs text-slate-600">{formatDate(e.created_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-800">{e.admin_email || "—"}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-900">{actionLabel(e.action)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {e.subject ?? "—"}
                    {e.detail && Object.keys(e.detail).length > 0 && (
                      <span className="block text-[0.6875rem] text-slate-400">
                        {Object.entries(e.detail)
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!entries.length && !loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-sm text-slate-500">
                    Nothing yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {loading && <p className="text-sm text-slate-500" role="status">Loading…</p>}
      {next && !loading && <GhostButton onClick={() => void load(next)}>Show older</GhostButton>}
    </div>
  );
};
