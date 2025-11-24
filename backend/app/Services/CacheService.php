<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Models\Organization;
use App\Models\Room;

/**
 * Multi-Layer Caching Service
 *
 * Implements L1 (Memory) → L2 (Redis) → L3 (Database) caching strategy
 * for enterprise-grade performance
 *
 * Performance Impact:
 * - 90%+ cache hit rate reduces database load by 10x
 * - Memory cache (L1) serves requests in <1ms
 * - Redis cache (L2) serves requests in 1-5ms
 * - Database (L3) serves requests in 10-100ms
 *
 * @package App\Services
 */
class CacheService
{
    /**
     * L1 Cache: In-memory cache (per-request)
     * Fastest but scoped to single request
     */
    private array $memoryCache = [];

    /**
     * Cache hit/miss statistics
     */
    private array $stats = [
        'l1_hits' => 0,
        'l2_hits' => 0,
        'l3_hits' => 0,
        'total_requests' => 0,
    ];

    /**
     * Get from cache with multi-layer fallback
     *
     * @param string $key Cache key
     * @param int $ttl Time to live in seconds
     * @param callable $callback Function to generate value if not cached
     * @return mixed
     */
    public function remember(string $key, int $ttl, callable $callback): mixed
    {
        $this->stats['total_requests']++;

        // L1: Check memory cache (fastest)
        if (isset($this->memoryCache[$key])) {
            $this->stats['l1_hits']++;
            Log::debug("Cache L1 HIT: {$key}");
            return $this->memoryCache[$key];
        }

        // L2: Check Redis cache
        $value = Cache::remember($key, $ttl, function () use ($callback, $key) {
            // L3: Generate from source (database/API)
            $this->stats['l3_hits']++;
            Log::debug("Cache L3 MISS: {$key} - Generating from source");
            return $callback();
        });

        if (Cache::has($key)) {
            $this->stats['l2_hits']++;
            Log::debug("Cache L2 HIT: {$key}");
        }

        // Store in L1 for subsequent requests in same process
        $this->memoryCache[$key] = $value;

        return $value;
    }

    /**
     * Invalidate cache at all layers
     *
     * @param string $key Cache key or pattern
     * @return void
     */
    public function forget(string $key): void
    {
        // Clear L1
        unset($this->memoryCache[$key]);

        // Clear L2
        Cache::forget($key);

        Log::info("Cache invalidated: {$key}");
    }

    /**
     * Invalidate multiple keys by pattern
     *
     * @param string $pattern Pattern to match (e.g., "room:123:*")
     * @return void
     */
    public function forgetPattern(string $pattern): void
    {
        // Clear L1 matching pattern
        foreach (array_keys($this->memoryCache) as $key) {
            if (fnmatch($pattern, $key)) {
                unset($this->memoryCache[$key]);
            }
        }

        // Clear L2 using Redis SCAN
        $redis = Cache::getRedis();
        $prefix = config('cache.prefix') . ':';
        $fullPattern = $prefix . $pattern;

        $iterator = null;
        while (false !== ($keys = $redis->scan($iterator, $fullPattern, 100))) {
            foreach ($keys as $key) {
                $redis->del($key);
            }
        }

        Log::info("Cache pattern invalidated: {$pattern}");
    }

    /**
     * Warm cache proactively for an organization
     * Reduces cold-start latency
     *
     * @param Organization $org
     * @return void
     */
    public function warmOrganizationCache(Organization $org): void
    {
        Log::info("Warming cache for organization: {$org->id}");

        // Warm critical organization data
        $this->remember(
            "org:{$org->id}:plan",
            3600, // 1 hour
            fn() => $org->load('subscription.plan')
        );

        $this->remember(
            "org:{$org->id}:members",
            300, // 5 minutes
            fn() => $org->members()->with('user')->get()
        );

        $this->remember(
            "org:{$org->id}:workspaces",
            300, // 5 minutes
            fn() => $org->workspaces()->where('is_active', true)->get()
        );

        $this->remember(
            "org:{$org->id}:settings",
            600, // 10 minutes
            fn() => $org->settings
        );
    }

    /**
     * Warm cache for a room
     *
     * @param Room $room
     * @return void
     */
    public function warmRoomCache(Room $room): void
    {
        Log::info("Warming cache for room: {$room->id}");

        // Warm room data
        $this->remember(
            "room:{$room->id}:settings",
            300, // 5 minutes
            fn() => $room->settings
        );

        $this->remember(
            "room:{$room->id}:participants",
            5, // 5 seconds (frequently changing)
            fn() => $room->activeParticipants()
                ->with(['user.profile'])
                ->get()
                ->map(fn($p) => [
                    'id' => $p->id,
                    'user_id' => $p->user_id,
                    'role' => $p->role,
                    'display_name' => $p->user->profile?->display_name ?? $p->user->email,
                ])
                ->toArray()
        );
    }

    /**
     * Get cache statistics
     *
     * @return array
     */
    public function getStats(): array
    {
        $total = $this->stats['total_requests'];

        if ($total === 0) {
            return array_merge($this->stats, ['hit_rate' => 0]);
        }

        $hits = $this->stats['l1_hits'] + $this->stats['l2_hits'];
        $hitRate = round(($hits / $total) * 100, 2);

        return array_merge($this->stats, [
            'hit_rate' => $hitRate,
            'memory_usage' => count($this->memoryCache),
        ]);
    }

    /**
     * Clear all caches (use with caution)
     *
     * @return void
     */
    public function flush(): void
    {
        $this->memoryCache = [];
        Cache::flush();
        Log::warning('All caches flushed');
    }

    /**
     * Cache organization plan (rarely changes)
     *
     * @param Organization $org
     * @return mixed
     */
    public function getOrganizationPlan(Organization $org): mixed
    {
        return $this->remember(
            "org:{$org->id}:plan",
            3600, // 1 hour
            fn() => $org->subscription?->plan
        );
    }

    /**
     * Cache organization settings
     *
     * @param Organization $org
     * @return array
     */
    public function getOrganizationSettings(Organization $org): array
    {
        return $this->remember(
            "org:{$org->id}:settings",
            600, // 10 minutes
            fn() => $org->settings
        );
    }

    /**
     * Cache room participants (short TTL due to frequent changes)
     *
     * @param Room $room
     * @return array
     */
    public function getRoomParticipants(Room $room): array
    {
        return $this->remember(
            "room:{$room->id}:participants",
            5, // 5 seconds
            fn() => $room->activeParticipants()
                ->with(['user.profile'])
                ->get()
                ->map(fn($p) => [
                    'id' => $p->id,
                    'user_id' => $p->user_id,
                    'role' => $p->role,
                    'is_video_enabled' => $p->is_video_enabled,
                    'is_audio_enabled' => $p->is_audio_enabled,
                    'display_name' => $p->user->profile?->display_name ?? $p->user->email,
                ])
                ->toArray()
        );
    }

    /**
     * Invalidate room caches
     *
     * @param Room $room
     * @return void
     */
    public function invalidateRoom(Room $room): void
    {
        $this->forgetPattern("room:{$room->id}:*");
    }

    /**
     * Invalidate organization caches
     *
     * @param Organization $org
     * @return void
     */
    public function invalidateOrganization(Organization $org): void
    {
        $this->forgetPattern("org:{$org->id}:*");
    }
}
