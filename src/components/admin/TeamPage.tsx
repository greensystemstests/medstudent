import React, { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PERMISSION_SHORT } from "../../../shared/adminPermissions.js";
import { AdminProfile, RoleRow, StudentScope, TeamData, adminApi } from "../../lib/adminApi";
import type { PageContext } from "./AdminShell";
import { Badge, Card, Field, GhostButton, Notice, PrimaryButton, errorText, formatDate, inputClass } from "./ui";

/** Accounts and roles ("rules"). Only super admins reach this page, and the server enforces it again. */
export const TeamPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setTeam(await adminApi.team());
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "ok", text: success });
      await load();
      return true;
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
      return false;
    }
  };

  if (!team)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold font-heading">Team &amp; roles</h1>
        {message ? <Notice kind={message.kind}>{message.text}</Notice> : <p className="text-sm text-slate-500" role="status">Loading…</p>}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900">Team &amp; roles</h1>
        <p className="text-sm text-slate-600 mt-1">Create accounts for the people who manage students, and decide what each role can see and do.</p>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <AccountsCard team={team} me={ctx.admin} run={run} />
      <RolesCard team={team} run={run} />
    </div>
  );
};

type Run = (action: () => Promise<unknown>, success: string) => Promise<boolean>;

const AccountsCard: React.FC<{ team: TeamData; me: AdminProfile; run: Run }> = ({ team, me, run }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", roleId: "" });
  const [busy, setBusy] = useState(false);
  const firstRole = team.roles.find((r) => r.key === "student_manager")?.id ?? team.roles[0]?.id ?? "";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      () => adminApi.createAdmin({ ...form, roleId: form.roleId || firstRole }),
      `Account created. ${form.fullName} gets an email with sign-in instructions.`,
    );
    setBusy(false);
    if (ok) {
      setForm({ fullName: "", email: "", roleId: "" });
      setAdding(false);
    }
  };

  return (
    <Card
      title={`Accounts (${team.admins.length})`}
      action={
        <PrimaryButton type="button" onClick={() => setAdding(!adding)} className="!min-h-9 !px-3.5 !py-1.5 !text-xs" id="admin-add-account">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {adding ? "Close" : "Add account"}
        </PrimaryButton>
      }
    >
      {adding && (
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Field label="Name" htmlFor="new-admin-name">
            <input id="new-admin-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Work email" htmlFor="new-admin-email">
            <input id="new-admin-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Role" htmlFor="new-admin-role">
            <select id="new-admin-role" value={form.roleId || firstRole} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className={inputClass}>
              {team.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-3 flex items-center gap-3">
            <PrimaryButton type="submit" busy={busy} id="admin-create-account">
              Create account
            </PrimaryButton>
            <p className="text-xs text-slate-500">They sign in with their email and set up an authenticator app on first sign-in.</p>
          </div>
        </form>
      )}
      <ul className="divide-y divide-slate-100" aria-label="Admin accounts">
        {team.admins.map((a) => (
          <AccountRow key={a.id} a={a} team={team} isMe={a.id === me.id} run={run} />
        ))}
      </ul>
    </Card>
  );
};

