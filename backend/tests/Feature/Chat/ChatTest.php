<?php

declare(strict_types=1);

use App\Models\ChatMessage;
use App\Models\OrganizationMember;
use App\Models\Room;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('can list messages for a room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    // Create some messages in the room
    ChatMessage::factory()->count(5)->create([
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->getJson("/api/v1/rooms/{$data['room']->id}/messages");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
            'meta' => [
                'current_page',
                'total',
            ],
        ]);

    expect($response->json('meta.total'))->toBe(5);
});

it('can send a message', function (): void {
    $data = $this->createRoom([
        'status' => Room::STATUS_LIVE,
        'actual_start' => now(),
        'settings' => [
            'max_participants' => 100,
            'allow_chat' => true,
            'allow_reactions' => true,
            'allow_screen_share' => true,
            'require_approval' => false,
            'waiting_room' => false,
            'mute_on_entry' => true,
            'simulcast' => true,
            'video_quality' => '720p',
        ],
    ]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/messages", [
        'content' => 'Hello, this is a test message!',
        'type' => 'text',
    ]);

    $response->assertStatus(201)
        ->assertJson([
            'message' => 'Message sent',
        ]);

    $this->assertDatabaseHas('chat_messages', [
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
        'content' => 'Hello, this is a test message!',
        'type' => 'text',
    ]);
});

it('can delete own message', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure org membership exists
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    $message = ChatMessage::factory()->create([
        'room_id' => $data['room']->id,
        'user_id' => $data['user']->id,
        'content' => 'Message to delete',
        'is_deleted' => false,
    ]);

    Sanctum::actingAs($data['user']);

    $response = $this->deleteJson("/api/v1/messages/{$message->id}");

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'Message deleted',
        ]);

    expect($message->fresh()->is_deleted)->toBeTrue();
});
