import { useOrganization, useUser } from "@clerk/react";
import { canChangeStatus, canManageProject, isAdminRole } from "../lib/permissions";

// Binds the pure rules in lib/permissions to whoever is signed in
export function usePermissions() {
    const { membership } = useOrganization();
    const { user } = useUser();
    const viewer = { userId: user?.id, isAdmin: isAdminRole(membership?.role) };

    return {
        isAdmin: viewer.isAdmin,
        canManageProject: (project) => canManageProject(viewer, project),
        canChangeStatus: (task, project) => canChangeStatus(viewer, task, project),
    };
}
