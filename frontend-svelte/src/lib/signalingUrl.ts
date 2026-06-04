/**
 * Converts a signaling HTTP(S) base URL to the WebSocket endpoint the browser
 * connects to (e.g. `https://signaling.example.com` → `wss://…/ws`).
 */
export function toWebSocketUrl(base: string): string {
  let url = base.trim();
  if (url.startsWith('https://')) {
    url = `wss://${url.slice('https://'.length)}`;
  } else if (url.startsWith('http://')) {
    url = `ws://${url.slice('http://'.length)}`;
  }
  url = url.replace(/\/+$/, '');
  return url.endsWith('/ws') ? url : `${url}/ws`;
}
