<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Plan;
use App\Models\Room;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\AuditService;
use App\Services\RoomService;
use App\Services\SignalingService;
use App\Services\SubscriptionService;
use Laravel\Sanctum\Sanctum;

it('can list rooms for organization', function (): void {
    $data = $this->createRoom();

    // Create additional rooms in the same org/workspace
    Room::factory()->count(2)->create([
        'workspace_id' => $data['workspace']->id,
        'organization_id' => $data['organization']->id,
        'created_by' => $data['user']->id,
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->getJson('/api/v1/rooms');

    $response->assertStatus(200);
});

it('can create a room', function (): void {
    $orgData = $this->createOrganizationWithOwner();

    $plan = Plan::factory()->professional()->create();
    Subscription::factory()->create([
        'organization_id' => $orgData['organization']->id,
        'plan_id' => $plan->id,
        'status' => 'active',
    ]);

    $workspace = Workspace::factory()->create([
        'organization_id' => $orgData['organization']->id,
    ]);

    WorkspaceMember::factory()->create([
        'workspace_id' => $workspace->id,
        'user_id' => $orgData['user']->id,
        'role' => WorkspaceMember::ROLE_ADMIN,
    ]);

    Sanctum::actingAs($orgData['user']);

    $this->mock(SubscriptionService::class, function ($mock) {
        $mock->shouldReceive('canCreateRoom')->andReturn(true);
    });

    $this->mock(AuditService::class, function ($mock) {
        $mock->shouldReceive('log')->andReturnNull();
    });

    $response = $this->postJson('/api/v1/rooms', [
        'workspace_id' => $workspace->id,
        'name' => 'Morning Trading Session',
        'description' => 'Daily morning trading analysis',
    ]);

    $response->assertStatus(201);

    $this->assertDatabaseHas('rooms', [
        'name' => 'Morning Trading Session',
        'workspace_id' => $workspace->id,
        'organization_id' => $orgData['organization']->id,
    ]);
});

it('can view a room', function (): void {
    $data = $this->createRoom();

    Sanctum::actingAs($data['user']);

    $response = $this->getJson("/api/v1/rooms/{$data['room']->id}");

    $response->assertStatus(200);
});

it('can update a room', function (): void {
    $data = $this->createRoom();

    Sanctum::actingAs($data['user']);

    $this->mock(AuditService::class, function ($mock) {
        $mock->shouldReceive('log')->andReturnNull();
    });

    $response = $this->putJson("/api/v1/rooms/{$data['room']->id}", [
        'name' => 'Updated Room Name',
        'description' => 'Updated description',
    ]);

    $response->assertStatus(200);

    $this->assertDatabaseHas('rooms', [
        'id' => $data['room']->id,
        'name' => 'Updated Room Name',
    ]);
});

it('can delete a room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_SCHEDULED]);

    Sanctum::actingAs($data['user']);

    $response = $this->deleteJson("/api/v1/rooms/{$data['room']->id}");

    $response->assertStatus(204);

    $this->assertDatabaseMissing('rooms', [
        'id' => $data['room']->id,
    ]);
});

it('cannot delete a live room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    Sanctum::actingAs($data['user']);

    $response = $this->deleteJson("/api/v1/rooms/{$data['room']->id}");

    $response->assertStatus(422)
        ->assertJson([
            'message' => 'Cannot delete a live room. End the stream first.',
        ]);

    $this->assertDatabaseHas('rooms', [
        'id' => $data['room']->id,
    ]);
});
