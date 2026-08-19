/**
 * MKUU AI — Production API Configuration & Server Resolver
 *
 * Centralized production HTTPS API configuration for MKUU AI Android APK and Web clients.
 * Flow: MKUU APK -> HTTPS Backend -> GeminiService -> Google Gemini API
 */

// Working production Vercel backend/frontend origin used by the APK.
// The web build can still override this with VITE_PUBLIC_API_URL.
export const DEFAULT_PUBLIC_BACKEND_URL = (import.meta as any).env?.VITE_PUBLIC_API_URL || 'https://mkuu-al-y98p.vercel.app';

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';
export const STORAGE_SERVER_KEY_CUSTOM = 'mkuu_backend_api_url_v1';

export type ApiErrorCode =
  | 'NO_INTERNET'
  | 'BACKEND_UNREACHABLE'
  | 'GEMINI_UNAVAILABLE'
  | 'DNS_FAILURE'
  | 'TLS_FAILURE'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_429'
  | 'HTTP_500'
  | 'HTTP_502'
  | 'HTTP_503'
  | 'TIMEOUT'
  | 'AUTH_REDIRECT'
  | 'UNKNOWN';

export class MkuuApiError extends Error {
  public code: ApiErrorCode;
  public status?: number;
  public technicalDetails: string;
  public userMessage: string;
  public targetUrl: string;
  public isRetryable: boolean;

  constructor(params: { code: ApiErrorCode; userMessage: string; technicalDetails: string; targetUrl: string; status?: number; isRetryable?: boolean }) {
    super(params.userMessage);
    this.name = 'MkuuApiError';
    this.code = params.code;
    this.status = params.status;
    this.technicalDetails = params.technicalDetails;
    this.userMessage = params.userMessage;
    this.targetUrl = params.targetUrl;
    this.isRetryable = params.isRetryable ?? true;
  }
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') return true;
  if (window.location.hostname === 'localhost' && !window.location.port) return true;
  return false;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if (custom && custom.trim().startsWith('http')) return custom.trim().replace(/\/+$/, '');

  const envUrl = (import.meta as any).env?.VITE_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) return envUrl.trim().replace(/\/+$/, '');

  if (!isCapacitorNative()) return '';
  return DEFAULT_PUBLIC_BACKEND_URL;
}

export const PRODUCTION_API_BASE_URL = getApiBaseUrl() || DEFAULT_PUBLIC_BACKEND_URL;

export function getRemoteServerUrl(): string { return getApiBaseUrl(); }

export function setRemoteServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) localStorage.removeItem(STORAGE_SERVER_URL_KEY);
  else localStorage.setItem(STORAGE_SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
}

export function getApiUrl(endpoint: string, explicitBase?: string): string {
  if (!endpoint) return explicitBase || getApiBaseUrl();
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.startsWith('blob:') || endpoint.startsWith('data:')) return endpoint;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = explicitBase !== undefined ? explicitBase : getApiBaseUrl();
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
}

export async function checkServerReachability(): Promise<{ reachable: boolean; latencyMs: number; status?: string; error?: string }> {
  const start = Date.now();
  try {
    const data = await apiFetch<{ status: string; chatModel?: string; service?: string }>('/health', {}, 8000);
    return { reachable: !!data && (data.status === 'ok' || data.status === 'connected'), status: data.status, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { reachable: false, latencyMs: Date.now() - start, error: err.userMessage || err.message || 'Haikuweza kufikia seva ya MKUU' };
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit, timeoutMs = 45000): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isDeviceOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isDeviceOnline) throw new MkuuApiError({ code: 'NO_INTERNET', userMessage: 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.', technicalDetails: 'Kifaa chako hakina muunganisho wa intaneti.', targetUrl: cleanEndpoint });

  const candidateBases: string[] = [];
  const custom = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_SERVER_KEY_CUSTOM) : null;
  if (custom && custom.trim().startsWith('http')) candidateBases.push(custom.trim().replace(/\/+$/, ''));
  if (DEFAULT_PUBLIC_BACKEND_URL && DEFAULT_PUBLIC_BACKEND_URL.startsWith('http')) candidateBases.push(DEFAULT_PUBLIC_BACKEND_URL.replace(/\/+$/, ''));
  if (!isCapacitorNative()) candidateBases.push('');
  if (isCapacitorNative() && candidateBases.length === 0) throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: 'Hakuna public backend URL iliyosanidiwa.', targetUrl: cleanEndpoint });

  const uniqueBases = Array.from(new Set(candidateBases));
  let lastError: MkuuApiError | null = null;

  for (const base of uniqueBases) {
    const targetUrl = getApiUrl(cleanEndpoint, base);
    const headers: Record<string, string> = { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache', ...((options?.headers as Record<string, string>) || {}) };
    if (options?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      let isTimedOut = false;
      const timeoutId = setTimeout(() => { isTimedOut = true; controller.abort(); }, timeoutMs);
      try {
        const response = await fetch(targetUrl, { ...options, headers, cache: 'no-store', signal: options?.signal || controller.signal });
        clearTimeout(timeoutId);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok) {
          let errorDetail = `HTTP ${response.status} ${response.statusText}`;
          let isGeminiError = false;
          if (contentType.includes('application/json')) {
            try {
              const errorJson = await response.json();
              if (errorJson.error) {
                errorDetail = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
                isGeminiError = errorJson.error === 'GEMINI_UNAVAILABLE' || errorDetail.toLowerCase().includes('gemini') || errorDetail.toLowerCase().includes('generativelanguage') || errorDetail.toLowerCase().includes('model');
              }
            } catch (_) {}
          }
          if (isGeminiError || response.status === 503) throw new MkuuApiError({ code: 'GEMINI_UNAVAILABLE', status: response.status, userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.', technicalDetails: errorDetail, targetUrl });
          if (response.status === 429) throw new MkuuApiError({ code: 'GEMINI_UNAVAILABLE', status: response.status, userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.', technicalDetails: 'Rate limit 429.', targetUrl });
          throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', status: response.status, userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: errorDetail, targetUrl, isRetryable: response.status !== 401 });
        }
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          try { return JSON.parse(text) as T; } catch (_) { throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', status: response.status, userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: 'Invalid JSON payload received from backend', targetUrl }); }
        }
        return (await response.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err instanceof MkuuApiError) {
          lastError = err;
          if (err.code === 'NO_INTERNET' || err.code === 'GEMINI_UNAVAILABLE') throw err;
        } else if (isTimedOut || err.name === 'AbortError') {
          lastError = new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: `Request timeout after ${timeoutMs}ms`, targetUrl });
        } else {
          lastError = new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: err.message || 'Failed to fetch', targetUrl });
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw lastError || new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: 'All candidate endpoints failed to connect', targetUrl: cleanEndpoint });
}
