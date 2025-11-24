<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\TracingService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Distributed Tracing Middleware
 *
 * Automatically creates trace spans for all HTTP requests
 * Propagates trace context to downstream services
 */
class TracingMiddleware
{
    public function __construct(
        private readonly TracingService $tracingService
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Start or continue trace
        $trace = $this->tracingService->startTrace($request);

        // Create span for this request
        $span = $this->tracingService->createSpan(
            $trace['traceId'],
            $trace['parentSpanId'] ?? $trace['spanId'],
            'http.server.request',
            [
                'http.method' => $request->method(),
                'http.route' => $request->route()?->uri() ?? $request->path(),
                'http.url' => $request->fullUrl(),
                'http.user_agent' => $request->userAgent(),
                'http.client_ip' => $request->ip(),
            ]
        );

        // Store trace context in request for use by other services
        $request->attributes->set('trace', $trace);
        $request->attributes->set('span', $span);

        try {
            $response = $next($request);

            // Finish span with success
            $this->tracingService->finishSpan($span, $response->status());

            // Add trace headers to response for debugging
            $response->headers->set(
                'X-Trace-Id',
                $trace['traceId']
            );
            $response->headers->set(
                'X-Span-Id',
                $span['spanId']
            );

            return $response;
        } catch (\Exception $e) {
            // Finish span with error
            $this->tracingService->finishSpan(
                $span,
                500,
                $e->getMessage()
            );

            throw $e;
        }
    }
}
