<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateWorkspaceRequest;
use App\Http\Resources\UserResource;
use App\Http\Resources\WorkspaceResource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Workspace Controller - API endpoints for workspace management
 *
 * @group Workspaces
 *
 * Endpoints for creating, managing, and organizing workspaces within an organization.
 */
class WorkspaceController extends Controller
{
    /**
     * List workspaces
     *
     * Get a list of workspaces for the user's organization.
     *
     * @response 200 scenario="Success" {
     *   "data": [...]
     * }
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if (!$organization) {
            return response()->json([
                'data' => [],
                'message' => 'No organization found',
            ]);
        }

        $workspaces = Workspace::where('organization_id', $organization->id)
            ->withCount(['rooms', 'members'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'data' => WorkspaceResource::collection($workspaces),
        ]);
    }

    /**
     * Create a workspace
     *
     * Create a new workspace within the user's organization.
     * Checks organization plan limits before creation.
     *
     * @bodyParam name string required The workspace name. Max: 255 characters.
     * @bodyParam description string The workspace description. Max: 1000 characters.
     *
     * @response 201 scenario="Created" {
     *   "data": {...},
     *   "message": "Workspace created successfully"
     * }
     * @response 403 scenario="Limit Reached" {
     *   "message": "Workspace limit reached for your plan"
     * }
     */
    public function store(CreateWorkspaceRequest $request): JsonResponse
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if (!$organization) {
            return response()->json([
                'message' => 'No organization found',
            ], Response::HTTP_FORBIDDEN);
        }

        if (!$organization->canCreateWorkspace()) {
            return response()->json([
                'message' => 'Workspace limit reached for your plan',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validated();

        $workspace = Workspace::create([
            'organization_id' => $organization->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        // Add the creator as admin of the workspace
        WorkspaceMember::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'role' => WorkspaceMember::ROLE_ADMIN,
        ]);

        $workspace->loadCount(['rooms', 'members']);

        return response()->json([
            'data' => new WorkspaceResource($workspace),
            'message' => 'Workspace created successfully',
        ], Response::HTTP_CREATED);
    }

    /**
     * Show workspace
     *
     * Get detailed information about a specific workspace with its members.
     *
     * @response 200 scenario="Success" {
     *   "data": {...}
     * }
     */
    public function show(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        if (!$this->userBelongsToOrganization($user, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $workspace->loadCount(['rooms', 'members']);
        $workspace->load('members.user');

        return response()->json([
            'data' => new WorkspaceResource($workspace),
        ]);
    }

    /**
     * Update workspace
     *
     * Update workspace details.
     *
     * @bodyParam name string The workspace name.
     * @bodyParam description string The workspace description.
     *
     * @response 200 scenario="Updated" {
     *   "data": {...},
     *   "message": "Workspace updated successfully"
     * }
     */
    public function update(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        if (!$this->userBelongsToOrganization($user, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'settings' => ['sometimes', 'nullable', 'array'],
        ]);

        $workspace->update($validated);
        $workspace->loadCount(['rooms', 'members']);

        return response()->json([
            'data' => new WorkspaceResource($workspace),
            'message' => 'Workspace updated successfully',
        ]);
    }

    /**
     * Delete workspace
     *
     * Permanently delete a workspace and its associations.
     *
     * @response 204 scenario="Deleted"
     */
    public function destroy(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        if (!$this->userBelongsToOrganization($user, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $workspace->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * List workspace members
     *
     * Get all members of a workspace.
     *
     * @response 200 scenario="Success" {
     *   "data": [...]
     * }
     */
    public function members(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        if (!$this->userBelongsToOrganization($user, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $members = $workspace->members()->with('user')->get();

        $membersData = $members->map(function (WorkspaceMember $member) {
            return [
                'id' => $member->id,
                'user' => new UserResource($member->user),
                'role' => $member->role,
                'created_at' => $member->created_at,
            ];
        });

        return response()->json([
            'data' => $membersData,
        ]);
    }

    /**
     * Add member to workspace
     *
     * Add a user to a workspace with a specified role.
     *
     * @bodyParam user_id string required The user ID to add.
     * @bodyParam role string required The member's role (admin, host, co_host, moderator, viewer).
     *
     * @response 201 scenario="Added" {
     *   "data": {...},
     *   "message": "Member added successfully"
     * }
     */
    public function addMember(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        if (!$this->userBelongsToOrganization($user, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'role' => ['required', 'string', 'in:admin,host,co_host,moderator,viewer'],
        ]);

        $existingMember = WorkspaceMember::where('workspace_id', $workspace->id)
            ->where('user_id', $validated['user_id'])
            ->first();

        if ($existingMember) {
            return response()->json([
                'message' => 'User is already a member of this workspace',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $member = WorkspaceMember::create([
            'workspace_id' => $workspace->id,
            'user_id' => $validated['user_id'],
            'role' => $validated['role'],
        ]);

        $member->load('user');

        return response()->json([
            'data' => [
                'id' => $member->id,
                'user' => new UserResource($member->user),
                'role' => $member->role,
                'created_at' => $member->created_at,
            ],
            'message' => 'Member added successfully',
        ], Response::HTTP_CREATED);
    }

    /**
     * Remove member from workspace
     *
     * Remove a user from a workspace.
     *
     * @response 204 scenario="Removed"
     */
    public function removeMember(Request $request, Workspace $workspace, User $user): JsonResponse
    {
        $currentUser = $request->user();

        if (!$this->userBelongsToOrganization($currentUser, $workspace->organization_id)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $member = WorkspaceMember::where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return response()->json([
                'message' => 'User is not a member of this workspace',
            ], Response::HTTP_NOT_FOUND);
        }

        $member->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Check if a user belongs to the organization.
     */
    private function userBelongsToOrganization(User $user, string $organizationId): bool
    {
        return $user->organizations()
            ->where('organizations.id', $organizationId)
            ->exists();
    }
}
