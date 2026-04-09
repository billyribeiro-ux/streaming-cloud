/**
 * useSignaling Hook - WebSocket Signaling Connection
 *
 * Manages WebSocket connection lifecycle for WebRTC signaling:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat ping every 30 seconds
 * - JSON serialization/deserialization
 * - One-time event listeners
 * - Cleanup on unmount
 */

import { useRef, useCallback, useEffect } from 'react';

interface SignalingOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: any) => void;
}

interface SignalingReturn {
  connect: () => void;
  disconnect: () => void;
  send: (data: any) => void;
  once: (event: string, handler: (message: any) => void) => void;
  isConnected: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 16000;
const HEARTBEAT_INTERVAL = 10000;

export function useSignaling(options: SignalingOptions): SignalingReturn {
  const { url, onOpen, onClose, onError, onMessage } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectedRef = useRef(false);
  const isIntentionalCloseRef = useRef(false);
  const onceHandlersRef = useRef<Map<string, ((message: any) => void)[]>>(
    new Map()
  );

  // Store latest callbacks in refs to avoid stale closures
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);

  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  onErrorRef.current = onError;
  onMessageRef.current = onMessage;

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (
      isIntentionalCloseRef.current ||
      reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS
    ) {
      console.warn(
        '[Signaling] Max reconnection attempts reached or intentionally closed'
      );
      return;
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );

    console.log(
      `[Signaling] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
    }

    isIntentionalCloseRef.current = false;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Signaling] Connected');
        isConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        onOpenRef.current?.();
      };

      ws.onclose = () => {
        console.log('[Signaling] Disconnected');
        isConnectedRef.current = false;
        stopHeartbeat();
        onCloseRef.current?.();

        if (!isIntentionalCloseRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error('[Signaling] Error:', error);
        onErrorRef.current?.(error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Skip pong messages
          if (message.event === 'pong') return;

          // Check for one-time handlers
          const handlers = onceHandlersRef.current.get(message.event);
          if (handlers && handlers.length > 0) {
            const handler = handlers.shift()!;
            if (handlers.length === 0) {
              onceHandlersRef.current.delete(message.event);
            }
            handler(message);
          }

          // Forward to general message handler
          onMessageRef.current?.(message);
        } catch (err) {
          console.error('[Signaling] Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('[Signaling] Failed to create WebSocket:', err);
      scheduleReconnect();
    }
  }, [url, startHeartbeat, stopHeartbeat, scheduleReconnect]);

  const disconnect = useCallback(() => {
    isIntentionalCloseRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    isConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    onceHandlersRef.current.clear();
  }, [stopHeartbeat]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[Signaling] Cannot send - not connected');
    }
  }, []);

  const once = useCallback(
    (event: string, handler: (message: any) => void) => {
      const handlers = onceHandlersRef.current.get(event) || [];
      handlers.push(handler);
      onceHandlersRef.current.set(event, handlers);
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    send,
    once,
    get isConnected() {
      return isConnectedRef.current;
    },
  };
}
