/**
 * SignalingClient - Framework-agnostic WebSocket signaling for WebRTC
 *
 * Pure TypeScript class with:
 * - Auto-reconnect with exponential backoff (10 attempts, 500ms base)
 * - Heartbeat ping every 10 seconds
 * - JSON serialize/deserialize
 * - Event emitter pattern with on/off/once
 */

export type SignalingEvent =
  | 'open'
  | 'close'
  | 'error'
  | 'message'
  // Server events
  | 'authenticated'
  | 'room-joined'
  | 'transport-created'
  | 'transport-connected'
  | 'produced'
  | 'consumer-created'
  | 'new-producer'
  | 'participant-joined'
  | 'participant-left'
  | 'producer-paused'
  | 'producer-resumed'
  | 'producer-closed';

export type SignalingHandler = (data: any) => void;

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 16000;
const HEARTBEAT_INTERVAL = 10000;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  private listeners = new Map<string, Set<SignalingHandler>>();
  private onceListeners = new Map<string, SignalingHandler[]>();

  public isConnected = false;
  public isReconnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    // Clean up existing connection
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
    }

    this.intentionalClose = false;

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[Signaling] Connected');
        this.isConnected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('open', undefined);
      };

      ws.onclose = () => {
        console.log('[Signaling] Disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('close', undefined);

        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error('[Signaling] Error:', error);
        this.emit('error', error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Skip pong messages
          if (message.event === 'pong') return;

          // Check for one-time handlers first
          const onceHandlers = this.onceListeners.get(message.event);
          if (onceHandlers && onceHandlers.length > 0) {
            const handler = onceHandlers.shift()!;
            if (onceHandlers.length === 0) {
              this.onceListeners.delete(message.event);
            }
            handler(message);
          }

          // Emit typed event
          this.emit(message.event, message.data);

          // Also emit generic 'message' for catch-all handling
          this.emit('message', message);
        } catch (err) {
          console.error('[Signaling] Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('[Signaling] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.intentionalClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.onceListeners.clear();
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[Signaling] Cannot send - not connected');
    }
  }

  on(event: string, handler: SignalingHandler): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  off(event: string, handler: SignalingHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once(event: string, handler: SignalingHandler): void {
    const handlers = this.onceListeners.get(event) || [];
    handlers.push(handler);
    this.onceListeners.set(event, handlers);
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (
      this.intentionalClose ||
      this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS
    ) {
      console.warn(
        '[Signaling] Max reconnection attempts reached or intentionally closed',
      );
      this.isReconnecting = false;
      return;
    }

    this.isReconnecting = true;

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );

    console.log(
      `[Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts += 1;
      this.connect();
    }, delay);
  }
}
