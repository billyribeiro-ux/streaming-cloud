<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('generates slug from name', function (): void {
    $organization = Organization::factory()->create([
        'name' => 'Acme Trading Corp',
        'slug' => null,
    ]);

    // The boot method generates slug from name using Str::slug
    expect($organization->slug)
        ->toBeString()
        ->not->toBeEmpty()
        ->toBe('acme-trading-corp');
});

it('casts settings to array', function (): void {
    $organization = Organization::factory()->create([
        'settings' => [
            'timezone' => 'America/New_York',
            'language' => 'en',
            'allow_guest_viewers' => true,
        ],
    ]);

    $organization->refresh();

    expect($organization->settings)
        ->toBeArray()
        ->toHaveKey('timezone', 'America/New_York')
        ->toHaveKey('language', 'en')
        ->toHaveKey('allow_guest_viewers', true);
});

it('can check active subscription', function (): void {
    $organization = Organization::factory()->create();

    // Without a subscription
    expect($organization->hasActiveSubscription())->toBeFalse();

    // With an active subscription
    $plan = Plan::factory()->professional()->create();
    Subscription::factory()->create([
        'organization_id' => $organization->id,
        'plan_id' => $plan->id,
        'status' => 'active',
    ]);

    // Refresh to load the subscription relationship
    $organization->refresh();

    expect($organization->hasActiveSubscription())->toBeTrue();

    // With a trialing subscription
    $orgTrialing = Organization::factory()->create();
    Subscription::factory()->trialing()->create([
        'organization_id' => $orgTrialing->id,
        'plan_id' => $plan->id,
    ]);

    expect($orgTrialing->hasActiveSubscription())->toBeTrue();

    // With a cancelled subscription
    $orgCancelled = Organization::factory()->create();
    Subscription::factory()->create([
        'organization_id' => $orgCancelled->id,
        'plan_id' => $plan->id,
        'status' => 'cancelled',
    ]);

    expect($orgCancelled->hasActiveSubscription())->toBeFalse();
});
