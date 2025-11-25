<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Redis;

/**
 * Prometheus Metrics Service
 *
 * Collects and exposes metrics for Prometheus scraping
 * Uses Redis for metric storage across multiple workers
 */
class MetricsService
{
    private string $prefix = 'tradingroom_';

    /**
     * Increment a counter metric
     */
    public function incrementCounter(string $metric, array $labels = [], int $value = 1): void
    {
        $key = $this->buildMetricKey('counter', $metric, $labels);
        Redis::incrby($key, $value);
        Redis::expire($key, 3600); // 1 hour TTL
    }

    /**
     * Set a gauge metric
     */
    public function setGauge(string $metric, float $value, array $labels = []): void
    {
        $key = $this->buildMetricKey('gauge', $metric, $labels);
        Redis::set($key, $value);
        Redis::expire($key, 3600);
    }

    /**
     * Observe a histogram value
     */
    public function observeHistogram(string $metric, float $value, array $labels = []): void
    {
        $key = $this->buildMetricKey('histogram', $metric, $labels);
        Redis::rpush($key, $value);
        Redis::expire($key, 3600);
    }

    /**
     * Record API request
     */
    public function recordApiRequest(string $endpoint, string $method, int $statusCode, float $durationMs): void
    {
        $this->incrementCounter('api_requests_total', [
            'endpoint' => $endpoint,
            'method' => $method,
            'status' => $statusCode,
        ]);

        $this->observeHistogram('api_request_duration_ms', $durationMs, [
            'endpoint' => $endpoint,
            'method' => $method,
        ]);
    }

    /**
     * Record room event
     */
    public function recordRoomEvent(string $event, string $organizationId): void
    {
        $this->incrementCounter('room_events_total', [
            'event' => $event,
            'organization_id' => $organizationId,
        ]);
    }

    /**
     * Record active rooms
     */
    public function recordActiveRooms(int $count): void
    {
        $this->setGauge('active_rooms', $count);
    }

    /**
     * Record active participants
     */
    public function recordActiveParticipants(int $count): void
    {
        $this->setGauge('active_participants', $count);
    }

    /**
     * Record cache hit/miss
     */
    public function recordCacheAccess(string $result): void
    {
        $this->incrementCounter('cache_access_total', ['result' => $result]);
    }

    /**
     * Record database query
     */
    public function recordDatabaseQuery(float $durationMs, string $connection = 'pgsql'): void
    {
        $this->observeHistogram('database_query_duration_ms', $durationMs, [
            'connection' => $connection,
        ]);
    }

    /**
     * Export metrics in Prometheus format
     */
    public function export(): string
    {
        $output = [];

        // Get all metric keys
        $keys = Redis::keys($this->prefix . '*');

        foreach ($keys as $key) {
            $parts = explode(':', $key);
            $type = $parts[1] ?? 'counter';
            $metric = $parts[2] ?? 'unknown';

            $value = Redis::get($key);

            if ($value !== null) {
                $output[] = "# TYPE {$this->prefix}{$metric} {$type}";
                $output[] = "{$this->prefix}{$metric} {$value}";
            }
        }

        return implode("\n", $output);
    }

    /**
     * Build metric key with labels
     */
    private function buildMetricKey(string $type, string $metric, array $labels): string
    {
        $labelString = '';
        if (!empty($labels)) {
            $labelPairs = [];
            foreach ($labels as $key => $value) {
                $labelPairs[] = "{$key}=\"{$value}\"";
            }
            $labelString = '{' . implode(',', $labelPairs) . '}';
        }

        return $this->prefix . $type . ':' . $metric . $labelString;
    }
}
