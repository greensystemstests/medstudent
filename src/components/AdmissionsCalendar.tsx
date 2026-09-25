import React from "react";
import { UNIVERSITIES } from "../../shared/admissions.js";
export function AdmissionsCalendar() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Admissions calendar</h1>
      <p>
        Dates vary by university, citizenship and qualification. Last source
        review: 24 September 2026. Future exam sessions are shown only after
        publication by the university.
      </p>
      {UNIVERSITIES.map((u) => (
        <section
          key={u.id}
          className="p-5 bg-white border rounded-xl space-y-3"
        >
          <h2 className="text-xl font-bold">{u.name}</h2>
          <p>{u.rule}</p>
          <p>
            {u.id === "mu-plovdiv"
              ? "Published 2026/27 document deadline: 11 September 2026 (closed)."
              : u.id === "mu-pleven"
                ? "Published non-EU February 2027 application window ends 1 October 2026. Check hard-copy deadlines and your applicant route."
                : "Check the official calendar for your applicant route. New dates are not yet verified here."}
          </p>
          <a
            className="text-[#006644] underline"
            href={u.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official admission requirements and dates ↗
          </a>
        </section>
      ))}
    </div>
  );
}
