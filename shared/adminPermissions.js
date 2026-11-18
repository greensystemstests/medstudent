// What an admin account can be allowed to do. Shared by the server (which enforces it) and the
// admin screens (which only use it to show or hide buttons: the server is the real gate).
export const PERMISSIONS = {
  "students.view": "See students and their applications",
  "students.manage": "Change application status, review documents, add notes and assign students",
  "monitoring.view": "See site and user-flow errors and the application funnel",
  "content.edit": "Edit the site's text and main images",
};
export const PERMISSION_KEYS = Object.keys(PERMISSIONS);
/** Short names for badges and lists. */
export const PERMISSION_SHORT = {
  "students.view": "View students",
  "students.manage": "Manage students",
  "monitoring.view": "View monitoring",
  "content.edit": "Edit site content",
};

/** The super admin role holds this wildcard. Managing accounts and roles is for super admins only. */
export const SUPER_ROLE_KEY = "super_admin";

/** Roles every project starts with. The super admin role can't be edited or deleted. */
export const BUILT_IN_ROLES = [
  {
    key: SUPER_ROLE_KEY,
    name: "Super admin",
    description: "Everything, including accounts, roles and the audit log.",
    permissions: ["*"],
    studentsScope: "all",
  },
  {
    key: "student_manager",
    name: "Student manager",
    description: "Works with students: sees applications, changes status, reviews documents.",
    permissions: ["students.view", "students.manage"],
    studentsScope: "assigned",
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only view of students and the monitoring pages.",
    permissions: ["students.view", "monitoring.view"],
    studentsScope: "all",
  },
  {
    key: "content_editor",
    name: "Content editor",
    description: "Edits the site's text and images. No access to students.",
    permissions: ["content.edit"],
    studentsScope: "all",
  },
];

export const STUDENT_SCOPES = { all: "All students", assigned: "Only students assigned to them" };

export const validPermissionList = (list) =>
  Array.isArray(list) && list.every((p) => PERMISSION_KEYS.includes(p)) && new Set(list).size === list.length;

/** role = { key, permissions } */
export const roleCan = (role, permission) =>
  Boolean(role) && (role.key === SUPER_ROLE_KEY || (role.permissions || []).includes(permission));
