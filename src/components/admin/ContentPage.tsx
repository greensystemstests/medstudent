import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, ImageUp, RotateCcw } from "lucide-react";
import { ContentData, ContentItem, adminApi } from "../../lib/adminApi";
import { API_BASE } from "../../lib/apiBase";
import { APP_IMAGES, UNIVERSITIES } from "../../data/constants";
import type { PageContext } from "./AdminShell";
import { Badge, Card, GhostButton, Notice, PrimaryButton, formatDate, inputClass } from "./ui";

/** The pictures the site shows until an admin uploads another one. */
const ORIGINAL_IMAGES: Record<string, string> = {
  "home.hero.image": APP_IMAGES.muSofia,
  ...Object.fromEntries(UNIVERSITIES.map((u) => [`uni.${u.id}.image`, u.image])),
};

const MAX_WIDTH = 1600;

/**
 * Shrinks a chosen picture before it is sent: at most 1600 px wide, re-encoded as WebP (or JPEG), which also
 * drops any hidden camera data such as the place a photo was taken. Only the result leaves the browser.
 */
async function prepareImage(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Please choose a PNG, JPEG or WebP picture.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That picture couldn't be read. Try another file.");
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser can't prepare pictures. Try another browser.");
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  let out = await toBlob("image/webp", 0.85);
  if (!out || out.type !== "image/webp") out = await toBlob("image/jpeg", 0.85);
  if (!out) throw new Error("That picture couldn't be prepared. Try another file.");
  if (out.size > 3 * 1024 * 1024) throw new Error("That picture is still too large after shrinking. Try a simpler one.");
  return out;
}

const TextRow: React.FC<{ item: ContentItem; onSave: (v: string) => Promise<void>; onReset: () => Promise<void> }> = ({ item, onSave, onReset }) => {
  const current = item.value ?? item.original ?? "";
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(current), [current]);
  const dirty = draft !== current;
  const id = `content-${item.key}`;
  return (
    <div className="py-4 first:pt-0 last:pb-0 border-t first:border-t-0 border-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-slate-900">
          {item.label}
        </label>
        {item.changed && <Badge tone="amber">Edited</Badge>}
      </div>
      {item.multiline ? (
        <textarea id={id} rows={3} maxLength={item.max ?? undefined} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} mt-1.5`} />
      ) : (
        <input id={id} type="text" maxLength={item.max ?? undefined} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} mt-1.5`} />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PrimaryButton
          type="button"
          busy={busy}
          disabled={!dirty}
          className="!min-h-9 !px-4 !text-xs"
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(draft);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </PrimaryButton>
        {dirty && (
          <GhostButton type="button" onClick={() => setDraft(current)}>
            Discard
          </GhostButton>
        )}
        {item.changed && !dirty && (
          <GhostButton type="button" onClick={() => void onReset()}>
            <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset to original
          </GhostButton>
        )}
        <span className="text-[0.6875rem] text-slate-500 ml-auto">
          {draft.length}/{item.max}
        </span>
      </div>
      {item.changed && (
        <p className="mt-2 text-[0.6875rem] text-slate-500">
          Original: <span className="text-slate-600">{item.original}</span> · changed by {item.updatedBy} on {formatDate(item.updatedAt)}
        </p>
      )}
    </div>
  );
};

const ImageRow: React.FC<{ item: ContentItem; onPick: (f: File) => Promise<void>; onReset: () => Promise<void> }> = ({ item, onPick, onReset }) => {
  const [busy, setBusy] = useState(false);
  const shown = item.imageUrl ? `${API_BASE}${item.imageUrl}` : ORIGINAL_IMAGES[item.key];
  const id = `content-${item.key}`;
  return (
    <div className="py-4 first:pt-0 last:pb-0 border-t first:border-t-0 border-slate-100 sm:flex gap-4">
      <div className="sm:w-56 shrink-0 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
        {shown && <img src={shown} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
      </div>
      <div className="mt-3 sm:mt-0 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{item.label}</span>
          {item.changed && <Badge tone="amber">Edited</Badge>}
        </div>
        {item.hint && <p className="text-xs text-slate-500 mt-0.5">{item.hint}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            className={`inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#006644] hover:bg-[#005538] cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}
          >
            <ImageUp className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? "Uploading…" : "Choose a new picture"}
          </label>
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                await onPick(file);
              } finally {
                setBusy(false);
              }
            }}
          />
          {item.changed && (
            <GhostButton type="button" onClick={() => void onReset()}>
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset to original
            </GhostButton>
          )}
        </div>
        {item.changed && (
          <p className="mt-2 text-[0.6875rem] text-slate-500">
            Changed by {item.updatedBy} on {formatDate(item.updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
};

/** Edit the site's main text and pictures. Everything else (prices, legal pages, FAQ answers) changes through a reviewed code change. */
export const ContentPage: React.FC<{ ctx: PageContext }> = ({ ctx }) => {
  const [data, setData] = useState<ContentData | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.content());
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "ok", text: success });
      await load();
    } catch (err) {
      const text = ctx.fail(err);
      if (text) setMessage({ kind: "error", text });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold font-heading">Site content</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Change the main text and pictures on the home page. Changes go live within about a minute. “Reset to original” brings back what the site was
            built with.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006644] underline underline-offset-2 min-h-9"
        >
          Open the site <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {!data && !message && <p className="text-sm text-slate-500" role="status">Loading…</p>}
      {data?.groups.map((g) => {
        const items = data.items.filter((i) => i.group === g.id);
        if (!items.length) return null;
        return (
          <Card key={g.id} title={g.label}>
            {items.map((item) =>
              item.type === "text" ? (
                <TextRow
                  key={item.key}
                  item={item}
                  onSave={(v) => run(() => adminApi.saveText(item.key, v), `Saved “${item.label}”.`)}
                  onReset={() => run(() => adminApi.resetContent(item.key), `“${item.label}” is back to the original.`)}
                />
              ) : (
                <ImageRow
                  key={item.key}
                  item={item}
                  onPick={(file) =>
                    run(async () => adminApi.uploadImage(item.key, await prepareImage(file)), `Saved “${item.label}”.`)
                  }
                  onReset={() => run(() => adminApi.resetContent(item.key), `“${item.label}” is back to the original.`)}
                />
              ),
            )}
          </Card>
        );
      })}
    </div>
  );
};
