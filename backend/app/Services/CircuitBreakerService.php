<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Circuit Breaker Service
 *
 * Implements the Circuit Breaker pattern to prevent cascading failures
 * when external services are experiencing issues
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests
 *
 * Flow:
 * 1. Start CLOSED (normal)
 * 2. After N failures → OPEN (fail fast)
 * 3. After timeout → HALF_OPEN (test recovery)
 * 4. If test succeeds → CLOSED (recovered)
 * 5. If test fails → OPEN (still broken)
 *
 * @package App\Services
 */
class CircuitBreakerService
{
    /**
     * Number of failures before opening circuit
     */
    private const FAILURE_THRESHOLD = 5;

    /**
     * Timeout before attempting recovery (seconds)
     */
    private const TIMEOUT_SECONDS = 60;

    /**
     * Duration to keep circuit open (seconds)
     */
    private const RETRY_AFTER_SECONDS = 60;

    /**
     * Number of success required to close circuit from half-open
     */
    private const SUCCESS_THRESHOLD = 2;

    /**
     * Execute callback with circuit breaker protection
     *
     * @param string $serviceName Service identifier (e.g., 'stripe', 'supabase')
     * @param callable $callback Function to execute
     * @param callable|null $fallback Fallback function if circuit is open
     * @return mixed
     * @throws \Exception
     */
    public function execute(
        string $serviceName,
        callable $callback,
        ?callable $fallback = null
    ): mixed {
        $cacheKey = $this->getCacheKey($serviceName);

        // Check circuit state
        $state = $this->getState($cacheKey);

        switch ($state) {
            case 'open':
                // Circuit is open, fail immediately
                if ($fallback) {
                    Log::warning("Circuit breaker OPEN for {$serviceName}, using fallback");
                    return $fallback();
                }

                throw new \Exception("Circuit breaker is OPEN for {$serviceName}. Service unavailable.");

            case 'half_open':
                // Circuit is half-open, allow limited requests
                return $this->executeHalfOpen($serviceName, $cacheKey, $callback, $fallback);

            case 'closed':
            default:
                // Circuit is closed, proceed normally
                return $this->executeClosed($serviceName, $cacheKey, $callback);
        }
    }

    /**
     * Execute in CLOSED state (normal operation)
     *
     * @param string $serviceName
     * @param string $cacheKey
     * @param callable $callback
     * @return mixed
     * @throws \Exception
     */
    protected function executeClosed(
        string $serviceName,
        string $cacheKey,
        callable $callback
    ): mixed {
        try {
            $result = $callback();

            // Success - reset failure count
            $this->recordSuccess($cacheKey);

            return $result;
        } catch (\Exception $e) {
            // Failure - increment counter
            $failures = $this->recordFailure($cacheKey);

            Log::warning("Circuit breaker failure for {$serviceName}", [
                'error' => $e->getMessage(),
                'failures' => $failures,
                'threshold' => self::FAILURE_THRESHOLD,
            ]);

            // Open circuit if threshold reached
            if ($failures >= self::FAILURE_THRESHOLD) {
                $this->openCircuit($cacheKey, $serviceName);
            }

            throw $e;
        }
    }

    /**
     * Execute in HALF_OPEN state (testing recovery)
     *
     * @param string $serviceName
     * @param string $cacheKey
     * @param callable $callback
     * @param callable|null $fallback
     * @return mixed
     * @throws \Exception
     */
    protected function executeHalfOpen(
        string $serviceName,
        string $cacheKey,
        callable $callback,
        ?callable $fallback
    ): mixed {
        try {
            $result = $callback();

            // Success - increment success counter
            $successes = $this->recordHalfOpenSuccess($cacheKey);

            Log::info("Circuit breaker HALF_OPEN success for {$serviceName}", [
                'successes' => $successes,
                'threshold' => self::SUCCESS_THRESHOLD,
            ]);

            // Close circuit if threshold reached
            if ($successes >= self::SUCCESS_THRESHOLD) {
                $this->closeCircuit($cacheKey, $serviceName);
            }

            return $result;
        } catch (\Exception $e) {
            // Failure - reopen circuit
            Log::warning("Circuit breaker HALF_OPEN failed for {$serviceName}", [
                'error' => $e->getMessage(),
            ]);

            $this->openCircuit($cacheKey, $serviceName);

            if ($fallback) {
                return $fallback();
            }

            throw $e;
        }
    }

    /**
     * Get current circuit state
     *
     * @param string $cacheKey
     * @return string 'open' | 'closed' | 'half_open'
     */
    protected function getState(string $cacheKey): string
    {
        // Check if circuit is open
        if (Cache::has("{$cacheKey}:state:open")) {
            // Check if timeout expired
            $openedAt = Cache::get("{$cacheKey}:opened_at");
            if ($openedAt && (time() - $openedAt) >= self::TIMEOUT_SECONDS) {
                // Transition to half-open
                $this->setState($cacheKey, 'half_open');
                return 'half_open';
            }

            return 'open';
        }

        // Check if circuit is half-open
        if (Cache::has("{$cacheKey}:state:half_open")) {
            return 'half_open';
        }

        return 'closed';
    }

