/**
 * Plain-language names for the status values the server stores (server/workflow.js, server/billing.js,
 * server/db.js). Used by My Account and staff review so both describe the same state the same way.
 */
export type Tone = "neutral" | "progress" | "action" | "done";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-800 border-slate-200",
  progress: "bg-sky-50 text-sky-900 border-sky-200",
  action: "bg-amber-50 text-amber-900 border-amber-300",
  done: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

const APPLICATION: Record<string, { label: string; next: string; tone: Tone }> = {
  draft: { label: "Draft", next: "Finish the remaining steps. Payment is the last step.", tone: "neutral" },
  checkout: { label: "Waiting for payment", next: "Complete the payment, or cancel checkout to edit your answers.", tone: "action" },
  submitted: { label: "Paid, waiting for review", next: "We’ll review your file and email you to confirm your call time.", tone: "progress" },
  in_review: { label: "Being reviewed", next: "Nothing to do right now. We’ll add notes here as we go.", tone: "progress" },
  action_needed: { label: "Action needed", next: "Read the note from our team, then update your documents.", tone: "action" },
  review_complete: { label: "Review complete", next: "See the notes from our team. Next steps are covered on your call.", tone: "done" },
};

const DOCUMENT: Record<string, { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "neutral" },
  in_review: { label: "Being reviewed", tone: "progress" },
  action_needed: { label: "Action needed", tone: "action" },
  verified: { label: "Checked by our team", tone: "done" },
};

const fallback = (status: string) => status.replaceAll("_", " ");

export const applicationStatus = (status?: string) =>
  APPLICATION[status ?? ""] ?? { label: fallback(status ?? "unknown"), next: "", tone: "neutral" as Tone };

export const documentStatus = (status: string) =>
  DOCUMENT[status] ?? { label: fallback(status), tone: "neutral" as Tone };
