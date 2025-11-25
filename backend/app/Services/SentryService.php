<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sentry Error Tracking Service
 *
 * Provides enterprise-grade error tracking, monitoring, and alerting.
 * Integrates with Sentry.io for real-time error notifications and debugging.
 *
 * Key Features:
 * - Automatic exception capture
 * - Context enrichment (user, request, environment)
 * - Breadcrumb tracking
 * - Performance monitoring
 * - Release tracking
 */
class SentryService
{
    private bool $enabled;
    private ?string $dsn;
    private string $environment;
    private ?string $release;

    public function __construct()
    {
        $this->enabled = (bool) env('SENTRY_ENABLED', false);
        $this->dsn = env('SENTRY_LARAVEL_DSN');
        $this->environment = env('APP_ENV', 'production');
        $this->release = env('SENTRY_RELEASE', git_commit_sha());
    }

    /**
     * Capture an exception with full context
     *
     * @param Throwable $exception
     * @param array $context
     */
    public function captureException(Throwable $exception, array $context = []): void
    {
        if (!$this->enabled) {
            return;
        }

        $data = [
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
            'context' => $context,
            'environment' => $this->environment,
            'release' => $this->release,
            'timestamp' => now()->toIso8601String(),
        ];

        // Log locally
        Log::error('Exception captured', $data);

        // Send to Sentry (in production, use Sentry PHP SDK)
        $this->sendToSentry('exception', $data);
    }

    /**
     * Capture a message with severity level
     *
     * @param string $message
     * @param string $level (debug|info|warning|error|fatal)
     * @param array $context
     */
    public function captureMessage(string $message, string $level = 'info', array $context = []): void
    {
        if (!$this->enabled) {
            return;
        }

        $data = [
            'message' => $message,
            'level' => $level,
            'context' => $context,
            'environment' => $this->environment,
            'release' => $this->release,
            'timestamp' => now()->toIso8601String(),
        ];

        Log::channel('sentry')->{$level}($message, $context);

        $this->sendToSentry('message', $data);
    }

    /**
     * Add breadcrumb for debugging trail
     *
     * @param string $category
     * @param string $message
     * @param array $data
     * @param string $level
     */
    public function addBreadcrumb(
        string $category,
        string $message,
        array $data = [],
        string $level = 'info'
    ): void {
        if (!$this->enabled) {
            return;
        }

        $breadcrumb = [
            'category' => $category,
            'message' => $message,
            'data' => $data,
            'level' => $level,
            'timestamp' => now()->timestamp,
        ];

        // Store in session/cache for this request
        $breadcrumbs = session('sentry_breadcrumbs', []);
        $breadcrumbs[] = $breadcrumb;
        session(['sentry_breadcrumbs' => array_slice($breadcrumbs, -50)]); // Keep last 50
    }

    /**
     * Set user context for error tracking
     *
     * @param int|string $userId
     * @param string|null $email
     * @param string|null $username
     */
    public function setUser($userId, ?string $email = null, ?string $username = null): void
    {
        if (!$this->enabled) {
            return;
        }

        session([
            'sentry_user' => [
                'id' => $userId,
                'email' => $email,
                'username' => $username,
            ],
        ]);
    }

    /**
     * Set custom context tags
     *
     * @param array $tags
     */
    public function setTags(array $tags): void
    {
        if (!$this->enabled) {
            return;
        }

        session(['sentry_tags' => array_merge(session('sentry_tags', []), $tags)]);
    }

    /**
     * Start performance transaction
     *
     * @param string $name
     * @param string $op
     * @return array
     */
    public function startTransaction(string $name, string $op = 'http.server'): array
    {
        return [
            'name' => $name,
            'op' => $op,
            'startTime' => microtime(true),
            'traceId' => $this->generateTraceId(),
        ];
    }

    /**
     * Finish performance transaction
     *
     * @param array $transaction
     * @param int|null $statusCode
     */
    public function finishTransaction(array $transaction, ?int $statusCode = null): void
    {
        if (!$this->enabled) {
            return;
        }

        $endTime = microtime(true);
        $duration = ($endTime - $transaction['startTime']) * 1000; // ms

        $data = [
            'name' => $transaction['name'],
            'op' => $transaction['op'],
            'duration_ms' => round($duration, 2),
            'status_code' => $statusCode,
            'trace_id' => $transaction['traceId'],
            'timestamp' => now()->toIso8601String(),
        ];

        Log::info('Transaction completed', $data);

        $this->sendToSentry('transaction', $data);
    }

    /**
     * Send data to Sentry
     *
     * @param string $type
     * @param array $data
     */
    private function sendToSentry(string $type, array $data): void
    {
        if (!$this->dsn) {
            return;
        }

        // Add session context
        $data['user'] = session('sentry_user');
        $data['tags'] = session('sentry_tags', []);
        $data['breadcrumbs'] = session('sentry_breadcrumbs', []);

        // In production, use Sentry SDK: \Sentry\captureException()
        // For now, store in Redis for batch processing
        \Illuminate\Support\Facades\Redis::rpush(
            'sentry:events:' . date('YmdHi'),
            json_encode(['type' => $type, 'data' => $data])
        );
    }

    /**
     * Generate trace ID
     *
     * @return string
     */
    private function generateTraceId(): string
    {
        return bin2hex(random_bytes(16));
    }
}

/**
 * Get current git commit SHA for release tracking
 *
 * @return string|null
 */
function git_commit_sha(): ?string
{
    $sha = exec('git rev-parse --short HEAD 2>/dev/null');
    return $sha ?: null;
}
