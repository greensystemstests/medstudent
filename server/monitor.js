// Records what goes wrong (in the browser and on the server) so the admin can see problems before
// students have to tell us. Messages are cleaned of email addresses and shortened; no IP address,
// full web address or browser fingerprint is stored. Events are kept for 30 days.
import crypto from "node:crypto";

export const CLIENT_KINDS = ["js_error", "unhandled_rejection", "render_error", "api_error", "payment_form", "validation"];
export const RETENTION_DAYS = 30;
const MAX_PER_MINUTE_PER_PROBLEM = 20;

const clip = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");
const redact = (s) => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");

/** "/api/applications/app-1a2b3c4d5e" -> "/api/applications/:id" so one problem is one problem. */
export function routeOf(path) {
  const clean = clip(String(path || ""), 160).split("?")[0].split("#")[0];
  return clean
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\bapp-[A-Za-z0-9-]{6,}/g, ":id")
    .replace(/\b(cs|pi|evt)_[A-Za-z0-9_]{6,}/g, ":id")
    .replace(/\/\d{3,}(?=\/|$)/g, "/:id");
}

/** Same problem, same fingerprint: numbers, ids and quoted values are blanked before hashing. */
export function fingerprintOf(kind, message, where) {
  const normal = String(message || "")
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#")
    .replace(/(["'`]).{0,80}?\1/g, "$1…$1")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha1").update(`${kind}|${normal}|${routeOf(where)}`).digest("hex").slice(0, 16);
}

export function createMonitor(db, log = () => {}) {
  let recorded = 0;
  return {
    /** Never throws: monitoring must not break what it is watching. */
    async record(event) {
      try {
        if (!db) return false;
        const message = redact(clip(event.message, 300));
        if (!message) return false;
        const kind = clip(event.kind, 40);
        const route = event.route ? routeOf(event.route) : null;
        const page = event.page ? routeOf(event.page) : null;
        const fingerprint = fingerprintOf(kind, message, route || page || "");
        // A flood of one identical problem is counted, not stored without limit.
        const recent = await db.query(
          "SELECT count(*)::int AS n FROM error_events WHERE fingerprint = $1 AND created_at > now() - interval '1 minute'",
          [fingerprint],
        );
        if (recent.rows[0].n >= MAX_PER_MINUTE_PER_PROBLEM) return false;
        const step = Number.isInteger(event.step) && event.step >= 1 && event.step <= 8 ? event.step : null;
        const status = Number.isInteger(event.status) && event.status >= 0 && event.status < 1000 ? event.status : null;
        await db.query(
          `INSERT INTO error_events (source, kind, fingerprint, message, route, page, status, step, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [event.source === "client" ? "client" : "server", kind, fingerprint, message, route, page, status, step, event.userId || null],
        );
        if (++recorded % 50 === 0) await this.cleanup();
        return true;
      } catch (error) {
        log(`monitor: could not record event: ${error.message}`);
        return false;
      }
    },
    async cleanup() {
      try {
        await db.query("DELETE FROM error_events WHERE created_at < now() - make_interval(days => $1)", [RETENTION_DAYS]);
      } catch {
        // best effort
      }
    },
  };
}