    /**
     * Set circuit state
     *
     * @param string $cacheKey
     * @param string $state
     * @return void
     */
    protected function setState(string $cacheKey, string $state): void
    {
        // Clear all state keys
        Cache::forget("{$cacheKey}:state:open");
        Cache::forget("{$cacheKey}:state:half_open");

        // Set new state
        if ($state !== 'closed') {
            Cache::put(
                "{$cacheKey}:state:{$state}",
                true,
                self::RETRY_AFTER_SECONDS
            );
        }
    }

    /**
     * Record failure and return count
     *
     * @param string $cacheKey
     * @return int
     */
    protected function recordFailure(string $cacheKey): int
    {
        $failures = (int) Cache::get("{$cacheKey}:failures", 0);
        $failures++;

        Cache::put(
            "{$cacheKey}:failures",
            $failures,
            self::RETRY_AFTER_SECONDS
        );

        return $failures;
    }

    /**
     * Record success and reset failure count
     *
     * @param string $cacheKey
     * @return void
     */
    protected function recordSuccess(string $cacheKey): void
    {
        Cache::forget("{$cacheKey}:failures");
        Cache::forget("{$cacheKey}:half_open_successes");
    }

    /**
     * Record half-open success
     *
     * @param string $cacheKey
     * @return int
     */
    protected function recordHalfOpenSuccess(string $cacheKey): int
    {
        $successes = (int) Cache::get("{$cacheKey}:half_open_successes", 0);
        $successes++;

        Cache::put(
            "{$cacheKey}:half_open_successes",
            $successes,
            self::TIMEOUT_SECONDS
        );

        return $successes;
    }

    /**
     * Open the circuit
     *
     * @param string $cacheKey
     * @param string $serviceName
     * @return void
     */
    protected function openCircuit(string $cacheKey, string $serviceName): void
    {
        $this->setState($cacheKey, 'open');

        Cache::put(
            "{$cacheKey}:opened_at",
            time(),
            self::RETRY_AFTER_SECONDS
        );

        Log::critical("Circuit breaker OPENED for {$serviceName}", [
            'threshold' => self::FAILURE_THRESHOLD,
            'retry_after' => self::RETRY_AFTER_SECONDS,
        ]);

        // Emit metric/alert
        $this->emitAlert($serviceName, 'opened');
    }

    /**
     * Close the circuit
     *
     * @param string $cacheKey
     * @param string $serviceName
     * @return void
     */
    protected function closeCircuit(string $cacheKey, string $serviceName): void
    {
        $this->setState($cacheKey, 'closed');
        $this->recordSuccess($cacheKey);

        Log::info("Circuit breaker CLOSED for {$serviceName} - Service recovered");

        // Emit metric/alert
        $this->emitAlert($serviceName, 'closed');
    }

    /**
     * Get cache key for service
     *
     * @param string $serviceName
     * @return string
     */
    protected function getCacheKey(string $serviceName): string
    {
        return "circuit_breaker:{$serviceName}";
    }

    /**
     * Emit alert for monitoring
     *
     * @param string $serviceName
     * @param string $event
     * @return void
     */
    protected function emitAlert(string $serviceName, string $event): void
    {
        // TODO: Integrate with monitoring system (Prometheus, Datadog, etc.)
        // For now, just log
        Log::alert("Circuit Breaker Event", [
            'service' => $serviceName,
            'event' => $event,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get circuit breaker status for a service
     *
     * @param string $serviceName
     * @return array
     */
    public function getStatus(string $serviceName): array
    {
        $cacheKey = $this->getCacheKey($serviceName);
        $state = $this->getState($cacheKey);

        return [
            'service' => $serviceName,
            'state' => $state,
            'failures' => Cache::get("{$cacheKey}:failures", 0),
            'opened_at' => Cache::get("{$cacheKey}:opened_at"),
            'half_open_successes' => Cache::get("{$cacheKey}:half_open_successes", 0),
        ];
    }

    /**
     * Manually reset circuit breaker
     *
     * @param string $serviceName
     * @return void
     */
    public function reset(string $serviceName): void
    {
        $cacheKey = $this->getCacheKey($serviceName);

        Cache::forget("{$cacheKey}:state:open");
        Cache::forget("{$cacheKey}:state:half_open");
        Cache::forget("{$cacheKey}:failures");
        Cache::forget("{$cacheKey}:opened_at");
        Cache::forget("{$cacheKey}:half_open_successes");

        Log::info("Circuit breaker manually reset for {$serviceName}");
    }
}
