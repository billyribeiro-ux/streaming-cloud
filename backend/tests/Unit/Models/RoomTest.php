<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomSession;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('has correct default status', function (): void {
    $room = Room::factory()->create();

    expect($room->status)->toBe(Room::STATUS_SCHEDULED);
});

it('generates slug on creation', function (): void {
    $room = Room::factory()->create([
        'name' => 'Morning Trading Session',
        'slug' => null,
    ]);

    // The boot method generates a slug from the name with a random suffix
    expect($room->slug)
        ->toBeString()
        ->not->toBeEmpty()
        ->toContain('morning-trading-session');
});

it('can check if room is live', function (): void {
    $scheduledRoom = Room::factory()->create([
        'status' => Room::STATUS_SCHEDULED,
    ]);

    $liveRoom = Room::factory()->live()->create();

    $endedRoom = Room::factory()->ended()->create();

    expect($scheduledRoom->isLive())->toBeFalse()
        ->and($liveRoom->isLive())->toBeTrue()
        ->and($endedRoom->isLive())->toBeFalse();
});

it('has workspace relationship', function (): void {
    $workspace = Workspace::factory()->create();

    $room = Room::factory()->create([
        'workspace_id' => $workspace->id,
        'organization_id' => $workspace->organization_id,
    ]);

    expect($room->workspace)->toBeInstanceOf(Workspace::class)
        ->and($room->workspace->id)->toBe($workspace->id);
});

it('has organization relationship', function (): void {
    $organization = Organization::factory()->create();
    $workspace = Workspace::factory()->create([
        'organization_id' => $organization->id,
    ]);

    $room = Room::factory()->create([
        'workspace_id' => $workspace->id,
        'organization_id' => $organization->id,
    ]);

    expect($room->organization)->toBeInstanceOf(Organization::class)
        ->and($room->organization->id)->toBe($organization->id);
});
