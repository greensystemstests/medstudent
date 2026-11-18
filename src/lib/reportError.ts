import { API_BASE } from "./apiBase";

/**
 * Tells the team when something breaks in a visitor's browser, so problems are found before a student
 * has to write to us. Sends only: what happened (cleaned and shortened on the server), the page path
 * (no query), the wizard step, and, if they're signed in, their session so the team can find the
 * affected account. No cookies or other storage on the device. Never throws and never blocks the page.
 */
export type ClientEventKind = "js_error" | "unhandled_rejection" | "render_error" | "api_error" | "payment_form" | "validation";

const MAX_PER_PAGE_LOAD = 8;
const sent = new Set<string>();
let step: number | undefined;

/** The wizard tells us which step is open, so errors can say where people were. */
export const setReportStep = (n: number | undefined) => {
  step = n;
};

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection/i,
  /Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i, // an update shipped while the page was open
  /extension|chrome-extension|moz-extension|safari-extension/i,
  /^Load failed$|^Failed to fetch$|^NetworkError/i, // the visitor's connection, not our bug (API failures are reported separately)
];

function token(): string | null {
  try {
    return sessionStorage.getItem("studybg.session") ?? localStorage.getItem("studybg.session");
  } catch {
    return null;
  }
}

export function reportEvent(kind: ClientEventKind, message: string, extra: { route?: string; status?: number; step?: number } = {}) {
  try {
    const text = String(message || "").slice(0, 300);
    if (!text || NOISE.some((r) => r.test(text))) return;
    const key = `${kind}|${text}|${extra.route ?? ""}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE_LOAD) return;
    sent.add(key);
    const headers: Record<string, string> = { "content-type": "application/json" };
    const t = token();
    if (t) headers.authorization = `Bearer ${t}`;
    void fetch(`${API_BASE}/api/client-events`, {
      method: "POST",
      headers,
      keepalive: true,
      body: JSON.stringify({ kind, message: text, page: window.location.pathname, step: extra.step ?? step, route: extra.route, status: extra.status }),
    }).catch(() => {});
  } catch {
    // reporting must never cause a problem of its own
  }
}

export function installErrorReporting() {
  window.addEventListener("error", (e) => {
    // Resource load errors (images, scripts) have no message and are handled elsewhere.
    if (!e.message) return;
    const where = e.filename && !e.filename.startsWith(window.location.origin) ? " (outside script)" : "";
    if (where) return; // code from another origin (extensions, third-party) isn't ours to fix
    reportEvent("js_error", e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    reportEvent("unhandled_rejection", r instanceof Error ? r.message : typeof r === "string" ? r : "Unhandled promise rejection");
  });
}
