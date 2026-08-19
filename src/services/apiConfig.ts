/**
 * MKUU AI — Production API Configuration & Server Resolver
 * 
 * Centralized production HTTPS API configuration for MKUU AI Android APK and Web clients.
 * Flow: MKUU APK -> HTTPS Backend -> GeminiService -> Google Gemini API -> Gemini 3.7 Flash
 */

export const PRIMARY_PRODUCTION_URL = 'https://ais-dev-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';
export const SHARED_PRODUCTION_URL = 'https://ais-pre-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

export const PRODUCTION_API_FALLBACK_URLS = [
  PRIMARY_PRODUCTION_URL,
  SHARED_PRODUCTION_URL,
];

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';
export const STORAGE_SERVER_KEY_CUSTOM = 'mkuu_backend_api_url_v1';

export type ApiErrorCode = 
  | 'NETWORK_FAILURE'
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
 * Detect if running inside native Capacitor environment (Android / iOS / Local WebView)
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
 * - If user configured a custom URL in settings, use that
 * - If running in native Android / Capacitor APK, use PRIMARY_PRODUCTION_URL
 * - If running in browser web context on run.app, use relative '' to hit backend without CORS issues
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. User custom override in settings
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if (custom && custom.trim().startsWith('http')) {
    return custom.trim().replace(/\/+$/, '');
  }

  // 2. Capacitor Android APK standalone mode
  if (isCapacitorNative()) {
    return PRIMARY_PRODUCTION_URL;
  }

  // 3. Web browser context hosted on run.app or port 3000
  if (window.location.hostname.includes('run.app') || window.location.port === '3000') {
    return '';
  }

  // 4. Default fallback
  return PRIMARY_PRODUCTION_URL;
}

export const PRODUCTION_API_BASE_URL = getApiBaseUrl() || PRIMARY_PRODUCTION_URL;

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
 * Safe fetch wrapper with exact error classification, HTTPS resolution, CORS handling, and retries.
 */
export async function apiFetch<T>(endpoint: string, options?: RequestInit, timeoutMs = 45000): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Build candidate list of base URLs to attempt
  const candidateBases: string[] = [];
  const custom = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_SERVER_KEY_CUSTOM) : null;
  if (custom && custom.trim().startsWith('http')) {
    candidateBases.push(custom.trim().replace(/\/+$/, ''));
  }

  if (isCapacitorNative()) {
    candidateBases.push(PRIMARY_PRODUCTION_URL);
    candidateBases.push(SHARED_PRODUCTION_URL);
  } else {
    candidateBases.push('');
    candidateBases.push(PRIMARY_PRODUCTION_URL);
    candidateBases.push(SHARED_PRODUCTION_URL);
  }

  const uniqueBases = Array.from(new Set(candidateBases));
  let lastError: MkuuApiError | null = null;

  for (const base of uniqueBases) {
    const targetUrl = getApiUrl(cleanEndpoint, base);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    if (options?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Try up to 2 attempts per candidate base URL
    for (let attempt = 1; attempt <= 2; attempt++) {
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
          signal: options?.signal || controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';

        // Handle Non-OK HTTP status codes
        if (!response.ok) {
          let errorDetail = `HTTP ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            try {
              const errorJson = await response.json();
              if (errorJson.error) errorDetail = errorJson.error;
            } catch (_) {}
          }

          let code: ApiErrorCode = 'UNKNOWN';
          let userMessage = 'Seva ya MKUU haipatikani kwa sasa. Tafadhali jaribu tena.';

          if (response.status === 401) {
            code = 'HTTP_401';
            userMessage = 'Hauruhusiwi kufikia huduma hii (Hitilafu ya Uthibitisho - 401).';
          } else if (response.status === 403) {
            code = 'HTTP_403';
            userMessage = 'Ombi limezuiwa (Ufikiaji hauruhusiwi - 403).';
          } else if (response.status === 429) {
            code = 'HTTP_429';
            userMessage = 'Kiwango cha juu cha maombi kimefikiwa (Rate limit - 429). Tafadhali subiri sekunde chache.';
          } else if (response.status === 500) {
            code = 'HTTP_500';
            userMessage = 'Seva ya MKUU imepata hitilafu ya ndani (Hitilafu 500). Tafadhali jaribu tena.';
          } else if (response.status === 502) {
            code = 'HTTP_502';
            userMessage = 'Seva ya MKUU haifikiwi (Bad Gateway - 502). Tafadhali jaribu tena.';
          } else if (response.status === 503) {
            code = 'HTTP_503';
            userMessage = 'Seva ya MKUU inashughulikia matengenezo kwa sasa (Service Unavailable - 503).';
          }

          throw new MkuuApiError({
            code,
            status: response.status,
            userMessage,
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
              code: 'AUTH_REDIRECT',
              status: response.status,
              userMessage: 'Seva ya MKUU inahitaji muunganisho wa moja kwa moja wa uzalishaji. Tafadhali jaribu tena.',
              technicalDetails: 'Seva imerudisha ukurasa wa HTML badala ya data za JSON.',
              targetUrl,
              isRetryable: true,
            });
          }
          try {
            return JSON.parse(text) as T;
          } catch (_) {
            throw new MkuuApiError({
              code: 'UNKNOWN',
              status: response.status,
              userMessage: 'Jibu lisilotarajiwa kutoka kwenye seva ya MKUU. Tafadhali jaribu tena.',
              technicalDetails: 'Invalid JSON payload received',
              targetUrl,
            });
          }
        }

        return (await response.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err instanceof MkuuApiError) {
          lastError = err;
        } else if (isTimedOut || err.name === 'AbortError') {
          lastError = new MkuuApiError({
            code: 'TIMEOUT',
            userMessage: 'Muda wa maombi umekwisha (Timeout). Seva ya MKUU inachukua muda mrefu kujibu.',
            technicalDetails: `Request timeout after ${timeoutMs}ms`,
            targetUrl,
            isRetryable: true,
          });
        } else {
          // Network / TLS / DNS failure
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const errMsg = err.message || '';
          let code: ApiErrorCode = 'NETWORK_FAILURE';
          let userMsg = 'Seva ya MKUU haipatikani kwa sasa. Tafadhali jaribu tena.';

          if (isOffline) {
            code = 'NETWORK_FAILURE';
            userMsg = 'Kifaa chako hakina intaneti. Tafadhali washa data au Wi-Fi kisha ujaribu tena.';
          } else if (errMsg.includes('certificate') || errMsg.includes('SSL') || errMsg.includes('TLS')) {
            code = 'TLS_FAILURE';
            userMsg = 'Hitilafu ya cheti cha usalama cha HTTPS (TLS/SSL).';
          } else if (errMsg.includes('getaddrinfo') || errMsg.includes('DNS') || errMsg.includes('resolve')) {
            code = 'DNS_FAILURE';
            userMsg = 'Anwani ya seva haipatikani kwenye mtandao (DNS Failure).';
          }

          lastError = new MkuuApiError({
            code,
            userMessage: userMsg,
            technicalDetails: errMsg || 'Failed to fetch',
            targetUrl,
            isRetryable: true,
          });
        }

        // Short retry wait before trying next candidate
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  }

  throw lastError || new MkuuApiError({
    code: 'NETWORK_FAILURE',
    userMessage: 'Seva ya MKUU haipatikani kwa sasa. Tafadhali jaribu tena.',
    technicalDetails: 'All candidate endpoints failed to connect',
    targetUrl: cleanEndpoint,
    isRetryable: true,
  });
}
