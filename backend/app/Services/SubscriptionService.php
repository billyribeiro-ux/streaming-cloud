<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Organization;

/**
 * SubscriptionService - Manages subscription-based feature gating and limits.
 *
 * Provides a facade over Organization's subscription/plan logic,
 * centralizing all subscription checks for use across controllers and services.
 */
class SubscriptionService
{
    /**
     * Check whether the organization can create a new room
     * based on their subscription plan limits.
     */
    public function canCreateRoom(Organization $organization): bool
    {
        return $organization->canCreateRoom();
    }

    /**
     * Check whether the organization can create a new workspace
     * based on their subscription plan limits.
     */
    public function canCreateWorkspace(Organization $organization): bool
    {
        return $organization->canCreateWorkspace();
    }

    /**
     * Get the maximum number of viewers allowed per room
     * for the organization's subscription plan.
     */
    public function getMaxViewersPerRoom(Organization $organization): int
    {
        return $organization->getMaxViewersPerRoom();
    }

    /**
     * Check whether the organization has access to a specific feature
     * based on their subscription plan.
     */
    public function hasFeature(Organization $organization, string $feature): bool
    {
        return $organization->hasFeature($feature);
    }
}
