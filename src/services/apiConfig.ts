/**
 * MKUU AI — Production API Configuration & Server Resolver
 * 
 * Centralized production HTTPS API configuration for MKUU AI Android APK and Web clients.
 * Flow: MKUU APK -> HTTPS Backend -> GeminiService -> Google Gemini API -> Gemini 3.7 Flash
 */

// Production Public Backend URL (e.g. Render, Vercel, or custom domain)
export const DEFAULT_PUBLIC_BACKEND_URL = (import.meta as any).env?.VITE_PUBLIC_API_URL || '';

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

  constructor(params: {
    code: ApiErrorCode;
    userMessage: string;
    technicalDetails: string;
    targetUrl: string;
    status?: number;
    isRetryable?: boolean;
  }) {
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

/**
 * Detect if running inside native Capacitor environment (Android APK / Local WebView)
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
    return true;
  }
  if (window.location.hostname === 'localhost' && !window.location.port) {
    return true;
  }
  return false;
}

/**
 * Returns configured API Base URL
 * - 1. User custom override in settings (Max Security & Owner Center)
 * - 2. Build-time environment variable VITE_PUBLIC_API_URL
 * - 3. Web browser context: same-origin relative ''
 * - 4. Capacitor Android APK standalone mode
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. User custom override in settings
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if (custom && custom.trim().startsWith('http')) {
    return custom.trim().replace(/\/+$/, '');
  }

  // 2. Build-time environment variable
  const envUrl = (import.meta as any).env?.VITE_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Web browser context (same origin)
  if (!isCapacitorNative()) {
    return '';
  }

  // 4. Default public backend URL
  return DEFAULT_PUBLIC_BACKEND_URL;
}

export const PRODUCTION_API_BASE_URL = getApiBaseUrl() || DEFAULT_PUBLIC_BACKEND_URL;

export function getRemoteServerUrl(): string {
  return getApiBaseUrl();
}

export function setRemoteServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem(STORAGE_SERVER_URL_KEY);
  } else {
    localStorage.setItem(STORAGE_SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
}

/**
 * Resolves full API endpoint URL: e.g. ${API_BASE_URL}/api/chat
 */
export function getApiUrl(endpoint: string, explicitBase?: string): string {
  if (!endpoint) return explicitBase || getApiBaseUrl();
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.startsWith('blob:') || endpoint.startsWith('data:')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = explicitBase !== undefined ? explicitBase : getApiBaseUrl();
  if (baseUrl) {
    return `${baseUrl}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

/**
 * Check active network and server health reachability (/health)
 */
export async function checkServerReachability(): Promise<{ reachable: boolean; latencyMs: number; status?: string; error?: string }> {
  const start = Date.now();
  try {
    const data = await apiFetch<{ status: string; chatModel?: string; service?: string }>('/health', {}, 8000);
    return {
      reachable: !!data && (data.status === 'ok' || data.status === 'connected'),
      status: data.status,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      error: err.userMessage || err.message || 'Haikuweza kufikia seva ya MKUU',
    };
  }
}

/**
 * Safe fetch wrapper with exact error classification (NO_INTERNET, BACKEND_UNREACHABLE, GEMINI_UNAVAILABLE),
 * HTTPS resolution, CORS handling, dynamic Wi-Fi / Mobile Data adaptation, and retries.
 */
export async function apiFetch<T>(endpoint: string, options?: RequestInit, timeoutMs = 45000): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // 1. Pre-Flight Connectivity Check: Distinguish NO_INTERNET before sending request
  const isDeviceOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isDeviceOnline) {
    throw new MkuuApiError({
      code: 'NO_INTERNET',
      userMessage: 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.',
      technicalDetails: 'Kifaa chako hakina muunganisho wa intaneti (Wi-Fi wala Mobile Data).',
      targetUrl: cleanEndpoint,
      isRetryable: true,
    });
  }

  // Build candidate list of base URLs to attempt
  const candidateBases: string[] = [];
  const custom = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_SERVER_KEY_CUSTOM) : null;
  if (custom && custom.trim().startsWith('http')) {
    candidateBases.push(custom.trim().replace(/\/+$/, ''));
  }

  if (DEFAULT_PUBLIC_BACKEND_URL && DEFAULT_PUBLIC_BACKEND_URL.startsWith('http')) {
    candidateBases.push(DEFAULT_PUBLIC_BACKEND_URL.replace(/\/+$/, ''));
  }

  if (!isCapacitorNative()) {
    candidateBases.push('');
  }

  if (isCapacitorNative() && candidateBases.length === 0) {
    throw new MkuuApiError({
      code: 'BACKEND_UNREACHABLE',
      userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali sanidi anwani ya seva ya uzalishaji (Production Backend URL) kwenye Mipangilio au washa seva yako ya wingu.',
      technicalDetails: 'THE MKUU BACKEND IS NOT DEPLOYED/REACHABLE. Hakuna anwani ya seva ya umma (Public HTTPS Backend) iliyosanidiwa kwa ajili ya APK.',
      targetUrl: cleanEndpoint,
      isRetryable: true,
    });
  }

  const uniqueBases = Array.from(new Set(candidateBases));
  let lastError: MkuuApiError | null = null;

  for (const base of uniqueBases) {
    const targetUrl = getApiUrl(cleanEndpoint, base);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      ...(options?.headers as Record<string, string> || {}),
    };

    if (options?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Try up to 2 attempts per candidate base URL
    for (let attempt = 1; attempt <= 2; attempt++) {
      // Re-verify network state on each attempt in case Wi-Fi/Mobile Data transitioned
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new MkuuApiError({
          code: 'NO_INTERNET',
          userMessage: 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.',
          technicalDetails: 'Muunganisho wa mtandao umezimika.',
          targetUrl,
          isRetryable: true,
        });
      }

      const controller = new AbortController();
      let isTimedOut = false;
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(targetUrl, {
          ...options,
          headers,
          cache: 'no-store',
          signal: options?.signal || controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';

        // Handle Non-OK HTTP status codes
        if (!response.ok) {
          let errorDetail = `HTTP ${response.status} ${response.statusText}`;
          let isGeminiError = false;
          
          if (contentType.includes('application/json')) {
            try {
              const errorJson = await response.json();
              if (errorJson.error) {
                errorDetail = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
                if (
                  errorJson.error === 'GEMINI_UNAVAILABLE' ||
                  errorDetail.toLowerCase().includes('gemini') ||
                  errorDetail.toLowerCase().includes('generativelanguage') ||
                  errorDetail.toLowerCase().includes('model')
                ) {
                  isGeminiError = true;
                }
              }
            } catch (_) {}
          }

          if (isGeminiError || response.status === 503) {
            throw new MkuuApiError({
              code: 'GEMINI_UNAVAILABLE',
              status: response.status,
              userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.',
              technicalDetails: errorDetail,
              targetUrl,
              isRetryable: true,
            });
          }

          if (response.status === 429) {
            throw new MkuuApiError({
              code: 'GEMINI_UNAVAILABLE',
              status: response.status,
              userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.',
              technicalDetails: 'Kiwango cha juu cha maombi ya Google Gemini kimefikiwa (Rate Limit 429).',
              targetUrl,
              isRetryable: true,
            });
          }

          throw new MkuuApiError({
            code: 'BACKEND_UNREACHABLE',
            status: response.status,
            userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
            technicalDetails: errorDetail,
            targetUrl,
            isRetryable: response.status !== 401,
          });
        }

        // Handle Unexpected HTML / Auth Redirect (e.g. __cookie_check.html)
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<!doctype') || text.includes('<html') || text.includes('cookie_check')) {
            throw new MkuuApiError({
              code: 'BACKEND_UNREACHABLE',
              status: response.status,
              userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
              technicalDetails: 'Seva imerudisha ukurasa wa uthibitisho (HTML Redirect) badala ya data za JSON.',
              targetUrl,
              isRetryable: true,
            });
          }
          try {
            return JSON.parse(text) as T;
          } catch (_) {
            throw new MkuuApiError({
              code: 'BACKEND_UNREACHABLE',
              status: response.status,
              userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
              technicalDetails: 'Invalid JSON payload received from backend',
              targetUrl,
            });
          }
        }

        return (await response.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err instanceof MkuuApiError) {
          lastError = err;
          // If already classified as NO_INTERNET or GEMINI_UNAVAILABLE, propagate immediately
          if (err.code === 'NO_INTERNET' || err.code === 'GEMINI_UNAVAILABLE') {
            throw err;
          }
        } else if (isTimedOut || err.name === 'AbortError') {
          lastError = new MkuuApiError({
            code: 'BACKEND_UNREACHABLE',
            userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
            technicalDetails: `Request timeout after ${timeoutMs}ms`,
            targetUrl,
            isRetryable: true,
          });
        } else {
          // Network / TLS / DNS failure
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          if (isOffline) {
            lastError = new MkuuApiError({
              code: 'NO_INTERNET',
              userMessage: 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.',
              technicalDetails: 'Kifaa chako hakina intaneti.',
              targetUrl,
              isRetryable: true,
            });
            throw lastError;
          } else {
            lastError = new MkuuApiError({
              code: 'BACKEND_UNREACHABLE',
              userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
              technicalDetails: err.message || 'Failed to fetch',
              targetUrl,
              isRetryable: true,
            });
          }
        }

        // Short retry wait before trying next candidate
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  }

  throw lastError || new MkuuApiError({
    code: 'BACKEND_UNREACHABLE',
    userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
    technicalDetails: 'All candidate endpoints failed to connect',
    targetUrl: cleanEndpoint,
    isRetryable: true,
  });
}
