<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Retry Service with Exponential Backoff
 *
 * Automatically retries failed operations with increasing delays
 * to handle transient failures gracefully
 *
 * Features:
 * - Exponential backoff (delay doubles each retry)
 * - Jitter to prevent thundering herd
 * - Configurable max attempts and delays
 * - Detailed logging for debugging
 * - Exception filtering (only retry specific exceptions)
 *
 * @package App\Services
 */
class RetryService
{
    /**
     * Retry a callback with exponential backoff
     *
     * @param callable $callback Function to retry
     * @param int $maxAttempts Maximum retry attempts (default: 3)
     * @param int $initialDelayMs Initial delay in milliseconds (default: 100ms)
     * @param float $multiplier Delay multiplier per attempt (default: 2.0)
     * @param int $maxDelayMs Maximum delay in milliseconds (default: 30000ms = 30s)
     * @param array|null $retryableExceptions Only retry these exception types (null = retry all)
     * @return mixed
     * @throws \Exception
     */
    public function retry(
        callable $callback,
        int $maxAttempts = 3,
        int $initialDelayMs = 100,
        float $multiplier = 2.0,
        int $maxDelayMs = 30000,
        ?array $retryableExceptions = null
    ): mixed {
        $attempt = 0;
        $delay = $initialDelayMs;
        $lastException = null;

        while ($attempt < $maxAttempts) {
            try {
                // Attempt execution
                $result = $callback();

                // Success - log if this was a retry
                if ($attempt > 0) {
                    Log::info("Retry succeeded", [
                        'attempt' => $attempt + 1,
                        'total_attempts' => $maxAttempts,
                    ]);
                }

                return $result;

            } catch (\Exception $e) {
                $lastException = $e;
                $attempt++;

                // Check if we should retry this exception
                if ($retryableExceptions !== null && !$this->isRetryable($e, $retryableExceptions)) {
                    Log::warning("Exception not retryable", [
                        'exception' => get_class($e),
                        'message' => $e->getMessage(),
                    ]);
                    throw $e;
                }

                // No more attempts
                if ($attempt >= $maxAttempts) {
                    Log::error("Max retry attempts reached", [
                        'attempts' => $maxAttempts,
                        'exception' => get_class($e),
                        'message' => $e->getMessage(),
                    ]);
                    break;
                }

                // Calculate delay with jitter
                $jitter = rand(0, (int)($delay * 0.1)); // 10% jitter
                $actualDelay = min($delay + $jitter, $maxDelayMs);

                Log::warning("Retry attempt failed, waiting before retry", [
                    'attempt' => $attempt,
                    'max_attempts' => $maxAttempts,
                    'delay_ms' => $actualDelay,
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                ]);

                // Sleep before retry
                usleep($actualDelay * 1000); // Convert ms to microseconds

                // Exponential backoff
                $delay = (int)($delay * $multiplier);
            }
        }

        // All attempts failed
        throw $lastException;
    }

    /**
     * Retry with custom retry condition
     *
     * @param callable $callback Function to retry
     * @param callable $shouldRetry Function that returns true if should retry
     * @param int $maxAttempts
     * @param int $initialDelayMs
     * @param float $multiplier
     * @return mixed
     * @throws \Exception
     */
    public function retryIf(
        callable $callback,
        callable $shouldRetry,
        int $maxAttempts = 3,
        int $initialDelayMs = 100,
        float $multiplier = 2.0
    ): mixed {
        $attempt = 0;
        $delay = $initialDelayMs;

        while ($attempt < $maxAttempts) {
            try {
                $result = $callback();

                // Check if we should retry based on result
                if ($attempt < $maxAttempts - 1 && $shouldRetry($result, null)) {
                    $attempt++;
                    usleep($delay * 1000);
                    $delay = (int)($delay * $multiplier);
                    continue;
                }

                return $result;

            } catch (\Exception $e) {
                $attempt++;

                if ($attempt >= $maxAttempts || !$shouldRetry(null, $e)) {
                    throw $e;
                }

                usleep($delay * 1000);
                $delay = (int)($delay * $multiplier);
            }
        }

        throw new \Exception("Max retry attempts reached");
    }

    /**
     * Retry HTTP requests specifically
     *
     * @param callable $callback
     * @param int $maxAttempts
     * @return mixed
     * @throws \Exception
     */
    public function retryHttp(callable $callback, int $maxAttempts = 3): mixed
    {
        $retryableStatuses = [408, 429, 500, 502, 503, 504];

        return $this->retryIf(
            $callback,
            function ($result, $exception) use ($retryableStatuses) {
                // Retry on exception
                if ($exception !== null) {
                    return $this->isRetryableHttpException($exception);
                }

                // Retry on specific HTTP status codes
                if (is_object($result) && method_exists($result, 'status')) {
                    return in_array($result->status(), $retryableStatuses, true);
                }

                return false;
            },
            $maxAttempts,
            1000, // 1 second initial delay for HTTP
            2.0
        );
    }

    /**
     * Check if exception is retryable
     *
     * @param \Exception $exception
     * @param array $retryableExceptions
     * @return bool
     */
    protected function isRetryable(\Exception $exception, array $retryableExceptions): bool
    {
        foreach ($retryableExceptions as $retryableClass) {
            if ($exception instanceof $retryableClass) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if HTTP exception is retryable
     *
     * @param \Exception $exception
     * @return bool
     */
    protected function isRetryableHttpException(\Exception $exception): bool
    {
        // Connection timeout
        if (str_contains($exception->getMessage(), 'timeout')) {
            return true;
        }

        // Connection refused
        if (str_contains($exception->getMessage(), 'Connection refused')) {
            return true;
        }

        // DNS lookup failure
        if (str_contains($exception->getMessage(), 'Could not resolve host')) {
            return true;
        }

        return false;
    }

    /**
     * Retry database operations
     *
     * @param callable $callback
     * @param int $maxAttempts
     * @return mixed
     * @throws \Exception
     */
    public function retryDatabase(callable $callback, int $maxAttempts = 3): mixed
    {
        return $this->retry(
            $callback,
            $maxAttempts,
            50, // 50ms initial delay
            2.0,
            5000, // Max 5 seconds
            [
                \Illuminate\Database\QueryException::class,
                \PDOException::class,
            ]
        );
    }
}
