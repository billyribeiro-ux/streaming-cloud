<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Advanced Rate Limiting Middleware
 *
 * Implements per-user and per-IP rate limiting to prevent abuse
 * and ensure fair resource distribution
 *
 * Features:
 * - Per-user limits (authenticated requests)
 * - Per-IP limits (anonymous requests)
 * - Custom limits per route
 * - Informative rate limit headers
 * - Configurable limits via environment
 *
 * @package App\Http\Middleware
 */
class RateLimitMiddleware
{
    /**
     * Handle an incoming request
     *
     * @param Request $request
     * @param Closure $next
     * @param int|null $maxAttempts Maximum attempts per minute
     * @param int|null $decayMinutes Minutes before counter resets
     * @return Response
     */
    public function handle(
        Request $request,
        Closure $next,
        ?int $maxAttempts = null,
        ?int $decayMinutes = null
    ): Response {
        $key = $this->resolveRequestSignature($request);

        // Default limits (can be overridden per route)
        $maxAttempts = $maxAttempts ?? $this->getMaxAttempts($request);
        $decayMinutes = $decayMinutes ?? 1;

        // Check if rate limit exceeded
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            return $this->buildRateLimitExceededResponse($key, $maxAttempts);
        }

        // Increment attempt counter
        RateLimiter::hit($key, $decayMinutes * 60);

        // Process request
        $response = $next($request);

        // Add rate limit headers
        return $this->addRateLimitHeaders(
            $response,
            $key,
            $maxAttempts,
            $decayMinutes
        );
    }

    /**
     * Resolve unique request signature
     *
     * Uses user ID for authenticated requests,
     * falls back to IP address for anonymous requests
     *
     * @param Request $request
     * @return string
     */
    protected function resolveRequestSignature(Request $request): string
    {
        if ($user = $request->user()) {
            return 'api-limit:user:' . $user->id;
        }

        return 'api-limit:ip:' . $request->ip();
    }

    /**
     * Get maximum attempts based on authentication status
     *
     * Authenticated users get higher limits
     *
     * @param Request $request
     * @return int
     */
    protected function getMaxAttempts(Request $request): int
    {
        if ($user = $request->user()) {
            // Authenticated users: 1000 requests per minute
            return (int) env('RATE_LIMIT_AUTHENTICATED', 1000);
        }

        // Anonymous users: 60 requests per minute
        return (int) env('RATE_LIMIT_ANONYMOUS', 60);
    }

    /**
     * Build rate limit exceeded response
     *
     * @param string $key
     * @param int $maxAttempts
     * @return Response
     */
    protected function buildRateLimitExceededResponse(
        string $key,
        int $maxAttempts
    ): Response {
        $retryAfter = RateLimiter::availableIn($key);

        return response()->json([
            'error' => 'Too many requests',
            'message' => 'Rate limit exceeded. Please try again later.',
            'retry_after' => $retryAfter,
            'retry_after_human' => $this->formatRetryAfter($retryAfter),
        ], 429)->withHeaders([
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => 0,
            'X-RateLimit-Reset' => now()->addSeconds($retryAfter)->timestamp,
        ]);
    }

    /**
     * Add rate limit headers to response
     *
     * @param Response $response
     * @param string $key
     * @param int $maxAttempts
     * @param int $decayMinutes
     * @return Response
     */
    protected function addRateLimitHeaders(
        Response $response,
        string $key,
        int $maxAttempts,
        int $decayMinutes
    ): Response {
        $remaining = RateLimiter::remaining($key, $maxAttempts);
        $resetAt = now()->addSeconds($decayMinutes * 60)->timestamp;

        $response->headers->set('X-RateLimit-Limit', $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining', max(0, $remaining));
        $response->headers->set('X-RateLimit-Reset', $resetAt);

        return $response;
    }

    /**
     * Format retry after duration in human-readable format
     *
     * @param int $seconds
     * @return string
     */
    protected function formatRetryAfter(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds} seconds";
        }

        $minutes = ceil($seconds / 60);
        return "{$minutes} minutes";
    }
}
