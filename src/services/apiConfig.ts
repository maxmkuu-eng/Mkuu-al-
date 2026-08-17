/**
 * MKUU AI — Production API Configuration & Server Resolver
 * 
 * Configures the live Cloud Run backend URL for standalone Android APK and Web environments.
 */

export const PRODUCTION_API_BASE_URL = 'https://ais-dev-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';

/**
 * Detect if running inside native Capacitor environment (Android / iOS / Local WebView)
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const isCap = !!(window as any).Capacitor?.isNativePlatform?.() || 
                window.location.protocol === 'capacitor:' || 
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:';
  return isCap;
}

/**
 * Returns configured API Base URL
 * - If user configured a custom URL in settings, use that
 * - If running in native Android / Capacitor APK, use PRODUCTION_API_BASE_URL
 * - If running in browser web context, use origin or PRODUCTION_API_BASE_URL
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_API_BASE_URL;

  // 1. User custom override in settings
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if (custom && custom.trim().startsWith('http')) {
    return custom.trim().replace(/\/+$/, '');
  }

  // 2. Capacitor Android APK or local file origin -> ALWAYS use LIVE production backend
  if (isCapacitorNative()) {
    return PRODUCTION_API_BASE_URL;
  }

  // 3. Web browser context: if on cloud run, use origin or PRODUCTION_API_BASE_URL
  if (window.location.origin && window.location.origin.startsWith('http')) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return ''; // In local node dev server, relative /api/* hits localhost:3000
    }
    return window.location.origin.replace(/\/+$/, '');
  }

  return PRODUCTION_API_BASE_URL;
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
 * Safe fetch wrapper that handles network errors, CORS, and JSON parsing
 */
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
}
