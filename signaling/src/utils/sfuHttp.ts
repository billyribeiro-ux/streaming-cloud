/**
 * HTTP client for mediasoup SFU control plane (server-to-server).
 */

const CONTROL_SECRET =
  process.env.SIGNALING_SERVER_SECRET ||
  process.env.SFU_SECRET ||
  'dev-secret';

export async function sfuFetch<T>(
  sfuHttpOrigin: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${sfuHttpOrigin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${CONTROL_SECRET}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `SFU ${init.method || 'GET'} ${path} failed: ${res.status} ${text}`
    );
  }
  if (!text) return undefined as T;
  const parsed: unknown = JSON.parse(text);
  if (parsed === null) return null as T;
  return parsed as T;
}
