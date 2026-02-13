<?php

declare(strict_types=1);

namespace Tests;

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Room;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * Create an authenticated user with a Sanctum token.
     *
     * @return array{user: User, token: string}
     */
    protected function createUser(array $attributes = []): array
    {
        $user = User::factory()->create($attributes);
        $token = $user->createToken('test-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Create an organization with an owner user and membership.
     *
     * @return array{organization: Organization, user: User, token: string, membership: OrganizationMember}
     */
    protected function createOrganizationWithOwner(array $orgAttributes = [], array $userAttributes = []): array
    {
        $user = User::factory()->create($userAttributes);
        $token = $user->createToken('test-token')->plainTextToken;

        $organization = Organization::factory()->create($orgAttributes);

        $membership = OrganizationMember::factory()->create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => OrganizationMember::ROLE_OWNER,
            'accepted_at' => now(),
        ]);

        return [
            'organization' => $organization,
            'user' => $user,
            'token' => $token,
            'membership' => $membership,
        ];
    }

    /**
     * Create a room with its organization, workspace, and owner user.
     *
     * @return array{room: Room, workspace: Workspace, organization: Organization, user: User, token: string}
     */
    protected function createRoom(array $roomAttributes = [], array $orgAttributes = [], array $userAttributes = []): array
    {
        $orgData = $this->createOrganizationWithOwner($orgAttributes, $userAttributes);

        $workspace = Workspace::factory()->create([
            'organization_id' => $orgData['organization']->id,
        ]);

        WorkspaceMember::factory()->create([
            'workspace_id' => $workspace->id,
            'user_id' => $orgData['user']->id,
            'role' => WorkspaceMember::ROLE_ADMIN,
        ]);

        $room = Room::factory()->create(array_merge([
            'workspace_id' => $workspace->id,
            'organization_id' => $orgData['organization']->id,
            'created_by' => $orgData['user']->id,
        ], $roomAttributes));

        return [
            'room' => $room,
            'workspace' => $workspace,
            'organization' => $orgData['organization'],
            'user' => $orgData['user'],
            'token' => $orgData['token'],
        ];
    }
}
