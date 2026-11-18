import { API_BASE } from "./apiBase";

/** The admin session lives in this tab only (sessionStorage): closing the tab signs you out. */
const KEY = "studybg.admin";
export const getAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setAdminToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the session just won't survive a refresh
  }
};

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function req<T>(path: string, opts: { method?: string; json?: unknown; token?: string | null } = {}): Promise<T> {
  const token = opts.token === undefined ? getAdminToken() : opts.token;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, {
      method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"),
      headers: {
        ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AdminApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

export type StudentScope = "all" | "assigned";
export interface AdminRoleInfo {
  id: string;
  key: string | null;
  name: string;
  permissions: string[];
  studentsScope: StudentScope;
}
export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "disabled";
  twoFactorEnabled: boolean;
  recoveryCodesLeft: number;
  createdAt: string;
  lastLoginAt: string | null;
  role: AdminRoleInfo;
}
export interface RoleRow {
  id: string;
  key: string | null;
  name: string;
  description: string;
  permissions: string[];
  studentsScope: StudentScope;
  builtIn: boolean;
  adminCount: number;
}
export interface TeamData {
  admins: AdminProfile[];
  roles: RoleRow[];
  permissions: Record<string, string>;
  studentScopes: Record<string, string>;
}
export interface AuditEntry {
  id: number;
  admin_email: string;
  action: string;
  subject: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}
export type Stage = "totp" | "enroll" | "full";
export interface SessionState {
  stage: Stage;
  email?: string;
  admin?: AdminProfile;
}

/** Can this admin do this? (The server decides for real; this only shows or hides buttons.) */
export const adminCan = (admin: AdminProfile, permission: string) =>
  admin.status === "active" && (admin.role.key === "super_admin" || admin.role.permissions.includes(permission));
export const isSuperAdmin = (admin: AdminProfile) => admin.role.key === "super_admin";

export const adminApi = {
  requestCode: (email: string) => req<{ sent: true }>("/auth/request-code", { json: { email }, token: null }),
  verifyCode: (email: string, code: string) =>
    req<{ token: string; stage: Stage; email: string }>("/auth/verify-code", { json: { email, code }, token: null }),
  me: () => req<SessionState>("/auth/me"),
  verifyTotp: (input: { code?: string; recoveryCode?: string }) =>
    req<{ token: string; stage: "full"; admin: AdminProfile }>("/auth/verify-totp", { json: input }),
  enrollStart: () => req<{ secret: string; uri: string }>("/auth/enroll/start", { method: "POST", json: {} }),
  enrollConfirm: (code: string) =>
    req<{ token: string; stage: "full"; admin: AdminProfile; recoveryCodes: string[] }>("/auth/enroll/confirm", { json: { code } }),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST", json: {} }),
  newRecoveryCodes: (code: string) => req<{ recoveryCodes: string[] }>("/auth/recovery-codes", { json: { code } }),

  team: () => req<TeamData>("/team"),
  createAdmin: (input: { email: string; fullName: string; roleId: string }) =>
    req<{ admin: AdminProfile; invited: boolean }>("/team/admins", { json: input }),
  updateAdmin: (id: string, input: { fullName?: string; roleId?: string; status?: "active" | "disabled" }) =>
    req<{ admin: AdminProfile }>(`/team/admins/${id}`, { json: input }),
  resetTwoFactor: (id: string) => req<{ ok: true }>(`/team/admins/${id}/reset-2fa`, { method: "POST", json: {} }),
  deleteAdmin: (id: string) => req<{ ok: true }>(`/team/admins/${id}`, { method: "DELETE" }),
  createRole: (input: { name: string; description: string; permissions: string[]; studentsScope: StudentScope }) =>
    req<{ roleId: string }>("/team/roles", { json: input }),
  updateRole: (id: string, input: { name: string; description: string; permissions: string[]; studentsScope: StudentScope }) =>
    req<{ ok: true }>(`/team/roles/${id}`, { json: input }),
  deleteRole: (id: string) => req<{ ok: true }>(`/team/roles/${id}`, { method: "DELETE" }),
  audit: (before?: number) =>
    req<{ entries: AuditEntry[]; next: number | null }>(`/audit?limit=100${before ? `&before=${before}` : ""}`),
};
