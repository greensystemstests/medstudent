import React, { useEffect, useState } from "react";
import { Activity, FileText, GraduationCap, Link2, LayoutDashboard, LogOut, ScrollText, ShieldCheck, Users } from "lucide-react";
import { AdminApiError, AdminProfile, adminCan, isSuperAdmin } from "../../lib/adminApi";
import { OverviewPage } from "./OverviewPage";
import { StudentsPage } from "./StudentsPage";
import { MonitoringPage } from "./MonitoringPage";
import { ContentPage } from "./ContentPage";
import { AffiliatesPage } from "./AffiliatesPage";
import { TeamPage } from "./TeamPage";
import { AuditPage } from "./AuditPage";
import { SecurityPage } from "./SecurityPage";

export interface PageContext {
  admin: AdminProfile;
  /** Call from a catch block. Returns the message to show, or null when the session ended (the app then goes to sign-in). */
  fail: (err: unknown) => string | null;
  onAdminChange: (admin: AdminProfile) => void;
}

interface Props {
  admin: AdminProfile;
  onSignOut: () => void;
  onAdminChange: (admin: AdminProfile) => void;
  onSessionLost: () => void;
}

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  allowed: (a: AdminProfile) => boolean;
}

// Sections appear here as they're built. The server checks every request; this list only hides what a role can't use.
const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, allowed: () => true },
  { id: "students", label: "Students", icon: GraduationCap, allowed: (a) => adminCan(a, "students.view") },
  { id: "monitoring", label: "Monitoring", icon: Activity, allowed: (a) => adminCan(a, "monitoring.view") },
  { id: "affiliates", label: "Referral links", icon: Link2, allowed: (a) => adminCan(a, "affiliates.view") },
  { id: "content", label: "Site content", icon: FileText, allowed: (a) => adminCan(a, "content.edit") },
  { id: "team", label: "Team & roles", icon: Users, allowed: isSuperAdmin },
  { id: "audit", label: "Audit log", icon: ScrollText, allowed: isSuperAdmin },
  { id: "security", label: "My security", icon: ShieldCheck, allowed: () => true },
];

// "#students/app-123" opens that student: the section is the part before the slash.
const fromHash = () => (typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "").split("/")[0]);

export const AdminShell: React.FC<Props> = ({ admin, onSignOut, onAdminChange, onSessionLost }) => {
  const allowed = SECTIONS.filter((s) => s.allowed(admin));
  const [current, setCurrent] = useState(() => (allowed.some((s) => s.id === fromHash()) ? fromHash() : "overview"));

  useEffect(() => {
    const onHash = () => {
      const h = fromHash();
      if (allowed.some((s) => s.id === h)) setCurrent(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });

  const go = (id: string) => {
    setCurrent(id);
    window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const ctx: PageContext = {
    admin,
    onAdminChange,
    fail: (err) => {
      if (err instanceof AdminApiError && err.status === 401) {
        onSessionLost();
        return null;
      }
      return err instanceof Error ? err.message : "Something went wrong. Please try again.";
    },
  };

  const active = allowed.find((s) => s.id === current) ?? allowed[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#006644] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-heading font-extrabold text-slate-900 truncate">StudyBg Admin</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-right min-w-0 hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 truncate">{admin.fullName || admin.email}</div>
              <div className="text-[0.6875rem] text-slate-500 truncate">{admin.role.name}</div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              id="admin-signout"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-8 lg:flex lg:gap-8">
        <nav aria-label="Admin sections" className="lg:w-56 lg:shrink-0 mb-5 lg:mb-0">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {allowed.map((s) => {
              const Icon = s.icon;
              const on = s.id === active.id;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={on ? "page" : undefined}
                    id={`admin-nav-${s.id}`}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap ${
                      on ? "bg-[#006644] text-white" : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0" id="admin-main">
          {active.id === "overview" && <OverviewPage ctx={ctx} onNavigate={go} />}
          {active.id === "students" && <StudentsPage ctx={ctx} />}
          {active.id === "monitoring" && <MonitoringPage ctx={ctx} />}
          {active.id === "affiliates" && <AffiliatesPage ctx={ctx} />}
          {active.id === "content" && <ContentPage ctx={ctx} />}
          {active.id === "team" && <TeamPage ctx={ctx} />}
          {active.id === "audit" && <AuditPage ctx={ctx} />}
          {active.id === "security" && <SecurityPage ctx={ctx} />}
        </div>
      </div>
    </div>
  );
};
