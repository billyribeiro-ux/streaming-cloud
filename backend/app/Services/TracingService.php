<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;

/**
 * OpenTelemetry-Compatible Tracing Service
 *
 * Provides distributed tracing capabilities following OpenTelemetry standards.
 * Tracks request flow across microservices for debugging and performance analysis.
 *
 * Key Features:
 * - Trace context propagation (W3C Trace Context)
 * - Span creation and management
 * - Service-to-service correlation
 * - Performance metrics per span
 */
class TracingService
{
    private const TRACE_PARENT_HEADER = 'traceparent';
    private const TRACE_STATE_HEADER = 'tracestate';

    /**
     * Start a new trace or continue existing one
     *
     * @param Request $request
     * @return array{traceId: string, spanId: string, parentSpanId: string|null}
     */
    public function startTrace(Request $request): array
    {
        // Check if trace context exists in headers (W3C Trace Context format)
        $traceParent = $request->header(self::TRACE_PARENT_HEADER);

        if ($traceParent) {
            // Continue existing trace
            return $this->parseTraceParent($traceParent);
        }

        // Start new trace
        $traceId = $this->generateTraceId();
        $spanId = $this->generateSpanId();

        return [
            'traceId' => $traceId,
            'spanId' => $spanId,
            'parentSpanId' => null,
        ];
    }

    /**
     * Create a child span within a trace
     *
     * @param string $traceId
     * @param string $parentSpanId
     * @param string $operationName
     * @param array $attributes
     * @return array
     */
    public function createSpan(
        string $traceId,
        string $parentSpanId,
        string $operationName,
        array $attributes = []
    ): array {
        $spanId = $this->generateSpanId();
        $startTime = microtime(true);

        return [
            'traceId' => $traceId,
            'spanId' => $spanId,
            'parentSpanId' => $parentSpanId,
            'operationName' => $operationName,
            'startTime' => $startTime,
            'attributes' => $attributes,
        ];
    }

    /**
     * Finish a span and record metrics
     *
     * @param array $span
     * @param int|null $statusCode
     * @param string|null $error
     */
    public function finishSpan(array $span, ?int $statusCode = null, ?string $error = null): void
    {
        $endTime = microtime(true);
        $duration = ($endTime - $span['startTime']) * 1000; // Convert to milliseconds

        $spanData = [
            'trace_id' => $span['traceId'],
            'span_id' => $span['spanId'],
            'parent_span_id' => $span['parentSpanId'],
            'operation_name' => $span['operationName'],
            'duration_ms' => round($duration, 2),
            'status_code' => $statusCode,
            'attributes' => $span['attributes'],
        ];

        if ($error) {
            $spanData['error'] = $error;
            $spanData['status'] = 'error';
        } else {
            $spanData['status'] = 'ok';
        }

        // Log span data (in production, send to OpenTelemetry collector)
        Log::info('Trace span completed', $spanData);

        // In production, export to OpenTelemetry collector
        $this->exportSpan($spanData);
    }

    /**
     * Create trace parent header for downstream services
     *
     * @param string $traceId
     * @param string $spanId
     * @return string
     */
    public function createTraceParentHeader(string $traceId, string $spanId): string
    {
        // W3C Trace Context format: version-traceid-spanid-flags
        return sprintf('00-%s-%s-01', $traceId, $spanId);
    }

    /**
     * Get trace context for HTTP client
     *
     * @param string $traceId
     * @param string $spanId
     * @return array
     */
    public function getTraceHeaders(string $traceId, string $spanId): array
    {
        return [
            self::TRACE_PARENT_HEADER => $this->createTraceParentHeader($traceId, $spanId),
        ];
    }

    /**
     * Parse W3C trace parent header
     *
     * @param string $traceParent
     * @return array
     */
    private function parseTraceParent(string $traceParent): array
    {
        // Format: 00-traceId-spanId-flags
        $parts = explode('-', $traceParent);

        if (count($parts) !== 4) {
            // Invalid format, start new trace
            return [
                'traceId' => $this->generateTraceId(),
                'spanId' => $this->generateSpanId(),
                'parentSpanId' => null,
            ];
        }

        return [
            'traceId' => $parts[1],
            'spanId' => $this->generateSpanId(),
            'parentSpanId' => $parts[2],
        ];
    }

    /**
     * Generate unique trace ID (128-bit)
     *
     * @return string
     */
    private function generateTraceId(): string
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Generate unique span ID (64-bit)
     *
     * @return string
     */
    private function generateSpanId(): string
    {
        return bin2hex(random_bytes(8));
    }

    /**
     * Export span to OpenTelemetry collector
     *
     * In production, this would send data to an OTLP endpoint
     * (e.g., Jaeger, Tempo, or managed service like Honeycomb)
     *
     * @param array $spanData
     */
    private function exportSpan(array $spanData): void
    {
        $endpoint = env('OTEL_EXPORTER_OTLP_ENDPOINT');

        if (!$endpoint) {
            // No collector configured, skip export
            return;
        }

        // In production, use async HTTP client to send to collector
        // For now, we'll just store in Redis for batch export
        $key = 'otel:spans:' . date('YmdHi');
        \Illuminate\Support\Facades\Redis::rpush($key, json_encode($spanData));
        \Illuminate\Support\Facades\Redis::expire($key, 300); // 5 minute TTL
    }

    /**
     * Add database query to current span
     *
     * @param string $traceId
     * @param string $spanId
     * @param string $query
     * @param array $bindings
     * @param float $time
     */
    public function recordDatabaseQuery(
        string $traceId,
        string $spanId,
        string $query,
        array $bindings,
        float $time
    ): void {
        $querySpan = $this->createSpan($traceId, $spanId, 'db.query', [
            'db.system' => 'postgresql',
            'db.statement' => $query,
            'db.parameters' => json_encode($bindings),
        ]);

        // Simulate span timing
        $querySpan['startTime'] = microtime(true) - ($time / 1000);
        $this->finishSpan($querySpan);
    }

    /**
     * Add cache access to current span
     *
     * @param string $traceId
     * @param string $spanId
     * @param string $operation
     * @param string $key
     * @param bool $hit
     */
    public function recordCacheAccess(
        string $traceId,
        string $spanId,
        string $operation,
        string $key,
        bool $hit
    ): void {
        $cacheSpan = $this->createSpan($traceId, $spanId, 'cache.' . $operation, [
            'cache.key' => $key,
            'cache.hit' => $hit,
        ]);

        $this->finishSpan($cacheSpan);
    }

    /**
     * Add external HTTP call to current span
     *
     * @param string $traceId
     * @param string $spanId
     * @param string $method
     * @param string $url
     * @param int $statusCode
     * @param float $duration
     */
    public function recordHttpCall(
        string $traceId,
        string $spanId,
        string $method,
        string $url,
        int $statusCode,
        float $duration
    ): void {
        $httpSpan = $this->createSpan($traceId, $spanId, 'http.client', [
            'http.method' => $method,
            'http.url' => $url,
            'http.status_code' => $statusCode,
        ]);

        $httpSpan['startTime'] = microtime(true) - ($duration / 1000);
        $this->finishSpan($httpSpan, $statusCode);
    }
}
