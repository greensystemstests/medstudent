import { safe, httpError } from "../workflow.js";
import { PERMISSIONS, SUPER_ROLE_KEY, STUDENT_SCOPES, validPermissionList } from "../../shared/adminPermissions.js";
import { EMAIL_RE, UUID_RE, adminById, dropAdminSessions, logAdmin, normalizeEmail, publicAdmin } from "./store.js";
import { requireAdmin } from "./middleware.js";

const ADMIN_LIST = `
  SELECT a.*, r.key AS role_key, r.name AS role_name, r.permissions AS role_permissions, r.students_scope AS role_scope
  FROM admin_users a JOIN admin_roles r ON r.id = a.role_id ORDER BY lower(a.email)`;

const cleanText = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

const publicRole = (r) => ({
  id: r.id,
  key: r.key,
  name: r.name,
  description: r.description,
  permissions: r.permissions,
  studentsScope: r.students_scope,
  builtIn: r.built_in,
  adminCount: Number(r.admin_count ?? 0),
});

/** Accounts and roles. Super admins only. */
export function mountTeam(router, { db, deliverAdminInvite, log }) {
  const superOnly = requireAdmin(db, { superOnly: true });

  async function otherActiveSupers(excludeId) {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM admin_users a JOIN admin_roles r ON r.id = a.role_id
       WHERE r.key = $1 AND a.status = 'active' AND a.id <> $2`,
      [SUPER_ROLE_KEY, excludeId],
    );
    return rows[0].n;
  }
  const requireAnotherSuper = async (target) => {
    if (target.role_key === SUPER_ROLE_KEY && target.status === "active" && (await otherActiveSupers(target.id)) === 0)
      throw httpError(409, "There must always be at least one active super admin.");
  };
  async function roleOr404(id) {
    if (!UUID_RE.test(String(id))) throw httpError(404, "Role not found.");
    const { rows } = await db.query("SELECT * FROM admin_roles WHERE id = $1", [id]);
    if (!rows[0]) throw httpError(404, "Role not found.");
    return rows[0];
  }
  async function adminOr404(id) {
    if (!UUID_RE.test(String(id))) throw httpError(404, "Account not found.");
    const row = await adminById(db, id);
    if (!row) throw httpError(404, "Account not found.");
    return row;
  }

  router.get(
    "/team",
    superOnly,
    safe(async (_req, res) => {
      const admins = (await db.query(ADMIN_LIST)).rows.map(publicAdmin);
      const roles = (
        await db.query(
          `SELECT r.*, (SELECT count(*) FROM admin_users a WHERE a.role_id = r.id) AS admin_count
           FROM admin_roles r ORDER BY r.built_in DESC, lower(r.name)`,
        )
      ).rows.map(publicRole);
      res.json({ admins, roles, permissions: PERMISSIONS, studentScopes: STUDENT_SCOPES });
    }),
  );

  // ----- accounts -----
  router.post(
    "/team/admins",
    superOnly,
    safe(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const fullName = cleanText(req.body?.fullName, 120);
      if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address.");
      if (fullName.length < 2) throw httpError(400, "Enter the person's name.");
      const role = await roleOr404(req.body?.roleId);
      const exists = await db.query("SELECT 1 FROM admin_users WHERE email = $1", [email]);
      if (exists.rows[0]) throw httpError(409, "There is already an account with this email.");
      const { rows } = await db.query(
        "INSERT INTO admin_users (email, full_name, role_id, created_by) VALUES ($1,$2,$3,$4) RETURNING id",
        [email, fullName, role.id, req.admin.id],
      );
      await logAdmin(db, req.admin, "admin_created", email, { role: role.name }, req);
      let invited = false;
      if (deliverAdminInvite) {
        try {
          await deliverAdminInvite({ email, fullName, roleName: role.name, invitedBy: req.admin.fullName || req.admin.email });
          invited = true;
        } catch (error) {
          log?.(`admin invite email failed: ${error.message}`);
        }
      }
      res.status(201).json({ admin: publicAdmin(await adminById(db, rows[0].id)), invited });
    }),
  );

  router.post(
    "/team/admins/:id",
    superOnly,
    safe(async (req, res) => {
      const target = await adminOr404(req.params.id);
      const self = target.id === req.admin.id;
      const changes = [];
      const values = [target.id];
      const set = (column, value) => {
        values.push(value);
        changes.push(`${column} = $${values.length}`);
      };
      const detail = {};
      if (req.body?.fullName !== undefined) {
        const name = cleanText(req.body.fullName, 120);
        if (name.length < 2) throw httpError(400, "Enter the person's name.");
        set("full_name", name);
        detail.fullName = name;
      }
      if (req.body?.roleId !== undefined && req.body.roleId !== target.role_id) {
        if (self) throw httpError(409, "You can't change your own role.");
        const role = await roleOr404(req.body.roleId);
        if (target.role_key === SUPER_ROLE_KEY && role.key !== SUPER_ROLE_KEY) await requireAnotherSuper(target);
        set("role_id", role.id);
        detail.role = role.name;
      }
      if (req.body?.status !== undefined && req.body.status !== target.status) {
        if (!["active", "disabled"].includes(req.body.status)) throw httpError(400, "Status must be active or disabled.");
        if (self) throw httpError(409, "You can't disable your own account.");
        if (req.body.status === "disabled") await requireAnotherSuper(target);
        set("status", req.body.status);
        detail.status = req.body.status;
      }
      if (!changes.length) return res.json({ admin: publicAdmin(target) });
      await db.query(`UPDATE admin_users SET ${changes.join(", ")} WHERE id = $1`, values);
      // A disabled account, or one whose role changed, signs in again from scratch.
      if (detail.status === "disabled" || detail.role) await dropAdminSessions(db, target.id);
      await logAdmin(db, req.admin, "admin_updated", target.email, detail, req);
      res.json({ admin: publicAdmin(await adminById(db, target.id)) });
    }),
  );

  // Lost phone: clears the authenticator so the person sets it up again at their next sign-in.
  router.post(
    "/team/admins/:id/reset-2fa",
    superOnly,
    safe(async (req, res) => {
      const target = await adminOr404(req.params.id);
      if (target.id === req.admin.id) throw httpError(409, "Use “New recovery codes” for your own account.");
      await db.query(
        `UPDATE admin_users SET totp_iv=NULL, totp_tag=NULL, totp_content=NULL, totp_enrolled_at=NULL,
           totp_last_step=NULL, recovery_hashes='{}' WHERE id=$1`,
        [target.id],
      );
      await dropAdminSessions(db, target.id);
      await logAdmin(db, req.admin, "admin_2fa_reset", target.email, {}, req);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/team/admins/:id",
    superOnly,
    safe(async (req, res) => {
      const target = await adminOr404(req.params.id);
      if (target.id === req.admin.id) throw httpError(409, "You can't delete your own account.");
      await requireAnotherSuper(target);
      await db.query("DELETE FROM admin_users WHERE id = $1", [target.id]);
      await logAdmin(db, req.admin, "admin_deleted", target.email, {}, req);
      res.json({ ok: true });
    }),
  );

  // ----- roles ("rules") -----
  function readRole(body) {
    const name = cleanText(body?.name, 60);
    if (name.length < 2) throw httpError(400, "Give the role a name.");
    if (!validPermissionList(body?.permissions)) throw httpError(400, "Choose permissions from the list.");
    if (!Object.keys(STUDENT_SCOPES).includes(body?.studentsScope)) throw httpError(400, "Choose which students this role can see.");
    return {
      name,
      description: cleanText(body?.description, 200),
      permissions: body.permissions,
      studentsScope: body.studentsScope,
    };
  }

  router.post(
    "/team/roles",
    superOnly,
    safe(async (req, res) => {
      const role = readRole(req.body);
      try {
        const { rows } = await db.query(
          `INSERT INTO admin_roles (name, description, permissions, students_scope) VALUES ($1,$2,$3,$4) RETURNING id`,
          [role.name, role.description, role.permissions, role.studentsScope],
        );
        await logAdmin(db, req.admin, "role_created", role.name, { permissions: role.permissions, scope: role.studentsScope }, req);
        res.status(201).json({ roleId: rows[0].id });
      } catch (error) {
        if (error.code === "23505") throw httpError(409, "A role with this name already exists.");
        throw error;
      }
    }),
  );

  router.post(
    "/team/roles/:id",
    superOnly,
    safe(async (req, res) => {
      const existing = await roleOr404(req.params.id);
      if (existing.key === SUPER_ROLE_KEY) throw httpError(409, "The super admin role can't be changed.");
      const role = readRole(req.body);
      try {
        await db.query(
          `UPDATE admin_roles SET name=$2, description=$3, permissions=$4, students_scope=$5, updated_at=now() WHERE id=$1`,
          [existing.id, role.name, role.description, role.permissions, role.studentsScope],
        );
      } catch (error) {
        if (error.code === "23505") throw httpError(409, "A role with this name already exists.");
        throw error;
      }
      // People in this role pick up the new rules on their next request; nobody needs to sign in again.
      await logAdmin(db, req.admin, "role_updated", role.name, { permissions: role.permissions, scope: role.studentsScope }, req);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/team/roles/:id",
    superOnly,
    safe(async (req, res) => {
      const existing = await roleOr404(req.params.id);
      if (existing.built_in) throw httpError(409, "Built-in roles can be edited but not deleted.");
      const used = await db.query("SELECT count(*)::int AS n FROM admin_users WHERE role_id = $1", [existing.id]);
      if (used.rows[0].n) throw httpError(409, "Move the people in this role to another role first.");
      await db.query("DELETE FROM admin_roles WHERE id = $1", [existing.id]);
      await logAdmin(db, req.admin, "role_deleted", existing.name, {}, req);
      res.json({ ok: true });
    }),
  );

  // ----- audit log -----
  router.get(
    "/audit",
    superOnly,
    safe(async (req, res) => {
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
      const before = Number(req.query.before) || null;
      const { rows } = await db.query(
        `SELECT id, admin_email, action, subject, detail, ip, created_at FROM admin_audit
         WHERE ($1::bigint IS NULL OR id < $1) ORDER BY id DESC LIMIT $2`,
        [before, limit],
      );
      res.json({ entries: rows, next: rows.length === limit ? rows[rows.length - 1].id : null });
    }),
  );
}
