import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import {
  TRANSLATION_DOC_TYPES,
  TRANSLATION_LANGUAGES,
  translationDocList,
} from "../../shared/admissions.js";
import {
  formatBytes,
  liveAccountApi,
  type StoredDocument,
} from "../lib/account";
import { SignIn } from "./AccountView";
import type { WizardFormData } from "../types";

const choice = (selected: boolean) =>
  `rounded-xl border text-left transition-all ${
    selected
      ? "border-[#006644] bg-emerald-50/70 text-[#006644] ring-1 ring-[#006644]"
      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
  }`;

const MAX_TRANSLATION_FILES = 10;

/**
 * Step 6. Optional: the default is "I don't need translation help" and Continue works straight away.
 * If they do need help they say which documents, into which language, and upload the files so our
 * team can see exactly what has to be done.
 */
export const TranslationStep: React.FC<{
  form: WizardFormData;
  update: (patch: Partial<WizardFormData>) => void;
  demoMode: boolean;
}> = ({ form, update, demoMode }) => {
  const needed = form.swornTranslationRequested;
  const chosen = translationDocList(form.translationDocs);

  const toggleDoc = (key: string) => {
    const next = chosen.includes(key)
      ? chosen.filter((k) => k !== key)
      : [...chosen, key];
    update({ translationDocs: next.join(",") });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold font-heading text-slate-900">
          Step 6: Translation help (optional)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Universities usually want sworn (certified) translations of foreign documents. If you
          already have them, or want to arrange them yourself, skip this step.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Do you need translation help?"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!needed}
          id="translation-skip"
          onClick={() => update({ swornTranslationRequested: false })}
          className={`p-4 ${choice(!needed)}`}
        >
          <div className="font-bold text-xs mb-1">I don’t need translation help</div>
          <div className="text-[0.6875rem] text-slate-500">
            Skip this step. You can still ask on your call.
          </div>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={needed}
          id="translation-needed"
          onClick={() => update({ swornTranslationRequested: true })}
          className={`p-4 ${choice(needed)}`}
        >
          <div className="font-bold text-xs mb-1">I need translation help</div>
          <div className="text-[0.6875rem] text-slate-500">
            Tell us what needs translating and upload the files.
          </div>
        </button>
      </div>

      {needed && (
        <div className="space-y-6" id="translation-details">
          <fieldset>
            <legend className="text-xs font-bold text-slate-800 mb-2">
              Which documents need translating? <span className="font-normal text-slate-500">(choose all that apply)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(TRANSLATION_DOC_TYPES).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(key)}
                    onChange={() => toggleDoc(key)}
                    className="w-4 h-4 accent-[#006644]"
                  />
                  <span className="text-xs font-semibold text-slate-800">{label as string}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-slate-800 mb-2">
              Translate into <span className="font-normal text-slate-500">(optional)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(TRANSLATION_LANGUAGES).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={form.translationLanguage === key}
                  onClick={() =>
                    update({
                      translationLanguage: form.translationLanguage === key ? "" : key,
                    })
                  }
                  className={`p-3 text-xs font-semibold ${choice(form.translationLanguage === key)}`}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="translation-note" className="block text-xs font-bold text-slate-800 mb-1.5">
              Anything we should know? <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="translation-note"
              value={form.translationNote}
              maxLength={1000}
              rows={3}
              onChange={(e) => update({ translationNote: e.target.value })}
              placeholder="For example: the language the documents are in, deadlines, or pages that matter most."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#006644]/30"
            />
          </div>

          <TranslationUploads demoMode={demoMode} email={form.email} />
        </div>
      )}
    </div>
  );
};

const TranslationUploads: React.FC<{ demoMode: boolean; email: string }> = ({
  demoMode,
  email,
}) => {
  const [signed, setSigned] = useState(liveAccountApi.isSignedIn());
  const [showSignIn, setShowSignIn] = useState(false);
  const [files, setFiles] = useState<StoredDocument[]>([]);
  const [limit, setLimit] = useState(10 * 1024 * 1024);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await liveAccountApi.getDocuments();
      setLimit(res.limits.maxFileBytes);
      setFiles(res.documents.filter((d) => d.category === "translation"));
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    if (signed && !demoMode) void refresh();
  }, [signed, demoMode, refresh]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setMessage(null);
    setBusy(true);
    let done = 0;
    try {
      for (const file of Array.from(list)) {
        if (files.length + done >= MAX_TRANSLATION_FILES) {
          setMessage({ ok: false, text: `You can add up to ${MAX_TRANSLATION_FILES} files here.` });
          break;
        }
        if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
          setMessage({ ok: false, text: `${file.name}: only PDF, JPG and PNG files are accepted.` });
          continue;
        }
        if (file.size > limit) {
          setMessage({ ok: false, text: `${file.name} is ${formatBytes(file.size)}. Files can be up to ${formatBytes(limit)}.` });
          continue;
        }
        await liveAccountApi.uploadDocument(file, "translation", () => {});
        done += 1;
      }
      if (done) setMessage({ ok: true, text: `${done} file${done === 1 ? "" : "s"} uploaded. Our team can see them.` });
      await refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "The upload failed. Please try again." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  if (demoMode) return null;

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3" id="translation-uploads">
      <div>
        <div className="text-xs font-bold text-slate-800">Upload the files to translate</div>
        <p className="text-[0.6875rem] text-slate-500 mt-0.5">
          PDF, JPG or PNG. Stored encrypted in your account, and only you and our team can open them.
        </p>
      </div>

      {!signed ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-700">
            To upload files, sign in with your email first. You can also do this later from{" "}
            <strong>My Account → Documents</strong> (“Document for translation”).
          </p>
          <button
            type="button"
            onClick={() => setShowSignIn((v) => !v)}
            className="rounded-lg bg-[#006644] text-white px-4 py-2 text-xs font-bold min-h-11"
          >
            Sign in to upload files
          </button>
          {showSignIn && (
            <SignIn
              embedded
              api={liveAccountApi}
              defaultEmail={email}
              onSignedIn={() => {
                setSigned(true);
                setShowSignIn(false);
              }}
            />
          )}
        </div>
      ) : (
        <>
          <input
            ref={input}
            id="translation-file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => void upload(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            id="translation-upload-btn"
            className="inline-flex items-center gap-2 rounded-lg bg-[#006644] text-white px-4 py-2 text-xs font-bold min-h-11 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            {busy ? "Uploading…" : "Choose files"}
          </button>
          {files.length > 0 && (
            <ul className="space-y-1.5" aria-label="Files uploaded for translation">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs text-slate-700">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{f.filename}</span>
                  <span className="text-slate-400 shrink-0">{formatBytes(f.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-xs ${message.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};
