<?php

declare(strict_types=1);

use App\Models\Alert;
use App\Models\OrganizationMember;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomSession;
use App\Models\WorkspaceMember;
use Laravel\Sanctum\Sanctum;

it('can list alerts for a room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    Alert::factory()->count(3)->create([
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->getJson("/api/v1/rooms/{$data['room']->id}/alerts");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
        ]);

    expect(count($response->json('data')))->toBe(3);
});

it('can create an alert', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    // Ensure workspace member has host role for alert creation permission
    WorkspaceMember::where('workspace_id', $data['workspace']->id)
        ->where('user_id', $data['user']->id)
        ->update(['role' => WorkspaceMember::ROLE_HOST]);

    Sanctum::actingAs($data['user']);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/alerts", [
        'type' => 'trade',
        'title' => 'BTC Price Alert',
        'message' => 'BTC has crossed the $50,000 resistance level',
        'priority' => 'high',
    ]);

    $response->assertStatus(201)
        ->assertJson([
            'message' => 'Alert created',
        ]);

    $this->assertDatabaseHas('alerts', [
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
        'type' => 'trade',
        'title' => 'BTC Price Alert',
        'priority' => 'high',
    ]);
});

it('can delete an alert', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    $alert = Alert::factory()->create([
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->deleteJson("/api/v1/alerts/{$alert->id}");

    $response->assertStatus(204);

    $this->assertDatabaseMissing('alerts', [
        'id' => $alert->id,
    ]);
});
