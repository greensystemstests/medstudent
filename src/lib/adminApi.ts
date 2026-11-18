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

export interface ContentItem {
  key: string;
  group: string;
  label: string;
  type: "text" | "image";
  hint: string | null;
  multiline: boolean;
  max: number | null;
  original: string | null;
  value: string | null;
  imageUrl: string | null;
  changed: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}
export interface ContentData {
  groups: { id: string; label: string }[];
  items: ContentItem[];
}

/** Sends a picture as the request body (not as a form). */
async function upload<T>(path: string, file: Blob): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream", authorization: `Bearer ${getAdminToken() ?? ""}` },
      body: file,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new AdminApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(data.error || `Upload failed (${res.status})`, res.status);
  return data as T;
}

export interface AffiliateStats {
  clicks: number;
  clicksTotal: number;
  signups: number;
  started: number;
  paid: number;
  earnedPeriod: number;
  signupsAll: number;
  paidAll: number;
  earnedAll: number;
  adjustments: number;
  payouts: number;
  owed: number;
}
export interface AffiliateLink {
  id: string;
  code: string;
  name: string;
  sourceId: string;
  sourceName: string;
  commissionCents: number;
  destination: string;
  status: "active" | "paused";
  notes: string;
  createdBy: string;
  createdAt: string;
  stats: AffiliateStats;
}
export interface AffiliateRollup {
  links: number;
  clicks: number;
  signups: number;
  started: number;
  paid: number;
  earnedPeriod: number;
  owed: number;
  payouts: number;
}
export interface AffiliateData {
  window: string;
  totals: AffiliateRollup;
  bySource: (AffiliateRollup & { id: string; name: string })[];
  sources: { id: string; name: string; links: number }[];
  links: AffiliateLink[];
}
export interface AffiliatePayment {
  id: number;
  kind: "payout" | "adjustment";
  amountCents: number;
  note: string;
  createdBy: string;
  createdAt: string;
}
export interface AffiliateDetail {
  link: AffiliateLink;
  daily: { day: string; clicks: number }[];
  payments: AffiliatePayment[];
}
export interface AffiliateLinkInput {
  name: string;
  sourceId: string;
  commissionEur: string;
  destination: string;
  notes: string;
  code?: string;
  status?: "active" | "paused";
}

export type StudentScope = "all" | "assigned";

export function studentQuery(f: StudentFilters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  return p.toString();
}

