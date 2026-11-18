import React, { createContext, useContext, useEffect, useState } from "react";
import { CONTENT_BY_KEY } from "../../shared/siteContent.js";
import { API_BASE } from "./apiBase";

interface Edited {
  text: Record<string, string>;
  images: Record<string, string>;
}

const EMPTY: Edited = { text: {}, images: {} };
const Ctx = createContext<Edited>(EMPTY);

/**
 * Loads the text and pictures an admin has changed, once, when the site opens. Until that arrives (or if
 * it never does) the site simply shows the originals written in the code, so a slow or failed request
 * can never leave a blank page. Nothing is stored on the visitor's device.
 */
export const SiteContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [edited, setEdited] = useState<Edited>(EMPTY);
  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/api/content`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((d: Partial<Edited>) => {
        if (live && d && typeof d === "object") setEdited({ text: d.text ?? {}, images: d.images ?? {} });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return <Ctx.Provider value={edited}>{children}</Ctx.Provider>;
};

/** The text for one editable spot: the admin's version if there is one, otherwise the original. */
export function useText(key: string): string {
  const edited = useContext(Ctx);
  const def = CONTENT_BY_KEY[key];
  const value = edited.text[key];
  return typeof value === "string" && value ? value : (def?.default ?? "");
}

/** The picture for one editable spot: the admin's upload if there is one, otherwise `original`. */
export function useImage(key: string, original: string): string {
  const edited = useContext(Ctx);
  const path = edited.images[key];
  return typeof path === "string" && path.startsWith("/api/content/images/") ? `${API_BASE}${path}` : original;
}
