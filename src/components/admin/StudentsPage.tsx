import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { UNIVERSITIES } from "../../data/constants";
import { StudentFilters, StudentList, StudentRow, adminApi, adminCan } from "../../lib/adminApi";
import { applicationStatus, TONE_CLASS } from "../../lib/statusLabels";
import type { PageContext } from "./AdminShell";
import { StudentDetail } from "./StudentDetail";
import { Badge, Card, GhostButton, Notice, formatDate, inputClass } from "./ui";

export const universityName = (id: string) => UNIVERSITIES.find((u) => u.id === id)?.shortName ?? id;

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = applicationStatus(status);
  return <span className={`inline-flex text-[0.6875rem] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${TONE_CLASS[s.tone]}`}>{s.label}</span>;
};

const hashId = () => {
  const [, id] = window.location.hash.replace(/^#/, "").split("/");
  return id ? decodeURIComponent(id) : null;
};

/** The student list with filters, and (when one is opened) that student's file. */
export const StudentsPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [filters, setFilters] = useState<StudentFilters>({ sort: "updated", page: 1 });
  const [data, setData] = useState<StudentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(hashId());
  const [searchText, setSearchText] = useState("");
  const timer = useRef<number>();
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.students(filters));
      setError(null);
    } catch (err) {
      setError(ctx.fail(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onHash = () => setOpenId(hashId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const open = (id: string | null) => {
    window.history.replaceState(null, "", id ? `#students/${encodeURIComponent(id)}` : "#students");
    setOpenId(id);
    window.scrollTo({ top: 0 });
  };
  const set = (patch: Partial<StudentFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const onSearch = (v: string) => {
    setSearchText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: v }), 350);
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { url } = await adminApi.exportCsv({ ...filters, page: undefined });
      const a = document.createElement("a");
      a.href = url;
      a.download = "studybg-students.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError(ctx.fail(err));
    } finally {
      setExporting(false);
    }
  };

  if (openId)
    return <StudentDetail ctx={ctx} id={openId} assignable={data?.assignable ?? []} onBack={() => open(null)} onChanged={load} />;

  const f = data?.facets;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const active = Object.entries(filters).some(([k, v]) => !["sort", "page"].includes(k) && v);
  const sel = (id: string, label: string, key: keyof StudentFilters, options: { value: string; label: string }[]) => (
    <div>
      <label htmlFor={id} className="block text-[0.6875rem] font-bold text-slate-600 mb-1">
        {label}
      </label>
      <select id={id} value={String(filters[key] ?? "")} onChange={(e) => set({ [key]: e.target.value } as Partial<StudentFilters>)} className={`${inputClass} !py-2 text-xs`}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold font-heading text-slate-900">Students</h1>
          <p className="text-sm text-slate-600 mt-1">
            {ctx.admin.role.studentsScope === "assigned" ? "The students assigned to you." : "Everyone who has started an application."}
          </p>
        </div>
        <GhostButton onClick={exportCsv} disabled={exporting} id="students-export">
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> {exporting ? "Preparing…" : "Export CSV"}
        </GhostButton>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="relative">
            <label htmlFor="students-search" className="sr-only">
              Search students
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input id="students-search" type="search" value={searchText} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name, email or application ID" className={`${inputClass} !pl-10`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {sel("f-status", "Status", "status", (f?.status ?? []).map((x) => ({ value: x.value, label: `${applicationStatus(x.value).label} (${x.count})` })))}
            {sel("f-degree", "Degree", "degree", (f?.degree ?? []).map((x) => ({ value: x.value, label: `${x.value} (${x.count})` })))}
            {sel("f-uni", "University", "university", (f?.university ?? []).map((x) => ({ value: x.value, label: `${universityName(x.value)} (${x.count})` })))}
            {sel("f-source", "Came from", "source", (f?.source ?? []).map((x) => ({ value: x.value, label: `${x.value} (${x.count})` })))}
            {sel("f-country", "Passport country", "country", (f?.country ?? []).map((x) => ({ value: x.value, label: `${x.value} (${x.count})` })))}
            {sel("f-paid", "Payment", "paid", [{ value: "yes", label: "Paid" }, { value: "no", label: "Not paid" }])}
            {data && data.assignable.length > 0 &&
              sel("f-assigned", "Assigned to", "assigned", [{ value: "me", label: "Me" }, { value: "none", label: "Nobody yet" }, ...data.assignable.map((a) => ({ value: a.id, label: a.name }))])}
            <div>
              <label htmlFor="f-sort" className="block text-[0.6875rem] font-bold text-slate-600 mb-1">
                Sort by
              </label>
              <select id="f-sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className={`${inputClass} !py-2 text-xs`}>
                <option value="updated">Last activity</option>
                <option value="created">Newest first</option>
              </select>
            </div>
          </div>
          {active && (
            <button
              type="button"
              className="text-xs font-semibold text-[#006644] underline"
              onClick={() => {
                setSearchText("");
                setFilters({ sort: filters.sort, page: 1 });
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {error && <Notice kind="error">{error}</Notice>}
      <p className="text-sm text-slate-600" role="status" aria-live="polite">
        {loading && !data ? "Loading…" : data ? `${data.total} student${data.total === 1 ? "" : "s"}${active ? " match" : ""}` : ""}
      </p>

      {data && data.items.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-sm" aria-label="Students">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-bold">Student</th>
                  <th className="px-3 py-3 font-bold">Wants to study</th>
                  <th className="px-3 py-3 font-bold">Came from</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Assigned</th>
                  <th className="px-5 py-3 font-bold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => open(s.id)} data-testid="student-row">
                    <td className="px-5 py-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); open(s.id); }} className="text-left">
                        <div className="font-semibold text-slate-900">{s.name || "Name not entered"}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {s.degree || "—"}
                      <div className="text-slate-500">{s.universityId ? universityName(s.universityId) : ""}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {s.source}
                      <div className="text-slate-500">{s.signupCountry || s.country}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">{s.assignedTo?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(s.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-3" aria-label="Students">
            {data.items.map((s) => (
              <li key={s.id}>
                <MobileCard s={s} onOpen={() => open(s.id)} />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <GhostButton disabled={filters.page === 1} onClick={() => set({ page: (filters.page ?? 1) - 1 })}>
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Previous
            </GhostButton>
            <span className="text-xs text-slate-600">
              Page {filters.page} of {pages}
            </span>
            <GhostButton disabled={(filters.page ?? 1) >= pages} onClick={() => set({ page: (filters.page ?? 1) + 1 })}>
              Next <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </GhostButton>
          </div>
        </>
      )}
      {data && data.items.length === 0 && !loading && (
        <Card>
          <p className="text-sm text-slate-600">{active ? "No students match these filters." : "No applications yet. They appear here as soon as someone signs in and saves one."}</p>
        </Card>
      )}
    </div>
  );
};

const MobileCard: React.FC<{ s: StudentRow; onOpen: () => void }> = ({ s, onOpen }) => (
  <button type="button" onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2" data-testid="student-row">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 truncate">{s.name || "Name not entered"}</div>
        <div className="text-xs text-slate-500 truncate">{s.email}</div>
      </div>
      <StatusBadge status={s.status} />
    </div>
    <div className="text-xs text-slate-700">
      {s.degree || "—"} · {s.universityId ? universityName(s.universityId) : "no university yet"}
    </div>
    <div className="flex flex-wrap gap-1.5">
      <Badge>{s.source}</Badge>
      {(s.signupCountry || s.country) && <Badge>{s.signupCountry || s.country}</Badge>}
      {s.assignedTo && <Badge tone="green">{s.assignedTo.name}</Badge>}
    </div>
  </button>
);

export { adminCan };
