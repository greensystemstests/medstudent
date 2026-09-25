const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const SESSION_KEY = 'studybg.session';

export interface AccountUser {
  email: string;
  fullName: string | null;
  createdAt: string;
}

export interface PaidApplication {
  paymentIntentId: string;
  receiptRef: string;
  amount: number;
  currency: string;
  paidAt: string;
  applicantName: string | null;
  degree: string | null;
  university: string | null;
  intake: string | null;
  examSession: string | null;
  callDate: string | null;
  callWindow: string | null;
}

export type DocumentCategory = 'passport' | 'diploma' | 'transcript' | 'medical' | 'police' | 'other';

export interface StoredDocument {
  id: string;
  category: DocumentCategory;
  categoryLabel: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  uploadedAt: string;
  reviewNote?: string;
}

export interface DocumentsResponse {
  documents: StoredDocument[];
  limits: { maxFileBytes: number; maxDocuments: number; maxTotalBytes: number };
  usage: { count: number; bytes: number };
}

export interface ActivityEvent {
  id: string;
  type: string;
  detail: string;
  at: string;
}

/** Documents every applicant needs, in the order they're usually gathered. */
export const REQUIRED_DOCUMENTS: { category: DocumentCategory; label: string; hint: string }[] = [
  { category: 'passport', label: 'Passport', hint: 'Photo page, clearly readable' },
  { category: 'diploma', label: 'High school diploma', hint: 'With Hague Apostille (or consular legalization)' },
  { category: 'transcript', label: 'Science transcript', hint: 'Showing Biology and Chemistry grades' },
  { category: 'medical', label: 'Medical certificate (if required)', hint: 'Confirm the university’s current requirements before uploading' },
  { category: 'police', label: 'Police clearance (if required)', hint: 'Confirm the applicable requirements with your advisor' },
];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  passport: 'Passport',
  diploma: 'High school diploma',
  transcript: 'Science transcript',
  medical: 'Medical certificate',
  police: 'Police clearance',
  other: 'Other document',
};

export class AccountApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const token = getSessionToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(25000),
      headers: {
        ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
        ...(init.auth !== false && token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new AccountApiError('Could not reach StudyBg. Check your connection and try again.', 0);
  }
  if (res.status === 401 && init.auth !== false) setSessionToken(null);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AccountApiError(body.error || `Request failed (${res.status})`, res.status);
  return body as T;
}

export const requestCode = (email: string) =>
  request<{ sent: true }>('/api/auth/request-code', { method: 'POST', body: JSON.stringify({ email }), auth: false });

export async function verifyCode(email: string, code: string) {
  const result = await request<{ token: string; user: AccountUser }>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    auth: false,
  });
  setSessionToken(result.token);
  return result.user;
}

export async function signOut() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    setSessionToken(null);
  }
}

export const getProfile = () =>
  request<{ user: AccountUser; applications: PaidApplication[]; applicationsAvailable: boolean }>('/api/me');

export const getDocuments = () => request<DocumentsResponse>('/api/me/documents');

export const getActivity = () => request<{ activity: ActivityEvent[] }>('/api/me/activity');

export const deleteDocument = (id: string) => request<{ ok: true }>(`/api/me/documents/${id}`, { method: 'DELETE' });

/** Uploads with progress (fetch can't report upload progress, XMLHttpRequest can). */
export function uploadDocument(file: File, category: DocumentCategory, onProgress: (fraction: number) => void) {
  return new Promise<StoredDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = new URLSearchParams({ category, filename: file.name });
    xhr.timeout = 60000;
    xhr.ontimeout = () => reject(new AccountApiError('Upload timed out. Refresh your documents before retrying.', 0));
    xhr.open('POST', `${API_BASE}/api/me/documents?${qs}`);
    const token = getSessionToken();
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new AccountApiError('Upload failed. Check your connection and try again.', 0));
    xhr.onload = () => {
      let body: { error?: string; document?: StoredDocument } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON error page (e.g. a proxy); fall through to the generic message.
      }
      if (xhr.status === 401) setSessionToken(null);
      if (xhr.status >= 200 && xhr.status < 300 && body.document) resolve(body.document);
      else reject(new AccountApiError(body.error || `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.send(file);
  });
}

/** Fetches a document with the session header and hands back a temporary local URL for it. */
export async function fetchDocumentBlobUrl(id: string, download = false) {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE}/api/me/documents/${id}/file${download ? '?download=1' : ''}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) setSessionToken(null);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AccountApiError(body.error || 'Could not open this document.', res.status);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}

/** What the account page needs. The live implementation talks to the API; the demo one is in-memory. */
export interface AccountApi {
  isDemo: boolean;
  isSignedIn(): boolean;
  requestCode(email: string): Promise<unknown>;
  verifyCode(email: string, code: string): Promise<AccountUser>;
  signOut(): Promise<void>;
  getProfile(): ReturnType<typeof getProfile>;
  getDocuments(): Promise<DocumentsResponse>;
  getActivity(): Promise<{ activity: ActivityEvent[] }>;
  deleteDocument(id: string): Promise<unknown>;
  uploadDocument(file: File, category: DocumentCategory, onProgress: (fraction: number) => void): Promise<StoredDocument>;
  fetchDocumentBlobUrl(id: string, download?: boolean): Promise<{ url: string; type: string }>;
}

export const liveAccountApi: AccountApi = {
  isDemo: false,
  isSignedIn: () => Boolean(getSessionToken()),
  requestCode,
  verifyCode,
  signOut,
  getProfile,
  getDocuments,
  getActivity,
  deleteDocument,
  uploadDocument,
  fetchDocumentBlobUrl,
};
