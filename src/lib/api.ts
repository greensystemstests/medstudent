import { getSessionToken } from "./account";
import { POLICY_VERSION } from "../../shared/admissions.js";
import { EXAM_DECIDE_WITH_ADVISOR, UNIVERSITIES } from "../data/constants";
import { ApplicationState } from "../types";

// Empty in local dev (Vite proxies /api to the local server); set at build time for production.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export interface PaymentConfig {
  publishableKey: string;
  amount: number;
  currency: string;
  testMode: boolean;
}

export interface PaymentIntentInfo {
  paymentIntentId: string;
  status: string;
  paid: boolean;
  amount: number;
  currency: string;
  receiptRef: string;
  createdAt: string;
  clientSecret?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(25000),
      headers: {
        "content-type": "application/json",
        ...(getSessionToken()
          ? { authorization: `Bearer ${getSessionToken()}` }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach StudyBg. Check your connection and try again.",
      0,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      body.error || `Request failed (${res.status})`,
      res.status,
    );
  return body as T;
}

/** Wakes the API early (free hosting tiers sleep when idle) so the payment step loads fast. */
export function warmUpApi() {
  fetch(`${API_BASE}/api/health`).catch(() => {});
}

export const getPaymentConfig = () => request<PaymentConfig>("/api/config");

export const listApplications = () =>
  request<{ applications: ApplicationState[] }>("/api/applications");
export const getApplication = (id: string) =>
  request<ApplicationState>(`/api/applications/${encodeURIComponent(id)}`);
export const saveOnline = (app: ApplicationState) =>
  request<ApplicationState>(`/api/applications/${encodeURIComponent(app.id)}`, {
    method: "POST",
    body: JSON.stringify(app),
  });
export const reopenApplication = (id: string) =>
  request<ApplicationState>(
    `/api/applications/${encodeURIComponent(id)}/reopen`,
    { method: "POST", body: "{}" },
  );
export async function createOrUpdatePaymentIntent(app: ApplicationState) {
  return request<PaymentIntentInfo>("/api/payment-intent", {
    method: "POST",
    body: JSON.stringify({
      applicationId: app.id,
      version: app.version,
      policyVersion: POLICY_VERSION,
    }),
  });
}

export const getPaymentStatus = (
  paymentIntentId: string,
  applicationId: string,
) =>
  request<PaymentIntentInfo>(
    `/api/payment-intent/${encodeURIComponent(paymentIntentId)}?applicationId=${encodeURIComponent(applicationId)}`,
  );
