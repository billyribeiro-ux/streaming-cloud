/**
 * API Client - Typed fetch wrapper for backend communication
 *
 * Features:
 * - Auto-attaches Authorization header from localStorage
 * - Handles 401 by redirecting to /login
 * - JSON serialization/deserialization
 * - Typed response generics
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  method: string,
  url: string,
  data?: unknown,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem('auth-token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
    ...options,
  };

  if (data && method !== 'GET' && method !== 'HEAD') {
    config.body = JSON.stringify(data);
  }

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, config);

  if (response.status === 401) {
    localStorage.removeItem('auth-token');
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    let errorData: { message?: string } = {};
    try {
      errorData = await response.json();
    } catch {
      // Response body is not JSON
    }
    const message =
      errorData.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>('GET', url, undefined, options),

  post: <T>(url: string, data?: unknown, options?: RequestInit) =>
    request<T>('POST', url, data, options),

  put: <T>(url: string, data?: unknown, options?: RequestInit) =>
    request<T>('PUT', url, data, options),

  patch: <T>(url: string, data?: unknown, options?: RequestInit) =>
    request<T>('PATCH', url, data, options),

  delete: <T>(url: string, options?: RequestInit) =>
    request<T>('DELETE', url, undefined, options),
};

export { ApiError };
export default api;
