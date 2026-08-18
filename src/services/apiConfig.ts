/**
 * MKUU AI — Production API Configuration & Server Resolver
 * 
 * Configures the live Cloud Run backend URL for standalone Android APK and Web environments.
 */

export const PRODUCTION_API_BASE_URL = 'https://ais-dev-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';

/**
 * Detect if running inside true native Capacitor environment (Android / iOS / Local WebView)
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
  return false;
}

/**
 * Returns configured API Base URL
 * - If user configured a custom URL in settings, use that
 * - If running in native Android / Capacitor APK, use PRODUCTION_API_BASE_URL
 * - If running in browser web context, use relative '' so it hits the live same-origin backend seamlessly
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
    return PRODUCTION_API_BASE_URL;
  }

  // 3. Web browser context: Use relative path '' to hit backend without CORS issues
  return '';
}

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
export function getApiUrl(endpoint: string): string {
  if (!endpoint) return getApiBaseUrl();
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.startsWith('blob:') || endpoint.startsWith('data:')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    return `${baseUrl}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

/**
 * Safe fetch wrapper that handles network errors, CORS, timeouts, and JSON parsing with auto-retry
 */
export async function apiFetch<T>(endpoint: string, options?: RequestInit, timeoutMs = 45000): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options?.signal || controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';

      // Handle Non-OK response
      if (!response.ok) {
        let errorDetail = `Seva imerudisha hitilafu (${response.status} ${response.statusText})`;
        if (contentType.includes('application/json')) {
          try {
            const errorJson = await response.json();
            if (errorJson.error) errorDetail = errorJson.error;
          } catch (_) {}
        }
        // If server 5xx or rate limit, retry once if attempts remain
        if ((response.status >= 500 || response.status === 429) && attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 800));
          continue;
        }
        throw new Error(errorDetail);
      }

      // Handle Unexpected HTML / Non-JSON
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (text.includes('<!DOCTYPE') || text.includes('<!doctype') || text.includes('<html')) {
          throw new Error(`Seva imerudisha ukurasa wa HTML badala ya data za JSON. Hakikisha anwani ya seva "${url}" ipo sahihi.`);
        }
        try {
          return JSON.parse(text) as T;
        } catch (_) {
          throw new Error(`Jibu lisilotarajiwa kutoka kwenye seva.`);
        }
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt < maxAttempts && (err?.name === 'AbortError' || err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError'))) {
        await new Promise((res) => setTimeout(res, 800));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Mawasiliano na seva yameshindikana.');
}
