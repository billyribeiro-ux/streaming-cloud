<?php

declare(strict_types=1);

use App\Exceptions\RoomException;
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
use App\Services\RoomService;
use App\Services\SignalingService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->signalingService = Mockery::mock(SignalingService::class);
    $this->subscriptionService = Mockery::mock(SubscriptionService::class);
    $this->auditService = Mockery::mock(AuditService::class);
    $this->cacheService = Mockery::mock(CacheService::class);

    $this->roomService = new RoomService(
        $this->signalingService,
        $this->subscriptionService,
        $this->auditService,
        $this->cacheService,
    );

    // Set up common test data
    $this->organization = Organization::factory()->create();
    $this->user = User::factory()->create();

    OrganizationMember::factory()->create([
        'organization_id' => $this->organization->id,
        'user_id' => $this->user->id,
        'role' => OrganizationMember::ROLE_OWNER,
        'accepted_at' => now(),
    ]);

    $this->workspace = Workspace::factory()->create([
        'organization_id' => $this->organization->id,
    ]);

    WorkspaceMember::factory()->create([
        'workspace_id' => $this->workspace->id,
        'user_id' => $this->user->id,
        'role' => WorkspaceMember::ROLE_ADMIN,
    ]);

    $plan = Plan::factory()->professional()->create();
    Subscription::factory()->create([
        'organization_id' => $this->organization->id,
        'plan_id' => $plan->id,
        'status' => 'active',
    ]);
});

it('can create a room with mocked dependencies', function (): void {
    $this->subscriptionService
        ->shouldReceive('canCreateRoom')
        ->once()
        ->with(Mockery::type(Organization::class))
        ->andReturn(true);

    $this->auditService
        ->shouldReceive('log')
        ->once()
        ->andReturnNull();

    $roomData = [
        'name' => 'Test Trading Room',
        'description' => 'A test room for trading',
    ];

    $room = $this->roomService->create(
        $this->workspace,
        $this->user,
        $roomData
    );

    expect($room)
        ->toBeInstanceOf(Room::class)
        ->and($room->name)->toBe('Test Trading Room')
        ->and($room->description)->toBe('A test room for trading')
        ->and($room->workspace_id)->toBe($this->workspace->id)
        ->and($room->organization_id)->toBe($this->organization->id)
        ->and($room->created_by)->toBe($this->user->id)
        ->and($room->status)->toBe(Room::STATUS_SCHEDULED);
});

it('throws exception when room limit reached', function (): void {
    $this->subscriptionService
        ->shouldReceive('canCreateRoom')
        ->once()
        ->andReturn(false);

    $this->roomService->create(
        $this->workspace,
        $this->user,
        ['name' => 'Test Room']
    );
})->throws(RoomException::class, 'Room limit reached for your subscription plan');

it('can add a participant to a room', function (): void {
    $room = Room::factory()->live()->create([
        'workspace_id' => $this->workspace->id,
        'organization_id' => $this->organization->id,
        'created_by' => $this->user->id,
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

    $session = RoomSession::factory()->create([
        'room_id' => $room->id,
        'host_user_id' => $this->user->id,
        'started_at' => now()->subMinutes(5),
        'ended_at' => null,
    ]);

    $this->cacheService
        ->shouldReceive('forget')
        ->once()
        ->andReturnNull();

    $participant = $this->roomService->addParticipant(
        $room,
        $this->user,
        'host'
    );

    expect($participant)
        ->toBeInstanceOf(RoomParticipant::class)
        ->and($participant->room_id)->toBe($room->id)
        ->and($participant->user_id)->toBe($this->user->id)
        ->and($participant->role)->toBe('host')
        ->and($participant->connection_state)->toBe('connecting');
});

it('can remove a participant from a room', function (): void {
    $room = Room::factory()->live()->create([
        'workspace_id' => $this->workspace->id,
        'organization_id' => $this->organization->id,
        'created_by' => $this->user->id,
    ]);

    $session = RoomSession::factory()->create([
        'room_id' => $room->id,
        'host_user_id' => $this->user->id,
        'started_at' => now()->subMinutes(5),
        'ended_at' => null,
    ]);

    $participant = RoomParticipant::factory()->create([
        'room_id' => $room->id,
        'session_id' => $session->id,
        'user_id' => $this->user->id,
        'role' => 'host',
        'left_at' => null,
    ]);

    $this->signalingService
        ->shouldReceive('removeParticipant')
        ->once()
        ->andReturnNull();

    $this->cacheService
        ->shouldReceive('forget')
        ->once()
        ->andReturnNull();

    $this->roomService->removeParticipant($room, $this->user);

    $participant->refresh();

    expect($participant->left_at)->not->toBeNull()
        ->and($participant->connection_state)->toBe('disconnected');
});
