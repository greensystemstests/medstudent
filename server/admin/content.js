import express from "express";
import { safe, httpError } from "../workflow.js";
import { transaction } from "../db.js";
import { CONTENT_BY_KEY, CONTENT_GROUPS, SITE_CONTENT, cleanContentText } from "../../shared/siteContent.js";
import { requireAdmin } from "./middleware.js";
import { UUID_RE, logAdmin } from "./store.js";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** What the file really is, from its first bytes. Only PNG, JPEG and WebP are accepted (never SVG: it can carry scripts). */
export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const imagePath = (id) => `/api/content/images/${id}`;
const preview = (v) => String(v).slice(0, 200);

/** The public side: the site asks for its edited text and images once when it opens. */
export function mountPublicContent(app, { db }) {
  app.get(
    "/api/content",
    safe(async (_req, res) => {
      const out = { text: {}, images: {} };
      if (db) {
        const { rows } = await db.query("SELECT key, value FROM site_content");
        for (const r of rows) {
          const def = CONTENT_BY_KEY[r.key];
          if (!def) continue; // a key that was removed from the code is ignored
          if (def.type === "image") out.images[r.key] = imagePath(r.value);
          else out.text[r.key] = r.value;
        }
      }
      // Short cache: an edit shows up within about a minute, and a busy day doesn't hammer the database.
      res.set("Cache-Control", "public, max-age=30");
      res.json(out);
    }),
  );

  app.get(
    "/api/content/images/:id",
    safe(async (req, res) => {
      if (!db || !UUID_RE.test(req.params.id)) throw httpError(404, "Not found.");
      const { rows } = await db.query("SELECT content_type, data FROM site_images WHERE id = $1", [req.params.id]);
      if (!rows[0]) throw httpError(404, "Not found.");
      // The address contains the image's own id, so a replaced image gets a new address and this can be cached for good.
      res.set({
        "Content-Type": rows[0].content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Content-Security-Policy": "default-src 'none'",
      });
      res.send(rows[0].data);
    }),
  );
}

/** The admin side: see every editable item with its original, change it, or put the original back. */
export function mountContent(router, { db }) {
  const edit = requireAdmin(db, { permission: "content.edit" });

  router.get(
    "/content",
    edit,
    safe(async (_req, res) => {
      const { rows } = await db.query("SELECT key, value, updated_by, updated_at FROM site_content");
      const saved = new Map(rows.map((r) => [r.key, r]));
      res.json({
        groups: CONTENT_GROUPS,
        items: SITE_CONTENT.map((c) => {
          const row = saved.get(c.key);
          return {
            key: c.key,
            group: c.group,
            label: c.label,
            type: c.type,
            hint: c.hint ?? null,
            multiline: Boolean(c.multiline),
            max: c.max ?? null,
            original: c.type === "text" ? c.default : null,
            value: row && c.type === "text" ? row.value : null,
            imageUrl: row && c.type === "image" ? imagePath(row.value) : null,
            changed: Boolean(row),
            updatedBy: row?.updated_by ?? null,
            updatedAt: row?.updated_at ?? null,
          };
        }),
      });
    }),
  );

  router.post(
    "/content/:key",
    edit,
    safe(async (req, res) => {
      const def = CONTENT_BY_KEY[req.params.key];
      if (!def || def.type !== "text") throw httpError(404, "That item doesn't exist.");
      const clean = cleanContentText(def, req.body?.value);
      if (clean.error) throw httpError(400, clean.error);
      const before = (await db.query("SELECT value FROM site_content WHERE key = $1", [def.key])).rows[0]?.value ?? def.default;
      if (clean.value === before) return res.json({ ok: true, unchanged: true });
      await db.query(
        `INSERT INTO site_content (key, value, updated_by) VALUES ($1,$2,$3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [def.key, clean.value, req.admin.email],
      );
      await logAdmin(db, req.admin, "content_text", def.key, { from: preview(before), to: preview(clean.value) }, req);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/content/:key/reset",
    edit,
    safe(async (req, res) => {
      const def = CONTENT_BY_KEY[req.params.key];
      if (!def) throw httpError(404, "That item doesn't exist.");
      await transaction(db, async (tx) => {
        const old = (await tx.query("DELETE FROM site_content WHERE key = $1 RETURNING value", [def.key])).rows[0];
        if (old && def.type === "image") await tx.query("DELETE FROM site_images WHERE id = $1", [old.value]);
      });
      await logAdmin(db, req.admin, "content_reset", def.key, {}, req);
      res.json({ ok: true });
    }),
  );

  // The picture itself is sent as the request body (not as a form), already shrunk by the dashboard.
  router.post(
    "/content/:key/image",
    edit,
    express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
    safe(async (req, res) => {
      const def = CONTENT_BY_KEY[req.params.key];
      if (!def || def.type !== "image") throw httpError(404, "That item doesn't exist.");
      const type = sniffImage(req.body);
      if (!type) throw httpError(400, "Please choose a PNG, JPEG or WebP picture.");
      if (req.body.length > MAX_IMAGE_BYTES) throw httpError(413, "That picture is too large (3 MB at most).");
      const id = await transaction(db, async (tx) => {
        const created = (await tx.query("INSERT INTO site_images (content_type, data) VALUES ($1,$2) RETURNING id", [type, req.body])).rows[0].id;
        const old = (await tx.query("SELECT value FROM site_content WHERE key = $1", [def.key])).rows[0];
        await tx.query(
          `INSERT INTO site_content (key, value, updated_by) VALUES ($1,$2,$3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [def.key, created, req.admin.email],
        );
        if (old) await tx.query("DELETE FROM site_images WHERE id = $1", [old.value]);
        return created;
      });
      await logAdmin(db, req.admin, "content_image", def.key, { type, bytes: req.body.length }, req);
      res.json({ ok: true, imageUrl: imagePath(id) });
    }),
  );
}
