import React, { useState } from "react";
import { adminApi } from "../../lib/adminApi";
import type { PageContext } from "./AdminShell";
import { Badge, Card, CodeInput, Field, Notice, PrimaryButton, formatDate } from "./ui";
import { RecoveryCodes } from "./RecoveryCodes";

export const SecurityPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const { admin } = ctx;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.newRecoveryCodes(code);
      setCodes(res.recoveryCodes);
      ctx.onAdminChange({ ...admin, recoveryCodesLeft: res.recoveryCodes.length });
    } catch (err) {
      setError(ctx.fail(err));
    } finally {
      setBusy(false);
      setCode("");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900">My security</h1>
        <p className="text-sm text-slate-600 mt-1">How you sign in to the admin.</p>
      </div>
      <Card title="Two-step sign-in">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Authenticator app</dt>
            <dd className="mt-1">{admin.twoFactorEnabled ? <Badge tone="green">On</Badge> : <Badge tone="amber">Not set up</Badge>}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Recovery codes left</dt>
            <dd className="mt-1 font-semibold text-slate-900">{admin.recoveryCodesLeft}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last sign-in</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatDate(admin.lastLoginAt)}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500 mt-4">Lost your phone? Ask a super admin to reset your two-step sign-in, or use one of your recovery codes.</p>
      </Card>

      <Card title="New recovery codes">
        {codes ? (
          <RecoveryCodes codes={codes} fullscreen={false} onContinue={() => setCodes(null)} />
        ) : (
          <form onSubmit={regenerate} className="max-w-sm space-y-3">
            <p className="text-sm text-slate-600">Make a fresh set of recovery codes. The old ones stop working. Enter the current code from your authenticator app to confirm.</p>
            <Field label="Code from your app" htmlFor="security-code">
              <CodeInput id="security-code" value={code} onChange={setCode} />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            <PrimaryButton type="submit" busy={busy} disabled={code.length !== 6} id="security-regenerate">
              Make new recovery codes
            </PrimaryButton>
          </form>
        )}
      </Card>
    </div>
  );
};
