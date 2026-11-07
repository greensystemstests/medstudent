// Loads a bundled asset (the invoice fonts) next to this module. On a normal Node server that is a file;
// when the code runs as a Supabase Edge Function the module itself is loaded from a pinned GitHub URL,
// so the asset is fetched from the same place. Cached per process.
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";

const cache = new Map();

export function readAsset(relativePath) {
  if (!cache.has(relativePath)) {
    const url = new URL(relativePath, import.meta.url);
    const load =
      url.protocol === "file:"
        ? fs.readFile(url)
        : fetch(url, { signal: AbortSignal.timeout(15000) }).then(async (res) => {
            if (!res.ok) throw new Error(`Asset ${relativePath} could not be loaded (${res.status}).`);
            return Buffer.from(await res.arrayBuffer());
          });
    // Don't cache a failure: the next call tries again.
    cache.set(relativePath, load.catch((error) => { cache.delete(relativePath); throw error; }));
  }
  return cache.get(relativePath);
}
