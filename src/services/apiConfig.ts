/**
 * MKUU AI — Production API Configuration & Server Resolver
 * 
 * Configures the live Cloud Run backend URL for standalone Android APK and Web environments.
 */

export const PRIMARY_PRODUCTION_URL = 'https://ais-dev-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';
export const SHARED_PRODUCTION_URL = 'https://ais-pre-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

export const PRODUCTION_API_FALLBACK_URLS = [
  PRIMARY_PRODUCTION_URL,
  SHARED_PRODUCTION_URL,
];

export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';
export const STORAGE_SERVER_KEY_CUSTOM = 'mkuu_backend_api_url_v1';

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
  if (window.location.hostname === 'localhost' && !window.location.port) {
    return true;
  }
  return false;
}

/**
 * Returns configured API Base URL
 * - If user configured a custom URL in settings, use that
 * - If running in native Android / Capacitor APK, use PRIMARY_PRODUCTION_URL
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
    return PRIMARY_PRODUCTION_URL;
  }

  // 3. If hosted on a cloud domain or preview iframe, relative paths work directly
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
 * Check active network and server health reachability
 */
export async function checkServerReachability(): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const data = await apiFetch<{ status: string; chatModel?: string }>('/api/status', {}, 8000);
    return {
      reachable: !!data && data.status === 'connected',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      error: err.message || 'Haikuweza kufikia seva',
    };
  }
}

/**
 * Safe fetch wrapper that handles network errors, CORS, timeouts, retries, and multi-endpoint fallback
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
  let lastError: any = null;

  for (const base of uniqueBases) {
    const targetUrl = getApiUrl(cleanEndpoint, base);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    if (options?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Try up to 2 attempts per base URL with short retry
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(targetUrl, {
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
          throw new Error(errorDetail);
        }

        // Handle Unexpected HTML / Non-JSON
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<!doctype') || text.includes('<html')) {
            throw new Error(`Seva imerudisha ukurasa wa HTML badala ya data za JSON.`);
          }
          try {
            return JSON.parse(text) as T;
          } catch (_) {
            throw new Error(`Jibu lisilotarajiwa kutoka kwenye seva.`);
          }
        }

        return (await response.json()) as T;
      } catch (err: any) {
        lastError = err;
        // Wait 400ms before second attempt on same base
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  }

  const detailedMsg = lastError?.message || 'Hitilafu ya mtandao';
  throw new Error(`Imeshindwa kuunganishwa na huduma ya AI. Tafadhali angalia muunganisho wako wa intaneti kisha ujaribu tena. (${detailedMsg})`);
}
