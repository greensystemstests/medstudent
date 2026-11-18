import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PERMISSIONS } from "../../../shared/adminPermissions.js";
import { adminApi, adminCan, isSuperAdmin } from "../../lib/adminApi";
import type { PageContext } from "./AdminShell";
import { Badge, Card, formatDate } from "./ui";
import { StudentStats } from "./StudentStats";

export const OverviewPage: React.FC<{ ctx: PageContext; onNavigate: (id: string) => void }> = ({ ctx, onNavigate }) => {
  const { admin } = ctx;
  const [counts, setCounts] = useState<{ admins: number; roles: number } | null>(null);
  useEffect(() => {
    if (!isSuperAdmin(admin)) return;
    adminApi
      .team()
      .then((t) => setCounts({ admins: t.admins.length, roles: t.roles.length }))
      .catch((e) => ctx.fail(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const perms = Object.entries(PERMISSIONS as Record<string, string>);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900">Welcome{admin.fullName ? `, ${admin.fullName.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Signed in as {admin.email} · {admin.role.name} · last sign-in {formatDate(admin.lastLoginAt)}
        </p>
      </div>

      {adminCan(admin, "students.view") && <StudentStats ctx={ctx} onNavigate={onNavigate} />}

      <Card title="What your role can do">
        <ul className="space-y-2">
          {isSuperAdmin(admin) && (
            <li className="flex items-start gap-2 text-sm text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Everything, including accounts, roles and the audit log.</span>
            </li>
          )}
          {perms.map(([key, label]) => {
            const can = adminCan(admin, key);
            return (
              <li key={key} className={`flex items-start gap-2 text-sm ${can ? "text-slate-800" : "text-slate-400"}`}>
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${can ? "text-emerald-600" : "text-slate-300"}`} aria-hidden="true" />
                <span>{label}</span>
                {!can && <Badge>Not in your role</Badge>}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500 mt-4">
          Student access: {admin.role.studentsScope === "assigned" ? "only students assigned to you" : "all students"}.
        </p>
      </Card>

      {isSuperAdmin(admin) && (
        <Card
          title="Your team"
          action={
            <button type="button" onClick={() => onNavigate("team")} className="text-xs font-semibold text-[#006644] underline">
              Manage accounts and roles
            </button>
          }
        >
          <p className="text-sm text-slate-700">
            {counts ? `${counts.admins} admin account${counts.admins === 1 ? "" : "s"} · ${counts.roles} role${counts.roles === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </Card>
      )}
    </div>
  );
};
