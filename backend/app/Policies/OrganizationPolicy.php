<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

/**
 * OrganizationPolicy - Authorization policy for Organization model.
 *
 * Controls access to organization viewing, updating, deletion, and
 * member management based on the user's role within the organization.
 */
class OrganizationPolicy
{
    /**
     * Determine whether the user can view the organization.
     *
     * The user must be a member of the organization.
     */
    public function view(User $user, Organization $organization): bool
    {
        return $organization->members()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can update the organization.
     *
     * The user must be an owner or admin.
     */
    public function update(User $user, Organization $organization): bool
    {
        return $organization->members()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    /**
     * Determine whether the user can delete the organization.
     *
     * Only the owner can delete the organization.
     */
    public function delete(User $user, Organization $organization): bool
    {
        return $organization->members()
            ->where('user_id', $user->id)
            ->where('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can manage members of the organization.
     *
     * The user must be an owner or admin.
     */
    public function manageMember(User $user, Organization $organization): bool
    {
        return $organization->members()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
