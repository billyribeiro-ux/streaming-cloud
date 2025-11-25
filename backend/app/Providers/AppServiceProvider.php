<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Application Service Provider
 *
 * Bootstraps enterprise-grade features:
 * - Slow query logging
 * - Database event listeners
 * - Performance monitoring
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Enable slow query logging in production
        if (config('app.env') === 'production') {
            $this->enableSlowQueryLogging();
        }

        // Log all queries in development
        if (config('app.debug')) {
            $this->enableQueryLogging();
        }

        // Monitor transaction times
        $this->monitorTransactions();
    }

    /**
     * Enable slow query logging
     * Logs queries that take longer than threshold
     */
    protected function enableSlowQueryLogging(): void
    {
        $threshold = (int) env('SLOW_QUERY_THRESHOLD_MS', 100);

        DB::listen(function ($query) use ($threshold) {
            if ($query->time > $threshold) {
                Log::warning('Slow query detected', [
                    'sql' => $query->sql,
                    'bindings' => $query->bindings,
                    'time_ms' => $query->time,
                    'threshold_ms' => $threshold,
                    'connection' => $query->connectionName,
                    'trace' => $this->getQueryTrace(),
                ]);

                // Emit metric for monitoring
                if (function_exists('statsd_increment')) {
                    statsd_increment('database.slow_query');
                }
            }
        });
    }

    /**
     * Enable query logging for debugging
     */
    protected function enableQueryLogging(): void
    {
        DB::listen(function ($query) {
            Log::debug('Query executed', [
                'sql' => $query->sql,
                'bindings' => $query->bindings,
                'time_ms' => $query->time,
            ]);
        });
    }

    /**
     * Monitor database transaction times
     */
    protected function monitorTransactions(): void
    {
        DB::listen(function ($query) {
            // Track transaction start
            if (stripos($query->sql, 'BEGIN') === 0) {
                cache()->put(
                    'transaction:start:' . DB::transactionLevel(),
                    microtime(true),
                    60
                );
            }

            // Track transaction end and log duration
            if (stripos($query->sql, 'COMMIT') === 0) {
                $level = DB::transactionLevel();
                $startTime = cache()->get('transaction:start:' . $level);

                if ($startTime) {
                    $duration = (microtime(true) - $startTime) * 1000;

                    if ($duration > 1000) { // Log transactions > 1 second
                        Log::warning('Long transaction detected', [
                            'duration_ms' => round($duration, 2),
                            'level' => $level,
                        ]);
                    }

                    cache()->forget('transaction:start:' . $level);
                }
            }
        });
    }

    /**
     * Get simplified stack trace for query origin
     */
    protected function getQueryTrace(): array
    {
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 10);

        return array_map(function ($item) {
            return [
                'file' => $item['file'] ?? 'unknown',
                'line' => $item['line'] ?? 0,
                'function' => ($item['class'] ?? '') . ($item['type'] ?? '') . ($item['function'] ?? ''),
            ];
        }, array_slice($trace, 3, 5));
    }
}
