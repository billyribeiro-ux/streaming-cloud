<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Laravel\Sanctum\Sanctum;

it('can list workspaces', function (): void {
    $orgData = $this->createOrganizationWithOwner();

    Workspace::factory()->count(3)->create([
        'organization_id' => $orgData['organization']->id,
    ]);

    Sanctum::actingAs($orgData['user']);

    $response = $this->getJson('/api/v1/workspaces');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
        ]);

    expect(count($response->json('data')))->toBe(3);
});

it('can create a workspace', function (): void {
    $orgData = $this->createOrganizationWithOwner();

    // Create an active subscription so the org can create workspaces
    $plan = Plan::factory()->professional()->create();
    Subscription::factory()->create([
        'organization_id' => $orgData['organization']->id,
        'plan_id' => $plan->id,
        'status' => 'active',
    ]);

    Sanctum::actingAs($orgData['user']);

    $response = $this->postJson('/api/v1/workspaces', [
        'name' => 'Trading Workspace',
        'description' => 'A workspace for trading analysis',
    ]);

    $response->assertStatus(201)
        ->assertJson([
            'message' => 'Workspace created successfully',
        ]);

    $this->assertDatabaseHas('workspaces', [
        'name' => 'Trading Workspace',
        'organization_id' => $orgData['organization']->id,
    ]);

    // Verify the creator was added as admin
    $workspace = Workspace::where('name', 'Trading Workspace')->first();

    $this->assertDatabaseHas('workspace_members', [
        'workspace_id' => $workspace->id,
        'user_id' => $orgData['user']->id,
        'role' => WorkspaceMember::ROLE_ADMIN,
    ]);
});

it('can add a member to workspace', function (): void {
    $orgData = $this->createOrganizationWithOwner();

    $workspace = Workspace::factory()->create([
        'organization_id' => $orgData['organization']->id,
    ]);

    WorkspaceMember::factory()->create([
        'workspace_id' => $workspace->id,
        'user_id' => $orgData['user']->id,
        'role' => WorkspaceMember::ROLE_ADMIN,
    ]);

    // Create a new user in the same organization
    $newUser = User::factory()->create();
    OrganizationMember::factory()->create([
        'organization_id' => $orgData['organization']->id,
        'user_id' => $newUser->id,
        'role' => OrganizationMember::ROLE_MEMBER,
        'accepted_at' => now(),
    ]);

    Sanctum::actingAs($orgData['user']);

    $response = $this->postJson("/api/v1/workspaces/{$workspace->id}/members", [
        'user_id' => $newUser->id,
        'role' => 'viewer',
    ]);

    $response->assertStatus(201)
        ->assertJson([
            'message' => 'Member added successfully',
        ]);

    $this->assertDatabaseHas('workspace_members', [
        'workspace_id' => $workspace->id,
        'user_id' => $newUser->id,
        'role' => 'viewer',
    ]);
});

it('can remove a member from workspace', function (): void {
    $orgData = $this->createOrganizationWithOwner();

    $workspace = Workspace::factory()->create([
        'organization_id' => $orgData['organization']->id,
    ]);

    // Add the owner as workspace admin
    WorkspaceMember::factory()->create([
        'workspace_id' => $workspace->id,
        'user_id' => $orgData['user']->id,
        'role' => WorkspaceMember::ROLE_ADMIN,
    ]);

    // Add a member to remove
    $memberUser = User::factory()->create();
    OrganizationMember::factory()->create([
        'organization_id' => $orgData['organization']->id,
        'user_id' => $memberUser->id,
        'role' => OrganizationMember::ROLE_MEMBER,
        'accepted_at' => now(),
    ]);
    WorkspaceMember::factory()->create([
        'workspace_id' => $workspace->id,
        'user_id' => $memberUser->id,
        'role' => WorkspaceMember::ROLE_VIEWER,
    ]);

    Sanctum::actingAs($orgData['user']);

    $response = $this->deleteJson("/api/v1/workspaces/{$workspace->id}/members/{$memberUser->id}");

    $response->assertStatus(204);

    $this->assertDatabaseMissing('workspace_members', [
        'workspace_id' => $workspace->id,
        'user_id' => $memberUser->id,
    ]);
});