/** Files need the sign-in header, so they are fetched here and handed to the page as a blob. */
async function blob(path: string): Promise<{ url: string; type: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, { headers: { authorization: `Bearer ${getAdminToken() ?? ""}` } });
  } catch {
    throw new AdminApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new AdminApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  const data = await res.blob();
  return { url: URL.createObjectURL(data), type: data.type };
}
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
export interface StudentRow {
  id: string;
  name: string;
  email: string;
  degree: string;
  universityId: string;
  status: string;
  paid: boolean;
  currentStep: number;
  source: string;
  country: string;
  signupCountry: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
}
export interface Facet {
  value: string;
  count: number;
}
export interface StudentList {
  items: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  facets: { status: Facet[]; degree: Facet[]; university: Facet[]; source: Facet[]; country: Facet[] };
  assignable: { id: string; name: string }[];
}
export interface StudentFilters {
  q?: string;
  status?: string;
  degree?: string;
  university?: string;
  source?: string;
  country?: string;
  paid?: string;
  assigned?: string;
  sort?: string;
  page?: number;
}
export interface StudentDetailData {
  application: {
    id: string;
    form: Record<string, unknown>;
    currentStep: number;
    status: string;
    updatedAt: string;
    payment: { status: string; paymentIntentId?: string; paidAt?: string; amount?: number; currency?: string; receiptRef?: string };
  };
  student: { email: string; createdAt: string; lastLoginAt: string | null; source: Record<string, string>; signupCountry: string };
  invoiceNumber: string | null;
  documents: { id: string; category: string; categoryLabel: string; filename: string; status: string; reviewNote: string; sizeBytes: number; createdAt: string }[];
  activity: { type: string; detail: string; created_at: string }[];
  notes: { id: number; admin_email: string; note: string; created_at: string }[];
  assignedTo: { id: string; name: string } | null;
}
export interface OverviewData {
  totals: Record<string, number>;
  bySource: Facet[];
  byCountry: Facet[];
  byDegree: Facet[];
  byUniversity: Facet[];
  perDay: { day: string; count: number }[];
  scope: StudentScope;
}
export interface SystemStatus {
  database: boolean;
  build: string;
  stripeMode: "test" | "live" | "none" | "unknown";
  paymentsReady: boolean;
  billingReady: boolean;
  accountsReady: boolean;
  checkoutEnabled: boolean;
  legalApproved: boolean;
  lastWebhook: { type: string; live: boolean; at: string } | null;
  emails: { pending: number; retrying: number; needsReview: number; oldestPendingMinutes: number };
  errors24h: { total: number; server: number; client: number };
}
export interface ErrorGroup {
  fingerprint: string;
  kind: string;
  source: "client" | "server";
  message: string;
  location: string;
  count: number;
  users: number;
  status: number | null;
  firstSeen: string;
  lastSeen: string;
  state: "open" | "resolved" | "ignored";
  recurred: boolean;
  note: string;
  stateBy: string | null;
  stateAt: string | null;
}
export interface ErrorEventRow {
  id: number;
  at: string;
  kind: string;
  source: string;
  message: string;
  route: string | null;
  page: string | null;
  status: number | null;
  step: number | null;
  signedIn: boolean;
  user: { email: string; applicationId: string | null } | null;
}
export interface FlowData {
  accountsCreated: number;
  applicationsSaved: number;
  reachedStep: { step: number; count: number }[];
  checkoutStarted: number;
  paid: number;
  abandonedCheckout: number;
  blocksByStep: { step: number; count: number }[];
  topBlocks: { step: number; message: string; count: number }[];
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
  overview: () => req<OverviewData>("/overview"),
  monitoringStatus: () => req<SystemStatus>("/monitoring/status"),
  errorGroups: (window: string, kind: string, state: string) =>
    req<{ groups: ErrorGroup[]; counts: Record<string, number> }>(`/monitoring/errors?window=${window}&state=${state}${kind ? `&kind=${kind}` : ""}`),
  errorEvents: (fingerprint: string) => req<{ events: ErrorEventRow[] }>(`/monitoring/errors/${fingerprint}`),
  setErrorState: (fingerprint: string, status: "open" | "resolved" | "ignored", note = "") =>
    req<{ ok: true }>(`/monitoring/errors/${fingerprint}/state`, { json: { status, note } }),
  flow: (window: string) => req<FlowData>(`/monitoring/flow?window=${window}`),
  students: (f: StudentFilters) => req<StudentList>(`/students?${studentQuery(f)}`),
  student: (id: string) => req<StudentDetailData>(`/students/${encodeURIComponent(id)}`),
  setStatus: (id: string, status: string, note: string) => req<{ ok: true }>(`/students/${encodeURIComponent(id)}/status`, { json: { status, note } }),
  assign: (id: string, adminId: string | null) => req<{ ok: true }>(`/students/${encodeURIComponent(id)}/assign`, { json: { adminId } }),
  addNote: (id: string, note: string) => req<{ ok: true }>(`/students/${encodeURIComponent(id)}/notes`, { json: { note } }),
  reviewDocument: (docId: string, status: string, note: string) => req<{ ok: true }>(`/students/documents/${docId}/review`, { json: { status, note } }),
  documentFile: (docId: string) => blob(`/students/documents/${docId}/file`),
  exportCsv: (f: StudentFilters) => blob(`/students/export.csv?${studentQuery(f)}`),
  content: () => req<ContentData>("/content"),
  saveText: (key: string, value: string) => req<{ ok: true; unchanged?: boolean }>(`/content/${encodeURIComponent(key)}`, { json: { value } }),
  resetContent: (key: string) => req<{ ok: true }>(`/content/${encodeURIComponent(key)}/reset`, { method: "POST", json: {} }),
  uploadImage: (key: string, file: Blob) => upload<{ ok: true; imageUrl: string }>(`/content/${encodeURIComponent(key)}/image`, file),
  affiliates: (window: string) => req<AffiliateData>(`/affiliates?window=${window}`),
  affiliate: (id: string) => req<AffiliateDetail>(`/affiliates/links/${id}`),
  createLink: (input: AffiliateLinkInput) => req<{ id: string; code: string }>("/affiliates/links", { json: input }),
  updateLink: (id: string, input: AffiliateLinkInput) => req<{ ok: true }>(`/affiliates/links/${id}`, { json: input }),
  deleteLink: (id: string) => req<{ ok: true }>(`/affiliates/links/${id}`, { method: "DELETE" }),
  addPayment: (id: string, input: { kind: "payout" | "adjustment"; amountEur: string; note: string }) =>
    req<{ ok: true }>(`/affiliates/links/${id}/payments`, { json: input }),
  removePayment: (id: string, paymentId: number) => req<{ ok: true }>(`/affiliates/links/${id}/payments/${paymentId}`, { method: "DELETE" }),
  createSource: (name: string) => req<{ id: string }>("/affiliates/sources", { json: { name } }),
  renameSource: (id: string, name: string) => req<{ ok: true }>(`/affiliates/sources/${id}`, { json: { name } }),
  deleteSource: (id: string) => req<{ ok: true }>(`/affiliates/sources/${id}`, { method: "DELETE" }),
  audit: (before?: number) =>
    req<{ entries: AuditEntry[]; next: number | null }>(`/audit?limit=100${before ? `&before=${before}` : ""}`),
};
