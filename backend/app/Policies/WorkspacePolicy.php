<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;

/**
 * WorkspacePolicy - Authorization policy for Workspace model.
 *
 * Controls access to workspace viewing, creation, updating, deletion,
 * and member management based on workspace and organization roles.
 */
class WorkspacePolicy
{
    /**
     * Determine whether the user can view the workspace.
     *
     * The user must be a member of the workspace or an org admin/owner.
     */
    public function view(User $user, Workspace $workspace): bool
    {
        // Direct workspace membership
        $isWorkspaceMember = $workspace->members()
            ->where('user_id', $user->id)
            ->exists();

        if ($isWorkspaceMember) {
            return true;
        }

        // Organization admin/owner can view any workspace
        return $workspace->organization->members()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    /**
     * Determine whether the user can create a workspace in the organization.
     *
     * Checks if the organization's subscription plan allows additional workspaces.
     */
    public function create(User $user, Organization $organization): bool
    {
        return $organization->canCreateWorkspace();
    }

    /**
     * Determine whether the user can update the workspace.
     *
     * The user must be an admin in the workspace.
     */
    public function update(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', 'admin')
            ->exists();
    }

    /**
     * Determine whether the user can delete the workspace.
     *
     * The user must be an admin/owner at the organization level.
     */
    public function delete(User $user, Workspace $workspace): bool
    {
        return $workspace->organization->members()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    /**
     * Determine whether the user can manage members of the workspace.
     *
     * The user must be an admin in the workspace.
     */
    public function manageMember(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', 'admin')
            ->exists();
    }
}
