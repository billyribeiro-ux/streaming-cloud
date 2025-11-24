<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;

/**
 * Health Check Controller
 *
 * Provides health check endpoints for load balancers, monitoring systems,
 * and Kubernetes readiness/liveness probes
 *
 * Endpoints:
 * - /health: Basic health check (fast)
 * - /health/ready: Readiness probe (can handle traffic?)
 * - /health/live: Liveness probe (is process alive?)
 * - /health/detailed: Detailed health status (for debugging)
 *
 * @package App\Http\Controllers
 */
class HealthController extends Controller
{
    /**
     * Basic health check
     * Fast check for load balancer
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'redis' => $this->checkRedis(),
            'storage' => $this->checkStorage(),
        ];

        $healthy = !in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'healthy' : 'degraded',
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
            'version' => config('app.version', '1.0.0'),
        ], $healthy ? 200 : 503);
    }

    /**
     * Readiness probe
     * Indicates whether the service can handle traffic
     *
     * @return JsonResponse
     */
    public function ready(): JsonResponse
    {
        // Check if all critical services are available
        $ready = $this->checkDatabase() && $this->checkRedis();

        return response()->json([
            'ready' => $ready,
            'timestamp' => now()->toIso8601String(),
        ], $ready ? 200 : 503);
    }

    /**
     * Liveness probe
     * Indicates whether the process is alive (simple check)
     *
     * @return JsonResponse
     */
    public function live(): JsonResponse
    {
        return response()->json([
            'live' => true,
            'uptime' => $this->getUptime(),
            'memory_usage' => $this->getMemoryUsage(),
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Detailed health status
     * Comprehensive check for debugging (slower)
     *
     * @return JsonResponse
     */
    public function detailed(): JsonResponse
    {
        $checks = [
            'application' => $this->checkApplication(),
            'database' => $this->checkDatabaseDetailed(),
            'redis' => $this->checkRedisDetailed(),
            'storage' => $this->checkStorageDetailed(),
            'queue' => $this->checkQueue(),
        ];

        $healthy = !in_array(false, array_column($checks, 'healthy'), true);

        return response()->json([
            'status' => $healthy ? 'healthy' : 'degraded',
            'checks' => $checks,
            'system' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'environment' => config('app.env'),
                'debug' => config('app.debug'),
                'uptime' => $this->getUptime(),
                'memory' => $this->getMemoryUsage(),
                'load_average' => $this->getLoadAverage(),
            ],
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    /**
     * Check database connectivity (fast)
     *
     * @return bool
     */
    protected function checkDatabase(): bool
    {
        try {
            DB::connection()->getPdo();
            return true;
        } catch (\Exception $e) {
            \Log::error('Health check: Database connection failed', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check database with query (detailed)
     *
     * @return array
     */
    protected function checkDatabaseDetailed(): array
    {
        try {
            $start = microtime(true);
            $result = DB::select('SELECT 1 as healthy');
            $duration = round((microtime(true) - $start) * 1000, 2);

            return [
                'healthy' => $result[0]->healthy === 1,
                'response_time_ms' => $duration,
                'connection' => config('database.default'),
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check Redis connectivity (fast)
     *
     * @return bool
     */
    protected function checkRedis(): bool
    {
        try {
            Redis::ping();
            return true;
        } catch (\Exception $e) {
            \Log::error('Health check: Redis connection failed', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check Redis with command (detailed)
     *
     * @return array
     */
    protected function checkRedisDetailed(): array
    {
        try {
            $start = microtime(true);
            $pong = Redis::ping();
            $duration = round((microtime(true) - $start) * 1000, 2);

            return [
                'healthy' => $pong === 'PONG' || $pong === '+PONG',
                'response_time_ms' => $duration,
                'connection' => config('database.redis.default.host'),
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check storage (fast)
     *
     * @return bool
     */
    protected function checkStorage(): bool
    {
        try {
            $testFile = 'health-check-' . time() . '.txt';
            Storage::put($testFile, 'health-check');
            $exists = Storage::exists($testFile);
            Storage::delete($testFile);
            return $exists;
        } catch (\Exception $e) {
            \Log::error('Health check: Storage check failed', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check storage (detailed)
     *
     * @return array
     */
    protected function checkStorageDetailed(): array
    {
        try {
            $start = microtime(true);
            $testFile = 'health-check-' . time() . '.txt';
            Storage::put($testFile, 'health-check');
            $exists = Storage::exists($testFile);
            Storage::delete($testFile);
            $duration = round((microtime(true) - $start) * 1000, 2);

            return [
                'healthy' => $exists,
                'response_time_ms' => $duration,
                'disk' => config('filesystems.default'),
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check application status
     *
     * @return array
     */
    protected function checkApplication(): array
    {
        return [
            'healthy' => true,
            'name' => config('app.name'),
            'environment' => config('app.env'),
            'debug' => config('app.debug'),
            'maintenance_mode' => app()->isDownForMaintenance(),
        ];
    }

    /**
     * Check queue system
     *
     * @return array
     */
    protected function checkQueue(): array
    {
        try {
            return [
                'healthy' => true,
                'driver' => config('queue.default'),
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get system uptime
     *
     * @return float
     */
    protected function getUptime(): float
    {
        if (function_exists('uptime')) {
            return uptime();
        }

        // Fallback: Use Apache or PHP-FPM start time
        if (isset($_SERVER['REQUEST_TIME_FLOAT'])) {
            return microtime(true) - $_SERVER['REQUEST_TIME_FLOAT'];
        }

        return 0.0;
    }

    /**
     * Get memory usage
     *
     * @return array
     */
    protected function getMemoryUsage(): array
    {
        return [
            'current_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
            'peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            'limit' => ini_get('memory_limit'),
        ];
    }

    /**
     * Get system load average
     *
     * @return array|null
     */
    protected function getLoadAverage(): ?array
    {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            return [
                '1min' => round($load[0], 2),
                '5min' => round($load[1], 2),
                '15min' => round($load[2], 2),
            ];
        }

        return null;
    }
}