const AccountRow: React.FC<{ a: AdminProfile; team: TeamData; isMe: boolean; run: Run }> = ({ a, team, isMe, run }) => (
  <li className="py-3.5 flex flex-col lg:flex-row lg:items-center gap-3" data-testid="admin-row">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-sm text-slate-900">{a.fullName || a.email}</span>
        {isMe && <Badge tone="green">You</Badge>}
        {a.status === "disabled" && <Badge tone="red">Disabled</Badge>}
        {a.twoFactorEnabled ? <Badge tone="green">Two-step on</Badge> : <Badge tone="amber">Not set up yet</Badge>}
      </div>
      <div className="text-xs text-slate-500 truncate">{a.email}</div>
      <div className="text-[0.6875rem] text-slate-400">Last sign-in: {formatDate(a.lastLoginAt)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${a.id}`}>
        Role for {a.email}
      </label>
      <select
        id={`role-${a.id}`}
        value={a.role.id}
        disabled={isMe}
        onChange={(e) => run(() => adminApi.updateAdmin(a.id, { roleId: e.target.value }), `${a.fullName || a.email} now has a new role.`)}
        className={`${inputClass} !w-auto !py-1.5 text-xs`}
      >
        {team.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {!isMe && (
        <>
          <GhostButton
            onClick={() =>
              run(
                () => adminApi.updateAdmin(a.id, { status: a.status === "active" ? "disabled" : "active" }),
                a.status === "active" ? `${a.email} is disabled and signed out.` : `${a.email} is active again.`,
              )
            }
          >
            {a.status === "active" ? "Disable" : "Enable"}
          </GhostButton>
          <GhostButton
            onClick={() => {
              if (window.confirm(`Reset two-step sign-in for ${a.email}? They'll set up the authenticator again at their next sign-in.`))
                void run(() => adminApi.resetTwoFactor(a.id), `Two-step sign-in reset for ${a.email}.`);
            }}
          >
            Reset 2-step
          </GhostButton>
          <GhostButton
            tone="danger"
            onClick={() => {
              if (window.confirm(`Delete the account for ${a.email}? This can't be undone.`)) void run(() => adminApi.deleteAdmin(a.id), `${a.email} was deleted.`);
            }}
            aria-label={`Delete ${a.email}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </GhostButton>
        </>
      )}
    </div>
  </li>
);

const emptyRole = { name: "", description: "", permissions: [] as string[], studentsScope: "all" as StudentScope };

const RolesCard: React.FC<{ team: TeamData; run: Run }> = ({ team, run }) => {
  const [editing, setEditing] = useState<{ id: string | null; draft: typeof emptyRole } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const ok = await run(
      () => (editing.id ? adminApi.updateRole(editing.id, editing.draft) : adminApi.createRole(editing.draft)),
      editing.id ? "Role saved. Changes apply right away." : "Role created.",
    );
    setBusy(false);
    if (ok) setEditing(null);
  };
  const toggle = (key: string) =>
    setEditing((cur) =>
      cur
        ? { ...cur, draft: { ...cur.draft, permissions: cur.draft.permissions.includes(key) ? cur.draft.permissions.filter((p) => p !== key) : [...cur.draft.permissions, key] } }
        : cur,
    );
  const edit = (r: RoleRow) =>
    setEditing({ id: r.id, draft: { name: r.name, description: r.description, permissions: r.permissions, studentsScope: r.studentsScope } });

  return (
    <Card
      title="Roles (rules)"
      action={
        <PrimaryButton type="button" onClick={() => setEditing({ id: null, draft: emptyRole })} className="!min-h-9 !px-3.5 !py-1.5 !text-xs" id="admin-add-role">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New role
        </PrimaryButton>
      }
    >
      {editing && (
        <form onSubmit={save} className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4" aria-label={editing.id ? "Edit role" : "New role"}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Role name" htmlFor="role-name">
              <input id="role-name" required value={editing.draft.name} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} className={inputClass} />
            </Field>
            <Field label="Short description" htmlFor="role-description">
              <input id="role-description" value={editing.draft.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} className={inputClass} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-xs font-bold text-slate-700 mb-2">What this role can do</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(team.permissions).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2.5 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={editing.draft.permissions.includes(key)} onChange={() => toggle(key)} className="mt-0.5 w-4 h-4 accent-[#006644]" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Which students" htmlFor="role-scope" hint="“Only assigned” limits this role to students a super admin has assigned to them.">
            <select id="role-scope" value={editing.draft.studentsScope} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, studentsScope: e.target.value as StudentScope } })} className={inputClass}>
              {Object.entries(team.studentScopes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <PrimaryButton type="submit" busy={busy} id="admin-save-role">
              Save role
            </PrimaryButton>
            <GhostButton type="button" onClick={() => setEditing(null)}>
              Cancel
            </GhostButton>
          </div>
        </form>
      )}
      <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3" aria-label="Roles">
        {team.roles.map((r) => {
          const isSuper = r.key === "super_admin";
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 p-4 flex flex-col gap-2" data-testid="role-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{r.name}</span>
                {r.builtIn && <Badge>Built in</Badge>}
                <span className="text-xs text-slate-500">
                  {r.adminCount} {r.adminCount === 1 ? "person" : "people"}
                </span>
              </div>
              {r.description && <p className="text-xs text-slate-600">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {isSuper ? (
                  <Badge tone="green">Everything</Badge>
                ) : r.permissions.length ? (
                  r.permissions.map((p) => (
                    <Badge key={p} tone="green">
                      {(PERMISSION_SHORT as Record<string, string>)[p] ?? p}
                    </Badge>
                  ))
                ) : (
                  <Badge>No permissions</Badge>
                )}
              </div>
              <p className="text-[0.6875rem] text-slate-500">Students: {team.studentScopes[r.studentsScope]}</p>
              {!isSuper && (
                <div className="flex gap-2 pt-1">
                  <GhostButton onClick={() => edit(r)}>
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                  </GhostButton>
                  {!r.builtIn && (
                    <GhostButton
                      tone="danger"
                      onClick={() => {
                        if (window.confirm(`Delete the role “${r.name}”?`)) void run(() => adminApi.deleteRole(r.id), `Role “${r.name}” deleted.`);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                    </GhostButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export { errorText };
