import { safe, httpError } from "../workflow.js";
import { adminCan, isSuper, sessionForToken } from "./store.js";

const bearer = (req) => {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

/**
 * Requires a signed-in admin at the given stage ("full" by default). Optionally also a permission,
 * or super admin. 401 means "sign in again"; 403 means "signed in, but not allowed".
 */
export const requireAdmin = (db, { stage = "full", permission = null, superOnly = false } = {}) =>
  safe(async (req, res, next) => {
    const found = await sessionForToken(db, bearer(req));
    if (!found) throw httpError(401, "Please sign in to the admin area.");
    if (found.session.stage !== stage)
      throw httpError(401, "Finish signing in first.");
    if (superOnly && !isSuper(found.admin)) throw httpError(403, "Only a super admin can do this.");
    if (permission && !adminCan(found.admin, permission)) throw httpError(403, "Your role doesn't include this.");
    req.admin = found.admin;
    req.adminSession = found.session;
    res.set("Cache-Control", "no-store");
    next();
  });

/** For endpoints that accept any live session, whatever stage it is at. */
export const anyAdminSession = (db) =>
  safe(async (req, res, next) => {
    const found = await sessionForToken(db, bearer(req));
    if (!found) throw httpError(401, "Please sign in to the admin area.");
    req.admin = found.admin;
    req.adminSession = found.session;
    req.adminToken = bearer(req);
    next();
  });
export const bearerToken = bearer;
