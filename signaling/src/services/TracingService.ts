/**
 * OpenTelemetry-Compatible Tracing Service
 *
 * Provides distributed tracing across all Node.js services
 * Implements W3C Trace Context propagation standard
 */

import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import { RedisService } from './RedisService.js';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  attributes: Record<string, any>;
}

export interface SpanData extends Span {
  endTime: number;
  duration: number;
  status: 'ok' | 'error';
  statusCode?: number;
  error?: string;
}

export class TracingService {
  private static readonly TRACE_PARENT_HEADER = 'traceparent';
  private static readonly TRACE_STATE_HEADER = 'tracestate';

  constructor(private redis: RedisService | null) {}

  /**
   * Start a new trace or continue existing one from headers
   */
  startTrace(headers: Record<string, string | undefined>): TraceContext {
    const traceParent = headers[TracingService.TRACE_PARENT_HEADER] ||
                        headers['traceparent'];

    if (traceParent) {
      return this.parseTraceParent(traceParent);
    }

    // Start new trace
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
    };
  }

  /**
   * Create a child span within a trace
   */
  createSpan(
    traceId: string,
    parentSpanId: string,
    operationName: string,
    attributes: Record<string, any> = {}
  ): Span {
    return {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
      operationName,
      startTime: Date.now(),
      attributes,
    };
  }

  /**
   * Finish a span and export it
   */
  finishSpan(span: Span, statusCode?: number, error?: string): void {
    const endTime = Date.now();
    const duration = endTime - span.startTime;

    const spanData: SpanData = {
      ...span,
      endTime,
      duration,
      status: error ? 'error' : 'ok',
      statusCode,
      error,
    };

    logger.info('Trace span completed', {
      trace_id: spanData.traceId,
      span_id: spanData.spanId,
      parent_span_id: spanData.parentSpanId,
      operation: spanData.operationName,
      duration_ms: spanData.duration,
      status: spanData.status,
    });

    // Export to collector
    this.exportSpan(spanData);
  }

  /**
   * Create W3C trace parent header for downstream services
   */
  createTraceParentHeader(traceId: string, spanId: string): string {
    // Format: version-traceid-spanid-flags
    return `00-${traceId}-${spanId}-01`;
  }

  /**
   * Get trace headers for HTTP client
   */
  getTraceHeaders(traceId: string, spanId: string): Record<string, string> {
    return {
      [TracingService.TRACE_PARENT_HEADER]: this.createTraceParentHeader(traceId, spanId),
    };
  }

  /**
   * Record a WebSocket event
   */
  recordWebSocketEvent(
    traceId: string,
    spanId: string,
    event: string,
    clientId: string,
    userId?: string
  ): void {
    const wsSpan = this.createSpan(traceId, spanId, `ws.${event}`, {
      'ws.event': event,
      'ws.client_id': clientId,
      'ws.user_id': userId,
    });

    this.finishSpan(wsSpan);
  }

  /**
   * Record a database operation
   */
  recordDatabaseOperation(
    traceId: string,
    spanId: string,
    operation: string,
    table: string,
    duration: number
  ): void {
    const dbSpan = this.createSpan(traceId, spanId, 'db.operation', {
      'db.system': 'redis',
      'db.operation': operation,
      'db.table': table,
    });

    dbSpan.startTime = Date.now() - duration;
    this.finishSpan(dbSpan);
  }

  /**
   * Record an HTTP call to external service
   */
  recordHttpCall(
    traceId: string,
    spanId: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number
  ): void {
    const httpSpan = this.createSpan(traceId, spanId, 'http.client', {
      'http.method': method,
      'http.url': url,
      'http.status_code': statusCode,
    });

    httpSpan.startTime = Date.now() - duration;
    this.finishSpan(httpSpan, statusCode);
  }

  /**
   * Record SFU operation (Mediasoup)
   */
  recordSFUOperation(
    traceId: string,
    spanId: string,
    operation: string,
    roomId: string,
    participantId?: string
  ): void {
    const sfuSpan = this.createSpan(traceId, spanId, `sfu.${operation}`, {
      'sfu.operation': operation,
      'sfu.room_id': roomId,
      'sfu.participant_id': participantId,
    });

    this.finishSpan(sfuSpan);
  }

  /**
   * Parse W3C trace parent header
   */
  private parseTraceParent(traceParent: string): TraceContext {
    // Format: 00-traceId-spanId-flags
    const parts = traceParent.split('-');

    if (parts.length !== 4) {
      // Invalid format, start new trace
      return {
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
      };
    }

    return {
      traceId: parts[1],
      spanId: this.generateSpanId(),
      parentSpanId: parts[2],
    };
  }

  /**
   * Generate unique trace ID (128-bit / 32 hex chars)
   */
  private generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate unique span ID (64-bit / 16 hex chars)
   */
  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Export span to OpenTelemetry collector
   */
  private exportSpan(spanData: SpanData): void {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!endpoint) {
      // No collector configured, skip export
      return;
    }

    // Store in Redis for batch export
    if (this.redis) {
      const key = `otel:spans:${new Date().toISOString().substring(0, 16).replace(/[-:T]/g, '')}`;
      this.redis.set(key, JSON.stringify(spanData), 300).catch((err) => {
        logger.error({ err }, 'Failed to export span');
      });
    }

    // In production, send to OTLP endpoint via HTTP
    // This could be done with a batch processor to reduce overhead
  }
}
