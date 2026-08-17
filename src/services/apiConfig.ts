/**
 * API Config and Server URL Resolver for MKUU AI
 * 
 * Handles local Capacitor Android runtime (where fetch('/api/*') hits local asset files or localhost)
 * vs Cloud Run web environment vs Custom Remote Server URL configured in settings.
 */

const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';

// Default live cloud server URL for MKUU AI
export const DEFAULT_PRODUCTION_SERVER_URL = 'https://ais-dev-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

/**
 * Returns configured remote server base URL
 */
export function getRemoteServerUrl(): string {
  if (typeof window === 'undefined') return '';
  const custom = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if (custom && custom.trim().startsWith('http')) {
    return custom.trim().replace(/\/+$/, '');
  }
  
  // If running inside Capacitor Android (origin is https://localhost or capacitor://localhost or file://)
  if (isCapacitorNative()) {
    return DEFAULT_PRODUCTION_SERVER_URL;
  }

  // If in browser web context, relative path '' is standard
  return '';
}

/**
 * Save custom server URL in user preferences
 */
export function setRemoteServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem(STORAGE_SERVER_URL_KEY);
  } else {
    localStorage.setItem(STORAGE_SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
}

/**
 * Detect if running inside native Capacitor environment
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
 * Resolves full API endpoint URL
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getRemoteServerUrl();
  if (baseUrl) {
    return `${baseUrl}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

/**
 * Safe fetch wrapper that handles JSON errors and provides clean Swahili error messages
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
      throw new Error(`Seva ya AI ya MKUU inatakiwa kuelekezwa kwenye URL halisi ya seva ya wingu. (Endpoint "${endpoint}" ilirudisha ukurasa wa HTML badala ya JSON).`);
    }
    try {
      return JSON.parse(text) as T;
    } catch (_) {
      throw new Error(`Jibu lisilotarajiwa kutoka kwenye seva.`);
    }
  }

  return (await response.json()) as T;
}
