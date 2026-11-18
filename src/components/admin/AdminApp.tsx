import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminApiError, AdminProfile, adminApi, getAdminToken, setAdminToken } from "../../lib/adminApi";
import { AdminSignIn, SignInStep } from "./AdminSignIn";
import { AdminShell } from "./AdminShell";
import { RecoveryCodes } from "./RecoveryCodes";
import { GhostButton, Notice, errorText } from "./ui";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "signin"; step?: SignInStep }
  | { kind: "recovery"; codes: string[]; admin: AdminProfile }
  | { kind: "ready"; admin: AdminProfile };

/** The whole admin area. Loaded only when someone opens /admin/, so it adds nothing to the public site. */
const AdminApp: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const resume = useCallback(async () => {
    if (!getAdminToken()) return setPhase({ kind: "signin" });
    setPhase({ kind: "loading" });
    try {
      const me = await adminApi.me();
      if (me.stage === "full" && me.admin) setPhase({ kind: "ready", admin: me.admin });
      else if (me.stage === "totp") setPhase({ kind: "signin", step: { kind: "totp", email: me.email ?? "" } });
      else setPhase({ kind: "signin", step: { kind: "enroll", email: me.email ?? "" } });
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        setAdminToken(null);
        setPhase({ kind: "signin" });
      } else setPhase({ kind: "error", message: errorText(err) });
    }
  }, []);

  useEffect(() => {
    document.title = "Admin | StudyBg";
    void resume();
  }, [resume]);

  const signOut = async () => {
    try {
      await adminApi.logout();
    } catch {
      // the token is dropped below either way
    }
    setAdminToken(null);
    setPhase({ kind: "signin" });
  };

  if (phase.kind === "loading")
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500" role="status">
        <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
      </div>
    );
  if (phase.kind === "error")
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md space-y-3">
          <Notice kind="error">{phase.message}</Notice>
          <GhostButton onClick={() => void resume()}>Try again</GhostButton>
        </div>
      </div>
    );
  if (phase.kind === "signin")
    return (
      <AdminSignIn
        initial={phase.step}
        onDone={(admin, codes) => setPhase(codes?.length ? { kind: "recovery", codes, admin } : { kind: "ready", admin })}
      />
    );
  if (phase.kind === "recovery")
    return <RecoveryCodes codes={phase.codes} onContinue={() => setPhase({ kind: "ready", admin: phase.admin })} />;
  return (
    <AdminShell
      admin={phase.admin}
      onSignOut={signOut}
      onAdminChange={(admin) => setPhase({ kind: "ready", admin })}
      onSessionLost={() => {
        setAdminToken(null);
        setPhase({ kind: "signin" });
      }}
    />
  );
};

export default AdminApp;
