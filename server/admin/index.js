import express from "express";
import { safe, httpError } from "../workflow.js";
import { mountAdminAuth } from "./auth.js";
import { mountTeam } from "./team.js";
import { mountStudents } from "./students.js";
import { mountMonitoring } from "./monitoring.js";

/**
 * The admin API, under /api/admin. Everything needs a signed-in admin (two-step sign-in), and each
 * area checks its own permission on the server; hiding a button in the page is only a convenience.
 */
export function mountAdmin(app, deps) {
  const { db, fileKey } = deps;
  const router = express.Router();
  router.use(
    safe(async (_req, _res, next) => {
      if (!db || !fileKey) throw httpError(503, "The admin area isn't set up yet.");
      next();
    }),
  );
  mountAdminAuth(router, deps);
  mountTeam(router, deps);
  mountStudents(router, deps);
  mountMonitoring(router, deps);
  app.use("/api/admin", router);
}
