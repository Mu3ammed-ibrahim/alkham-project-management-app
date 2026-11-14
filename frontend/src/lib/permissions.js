// Mirrors the backend's rules so the UI only offers actions the API will accept.
// Plain functions (no Clerk, no React) so the same role matrix the backend tests can run here too.
// UX only: the server still checks every request, so hiding a button is never the security boundary.

// Same role string the API reads from the Clerk token (orgRole)
export const isAdminRole = (role) => role === "org:admin";

// Edit settings, add members, create and delete tasks
export const canManageProject = ({ userId, isAdmin }, project) =>
    isAdmin || (Boolean(userId) && project?.team_lead === userId);

// Status changes are also open to whoever the task is assigned to
export const canChangeStatus = (viewer, task, project) =>
    canManageProject(viewer, project) || (Boolean(viewer.userId) && task?.assigneeId === viewer.userId);
