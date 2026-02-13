<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Plan;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomSession;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\AuditService;
use App\Services\CacheService;
use App\Services\SignalingService;
use App\Services\SubscriptionService;
use Laravel\Sanctum\Sanctum;

it('can start a room stream', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_SCHEDULED]);

    // Ensure workspace member has host role
    WorkspaceMember::where('workspace_id', $data['workspace']->id)
        ->where('user_id', $data['user']->id)
        ->update(['role' => WorkspaceMember::ROLE_HOST]);

    // Ensure org membership exists for canJoin check
    OrganizationMember::firstOrCreate([
        'organization_id' => $data['organization']->id,
        'user_id' => $data['user']->id,
    ], [
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    $this->mock(SignalingService::class, function ($mock) {
        $mock->shouldReceive('allocateRoom')->once()->andReturn([
            'node' => 'sfu-1.example.com',
            'routerId' => 'router-abc-123',
            'iceServers' => [],
        ]);
        $mock->shouldReceive('generateToken')->andReturn('mock-jwt-token');
        $mock->shouldReceive('removeParticipant')->andReturnNull();
    });

    $this->mock(AuditService::class, function ($mock) {
        $mock->shouldReceive('log')->andReturnNull();
    });

    $this->mock(CacheService::class, function ($mock) {
        $mock->shouldReceive('forget')->andReturnNull();
    });

    $this->mock(SubscriptionService::class, function ($mock) {
        $mock->shouldReceive('canCreateRoom')->andReturn(true);
    });

    Sanctum::actingAs($data['user']);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/start");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'session_id',
                'sfu_node',
                'router_id',
            ],
        ]);

    $this->assertDatabaseHas('rooms', [
        'id' => $data['room']->id,
        'status' => Room::STATUS_LIVE,
    ]);
});

it('can end a room stream', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Ensure workspace member has host role
    WorkspaceMember::where('workspace_id', $data['workspace']->id)
        ->where('user_id', $data['user']->id)
        ->update(['role' => WorkspaceMember::ROLE_HOST]);

    // Create an active session
    RoomSession::factory()->create([
        'room_id' => $data['room']->id,
        'host_user_id' => $data['user']->id,
        'started_at' => now()->subMinutes(30),
        'ended_at' => null,
    ]);

    $this->mock(SignalingService::class, function ($mock) {
        $mock->shouldReceive('closeRoom')->once()->andReturnNull();
        $mock->shouldReceive('removeParticipant')->andReturnNull();
    });

    $this->mock(AuditService::class, function ($mock) {
        $mock->shouldReceive('log')->andReturnNull();
    });

    $this->mock(CacheService::class, function ($mock) {
        $mock->shouldReceive('forget')->andReturnNull();
    });

    Sanctum::actingAs($data['user']);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/end");

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'Stream ended successfully',
        ]);

    $this->assertDatabaseHas('rooms', [
        'id' => $data['room']->id,
        'status' => Room::STATUS_ENDED,
    ]);
});

it('can join a room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    // Create a joiner user who belongs to the organization
    $joiner = User::factory()->create();
    OrganizationMember::factory()->create([
        'organization_id' => $data['organization']->id,
        'user_id' => $joiner->id,
        'role' => OrganizationMember::ROLE_MEMBER,
        'accepted_at' => now(),
    ]);

    // Create an active session
    $session = RoomSession::factory()->create([
        'room_id' => $data['room']->id,
        'host_user_id' => $data['user']->id,
        'started_at' => now()->subMinutes(10),
        'ended_at' => null,
    ]);

    $this->mock(SignalingService::class, function ($mock) {
        $mock->shouldReceive('generateToken')->once()->andReturn('mock-signaling-jwt');
        $mock->shouldReceive('removeParticipant')->andReturnNull();
    });

    $this->mock(CacheService::class, function ($mock) {
        $mock->shouldReceive('forget')->andReturnNull();
    });

    Sanctum::actingAs($joiner);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/join");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'participant_id',
                'role',
                'signaling_url',
                'token',
            ],
        ]);

    $this->assertDatabaseHas('room_participants', [
        'room_id' => $data['room']->id,
        'user_id' => $joiner->id,
    ]);
});

it('can leave a room', function (): void {
    $data = $this->createRoom(['status' => Room::STATUS_LIVE, 'actual_start' => now()]);

    $session = RoomSession::factory()->create([
        'room_id' => $data['room']->id,
        'host_user_id' => $data['user']->id,
        'started_at' => now()->subMinutes(10),
        'ended_at' => null,
    ]);

    // Create participant
    $participant = RoomParticipant::factory()->create([
        'room_id' => $data['room']->id,
        'session_id' => $session->id,
        'user_id' => $data['user']->id,
        'role' => 'host',
        'left_at' => null,
    ]);

    $this->mock(SignalingService::class, function ($mock) {
        $mock->shouldReceive('removeParticipant')->once()->andReturnNull();
    });

    $this->mock(CacheService::class, function ($mock) {
        $mock->shouldReceive('forget')->andReturnNull();
    });

    Sanctum::actingAs($data['user']);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/leave");

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'Left room successfully',
        ]);

    expect($participant->fresh()->left_at)->not->toBeNull();
});

it('enforces viewer limits', function (): void {
    $data = $this->createRoom([
        'status' => Room::STATUS_LIVE,
        'actual_start' => now(),
        'settings' => [
            'max_participants' => 2,
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

    $session = RoomSession::factory()->create([
        'room_id' => $data['room']->id,
        'host_user_id' => $data['user']->id,
        'started_at' => now()->subMinutes(10),
        'ended_at' => null,
    ]);

    // Fill up the room to the max
    $existingUsers = User::factory()->count(2)->create();
    foreach ($existingUsers as $existingUser) {
        OrganizationMember::factory()->create([
            'organization_id' => $data['organization']->id,
            'user_id' => $existingUser->id,
            'role' => OrganizationMember::ROLE_MEMBER,
            'accepted_at' => now(),
        ]);

        RoomParticipant::factory()->create([
            'room_id' => $data['room']->id,
            'session_id' => $session->id,
            'user_id' => $existingUser->id,
            'role' => 'viewer',
            'left_at' => null,
        ]);
    }

    // Create a new user trying to join a full room
    $newUser = User::factory()->create();
    OrganizationMember::factory()->create([
        'organization_id' => $data['organization']->id,
        'user_id' => $newUser->id,
        'role' => OrganizationMember::ROLE_MEMBER,
        'accepted_at' => now(),
    ]);

    $this->mock(SignalingService::class, function ($mock) {
        $mock->shouldReceive('generateToken')->andReturn('mock-token');
    });

    $this->mock(CacheService::class, function ($mock) {
        $mock->shouldReceive('forget')->andReturnNull();
    });

    Sanctum::actingAs($newUser);

    $response = $this->postJson("/api/v1/rooms/{$data['room']->id}/join");

    // The RoomService throws a RoomException::cannotJoin which renders as 403
    $response->assertStatus(403);
});
