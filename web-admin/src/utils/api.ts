/**
 * Centralized API URL & Auth Token Helper for Web Admin.
 *
 * Canonical Convention:
 * - `getApiBaseUrl()` always returns the backend ORIGIN ONLY (e.g. `https://backend.example.com` or `''` for same-origin proxy),
 *   automatically stripping any trailing `/`, `/api/v1`, or `/api` from `VITE_API_URL`.
 * - `buildApiUrl(path)` ensures the path begins with a single `/api/v1/` prefix and never duplicates `/api/v1/api/v1`.
 */
export function normalizeBaseOrigin(rawBaseUrl?: string | null): string {
  if (typeof rawBaseUrl !== 'string') return '';
  let cleaned = rawBaseUrl.trim();
  if (!cleaned) return '';

  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');

  // Repeatedly strip any trailing `/api/v1` or `/api` from the configured base URL
  while (/\/api(\/v1)?$/i.test(cleaned)) {
    cleaned = cleaned.replace(/\/api(\/v1)?$/i, '').replace(/\/+$/, '');
  }

  return cleaned;
}

export function getApiBaseUrl(overrideEnvUrl?: string): string {
  const envUrl =
    overrideEnvUrl !== undefined
      ? overrideEnvUrl
      : (import.meta as any).env?.VITE_API_URL;
  return normalizeBaseOrigin(envUrl);
}

export function buildApiUrl(path: string, overrideEnvUrl?: string): string {
  const base = getApiBaseUrl(overrideEnvUrl);
  let cleanPath = String(path || '').trim();

  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // Collapse any accidental duplicate `/api/v1/api/v1` or `/api/api/v1` prefixes
  cleanPath = cleanPath.replace(/^(\/api(\/v1)?)+(?=\/|$)/i, '/api/v1');

  // Ensure API paths always begin with `/api/v1`
  if (!cleanPath.startsWith('/api/v1')) {
    cleanPath = `/api/v1${cleanPath}`;
  }

  return `${base}${cleanPath}`;
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token =
    sessionStorage.getItem('aotuc_auth_token') ||
    localStorage.getItem('aotuc_auth_token');
  if (!token || token === 'session-token' || token === 'mock-jwt-token-aotuc-2026') {
    return null;
  }
  return token;
}

export function getStoredAuthUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('aotuc_user') || localStorage.getItem('aotuc_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function storeAuthToken(token: string, persistToLocalStorage = false): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('aotuc_auth_token', token);
  if (persistToLocalStorage) {
    localStorage.setItem('aotuc_auth_token', token);
  }
}

export async function parseApiResponse<T = any>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch (_) {
    return null;
  }
}
