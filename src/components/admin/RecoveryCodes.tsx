import React, { useState } from "react";
import { Copy, Download } from "lucide-react";
import { Notice, PrimaryButton } from "./ui";

/** Shown once after two-step setup (and after "new recovery codes"). They can't be shown again. */
export const RecoveryCodes: React.FC<{ codes: string[]; onContinue: () => void; fullscreen?: boolean }> = ({ codes, onContinue, fullscreen = true }) => {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`StudyBg admin recovery codes\nEach works once.\n\n${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "studybg-admin-recovery-codes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const body = (
    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-4">
      <div>
        <h1 className="text-xl font-extrabold font-heading text-slate-900">Save your recovery codes</h1>
        <p className="text-sm text-slate-600 mt-1">
          If you lose your phone, each of these codes signs you in once. Keep them somewhere safe, like a password manager. They won't be shown again.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-200 p-4 font-mono text-sm text-slate-900" id="recovery-codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
          <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download
        </button>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#006644]" id="recovery-saved" />
        I've saved these codes.
      </label>
      {!saved && <Notice kind="info">Tick the box once they're saved to continue.</Notice>}
      <PrimaryButton type="button" disabled={!saved} onClick={onContinue} className="w-full" id="recovery-continue">
        Continue
      </PrimaryButton>
    </div>
  );
  return fullscreen ? <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">{body}</div> : body;
};
