import { University } from "../types";

export const formatLongDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Year of the exam season applicants are preparing for: this year until its last session has passed. */
export function examSeasonYear(now = new Date()): number {
  return now.getFullYear();
}

/** Academic year of the main (October) intake applicants are applying for, e.g. "2027/2028". */
export function intakeYearLabel(now = new Date()): string {
  const year = examSeasonYear(now);
  return `${year}/${year + 1}`;
}

export interface DatedExamSession {
  date: string;
  label: string;
  note: string;
}

/** This season's exam sessions with real dates. */
export function examSessions(_now = new Date()): DatedExamSession[] {
  return [];
}

/** Readable name for a saved examDate, even one from an earlier season. */
export function examSessionLabel(
  date: string,
  now = new Date(),
): string | undefined {
  const session = examSessions(now).find((s) => s.date === date);
  if (session) return session.label;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : formatLongDate(parsed);
}

export function universityDeadline(
  _uni: University,
  _now = new Date(),
): string {
  return "Check the official university calendar";
}
