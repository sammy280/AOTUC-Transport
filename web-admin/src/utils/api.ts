/**
 * Centralized API helper for Web Admin.
 * Supports same-origin proxy (`/api/v1/...`) as well as separate hosted backend URLs via `VITE_API_URL`.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
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

export function storeAuthToken(token: string, persistToLocalStorage = false): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('aotuc_auth_token', token);
  if (persistToLocalStorage) {
    localStorage.setItem('aotuc_auth_token', token);
  }
}
