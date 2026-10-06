import React from "react";
import { SOURCE_REVIEW_DATE, UNIVERSITIES } from "../../shared/admissions.js";
import { DEADLINE_NOTES } from "../data/guides";
import { formatLongDate } from "../lib/admissions";
import { pathFor, universityView } from "../lib/routes";

const reviewDate = formatLongDate(new Date(`${SOURCE_REVIEW_DATE}T12:00:00`));

export function AdmissionsCalendar() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">
      <h1 className="text-3xl font-bold">
        Admissions calendar: Bulgarian medical universities, 2026/27
      </h1>
      <p>
        Published deadlines and intake windows for English-taught Medicine and
        Dentistry. Dates vary by university, citizenship and qualification.
        Last source review: <time dateTime={SOURCE_REVIEW_DATE}>{reviewDate}</time>.
        Future exam sessions are shown only after publication by the
        university.
      </p>
      {UNIVERSITIES.map((u) => (
        <section
          key={u.id}
          className="p-5 bg-white border rounded-xl space-y-3"
        >
          <h2 className="text-xl font-bold">
            <a
              href={pathFor(universityView(u.id))}
              className="hover:text-[#006644] hover:underline underline-offset-2"
            >
              {u.name}
            </a>
          </h2>
          <p>{u.rule}</p>
          <p>{DEADLINE_NOTES[u.id]}</p>
          <a
            className="text-[#006644] underline"
            href={u.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official admission requirements and dates ↗
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </section>
      ))}
      <p>
        New to the process? Read{" "}
        <a href={pathFor("guide")} className="text-[#006644] font-semibold underline">
          how to study medicine in Bulgaria in English
        </a>
        .
      </p>
    </div>
  );
}
