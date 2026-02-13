<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Room;
use App\Models\User;
use App\Models\Workspace;

/**
 * RoomPolicy - Authorization policy for Room model.
 *
 * Controls access to room viewing, creation, modification, streaming,
 * joining, and moderation based on organization and workspace membership roles.
 */
class RoomPolicy
{
    /**
     * Determine whether the user can view the room.
     *
     * The user must be a member of the room's organization.
     */
    public function view(User $user, Room $room): bool
    {
        return $room->organization->members()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create rooms in the workspace.
     *
     * The user must be an admin or host in the workspace.
     */
    public function create(User $user, Workspace $workspace): bool
    {
        $member = $workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return in_array($member->role, ['admin', 'host']);
    }

    /**
     * Determine whether the user can update the room.
     *
     * The user must be an admin or host in the room's workspace.
     */
    public function update(User $user, Room $room): bool
    {
        $member = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return in_array($member->role, ['admin', 'host']);
    }

    /**
     * Determine whether the user can delete the room.
     *
     * The user must be an admin in the room's workspace.
     */
    public function delete(User $user, Room $room): bool
    {
        $member = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return $member->role === 'admin';
    }

    /**
     * Determine whether the user can start/stop streaming in the room.
     *
     * The user must be a host or co_host in the room's workspace.
     */
    public function stream(User $user, Room $room): bool
    {
        $member = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return in_array($member->role, ['admin', 'host', 'co_host']);
    }

    /**
     * Determine whether the user can join the room.
     *
     * Delegates to the Room model's canJoin business logic which checks
     * organization membership, room status, and viewer capacity limits.
     */
    public function join(User $user, Room $room): bool
    {
        return $room->canJoin($user);
    }

    /**
     * Determine whether the user can moderate participants in the room.
     *
     * The user must be an admin, host, co_host, or moderator in the workspace.
     */
    public function moderate(User $user, Room $room): bool
    {
        $member = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return in_array($member->role, ['admin', 'host', 'co_host', 'moderator']);
    }
}
