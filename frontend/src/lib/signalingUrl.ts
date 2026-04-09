/**
 * Convert Laravel `services.signaling.url` (http/https) to the WebSocket URL
 * the browser uses (path `/ws` matches signaling server).
 */
export function httpSignalingUrlToWebSocket(httpOrWsBase: string): string {
  const u = httpOrWsBase.trim();
  if (!u) {
    return 'ws://localhost:4000/ws';
  }
  if (u.startsWith('ws://') || u.startsWith('wss://')) {
    return u.endsWith('/ws') ? u : `${u.replace(/\/$/, '')}/ws`;
  }
  const ws = u.replace(/^http/, 'ws');
  return ws.endsWith('/ws') ? ws : `${ws.replace(/\/$/, '')}/ws`;
}
