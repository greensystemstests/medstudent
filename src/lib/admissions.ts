import { EXAM_SESSIONS, UNIVERSITIES } from '../data/constants';
import { AnnualDate, University } from '../types';

/**
 * Admission dates roll over automatically each year, so the site never shows last year's
 * deadlines or an exam calendar where every session is already closed.
 */

const endOfDay = (year: number, { month, day }: AnnualDate) => new Date(year, month - 1, day, 23, 59, 59);
const isoDate = (year: number, { month, day }: AnnualDate) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const formatLongDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The next time this month/day comes round (today counts). */
export function nextOccurrence(date: AnnualDate, now = new Date()): Date {
  const thisYear = endOfDay(now.getFullYear(), date);
  return thisYear >= now ? thisYear : endOfDay(now.getFullYear() + 1, date);
}

/** Year of the exam season applicants are preparing for: this year until its last session has passed. */
export function examSeasonYear(now = new Date()): number {
  const last = EXAM_SESSIONS[EXAM_SESSIONS.length - 1];
  return endOfDay(now.getFullYear(), last) >= now ? now.getFullYear() : now.getFullYear() + 1;
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
export function examSessions(now = new Date()): DatedExamSession[] {
  const year = examSeasonYear(now);
  return EXAM_SESSIONS.map((s) => ({
    date: isoDate(year, s),
    label: `${s.name} (${formatLongDate(endOfDay(year, s))})`,
    note: s.note,
  }));
}

/** Readable name for a saved examDate, even one from an earlier season. */
export function examSessionLabel(date: string, now = new Date()): string | undefined {
  const session = examSessions(now).find((s) => s.date === date);
  if (session) return session.label;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : formatLongDate(parsed);
}

export function universityDeadline(uni: University, now = new Date()): string {
  const date = formatLongDate(nextOccurrence(uni.applicationDeadline, now));
  return uni.applicationDeadline.note ? `${date} (${uni.applicationDeadline.note})` : date;
}

/** The university whose application deadline comes up soonest. */
export function soonestDeadline(now = new Date()): { university: University; date: Date } {
  return UNIVERSITIES.map((university) => ({ university, date: nextOccurrence(university.applicationDeadline, now) })).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )[0];
}
