/** MKUU AI production API configuration. */
export const DEFAULT_PUBLIC_BACKEND_URL = 'https://mkuu-al-3.onrender.com';
export const STORAGE_SERVER_URL_KEY = 'mkuu_backend_api_url_v1';
export const STORAGE_SERVER_KEY_CUSTOM = 'mkuu_backend_api_url_v1';

export type ApiErrorCode = 'NO_INTERNET'|'BACKEND_UNREACHABLE'|'GEMINI_UNAVAILABLE'|'DNS_FAILURE'|'TLS_FAILURE'|'HTTP_401'|'HTTP_403'|'HTTP_429'|'HTTP_500'|'HTTP_502'|'HTTP_503'|'TIMEOUT'|'AUTH_REDIRECT'|'UNKNOWN';

export class MkuuApiError extends Error {
  public code: ApiErrorCode; public status?: number; public technicalDetails: string; public userMessage: string; public targetUrl: string; public isRetryable: boolean;
  constructor(p:{code:ApiErrorCode;userMessage:string;technicalDetails:string;targetUrl:string;status?:number;isRetryable?:boolean}){super(p.userMessage);this.name='MkuuApiError';Object.assign(this,p);this.isRetryable=p.isRetryable??true;}
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap=(window as any).Capacitor;
  return !!(cap?.isNativePlatform?.() || window.location.protocol==='capacitor:' || window.location.protocol==='file:' || (window.location.hostname==='localhost'&&!window.location.port));
}
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_PUBLIC_BACKEND_URL;
  // Native APK builds always use the production HTTPS backend so an older saved
  // server URL cannot make the APK fail with "Failed to fetch".
  if (isCapacitorNative()) return DEFAULT_PUBLIC_BACKEND_URL;
  const custom=localStorage.getItem(STORAGE_SERVER_URL_KEY);
  if(custom?.trim().startsWith('http')) return custom.trim().replace(/\/+$/,'');
  const env=(import.meta as any).env?.VITE_PUBLIC_API_URL;
  if(typeof env==='string'&&env.trim().startsWith('http')) return env.trim().replace(/\/+$/,'');
  return DEFAULT_PUBLIC_BACKEND_URL;
}
export const PRODUCTION_API_BASE_URL=DEFAULT_PUBLIC_BACKEND_URL;
export function getRemoteServerUrl(){return getApiBaseUrl();}
export function setRemoteServerUrl(url:string){if(typeof window==='undefined')return;if(!url?.trim())localStorage.removeItem(STORAGE_SERVER_URL_KEY);else localStorage.setItem(STORAGE_SERVER_URL_KEY,url.trim().replace(/\/+$/,''));}
export function getApiUrl(endpoint:string,explicitBase?:string){if(endpoint.startsWith('http://')||endpoint.startsWith('https://'))return endpoint;const e=endpoint.startsWith('/')?endpoint:`/${endpoint}`;const b=explicitBase!==undefined?explicitBase:getApiBaseUrl();return b?`${b}${e}`:e;}

export async function checkServerReachability(){const s=Date.now();try{const d=await apiFetch<any>('/health',{},8000);return{reachable:d?.status==='ok'||d?.status==='connected',status:d?.status,latencyMs:Date.now()-s};}catch(e:any){return{reachable:false,latencyMs:Date.now()-s,error:e.userMessage||e.message};}}

export async function apiFetch<T>(endpoint:string,options?:RequestInit,timeoutMs=45000):Promise<T>{
  const url=getApiUrl(endpoint);
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new MkuuApiError({code:'NO_INTERNET',userMessage:'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.',technicalDetails:'Device offline',targetUrl:url});
  const headers:Record<string,string>={Accept:'application/json',...(options?.headers as Record<string,string>||{})};
  if(options?.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  let last:any;
  for(let attempt=0;attempt<2;attempt++){
    const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(url,{...options,headers,cache:'no-store',signal:options?.signal||c.signal});clearTimeout(t);
      const ct=r.headers.get('content-type')||'';let body:any;
      if(ct.includes('application/json')){try{body=await r.json();}catch{body={};}}else{body=await r.text();}
      if(!r.ok){const detail=typeof body==='string'?body:(body?.error||`HTTP ${r.status}`);throw new MkuuApiError({code:r.status===429||r.status===503?'GEMINI_UNAVAILABLE':'BACKEND_UNREACHABLE',status:r.status,userMessage:r.status===429||r.status===503?'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.':'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',technicalDetails:String(detail),targetUrl:url});}
      return body as T;
    }catch(e:any){clearTimeout(t);last=e instanceof MkuuApiError?e:new MkuuApiError({code:'BACKEND_UNREACHABLE',userMessage:'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',technicalDetails:e?.message||'Failed to fetch',targetUrl:url});if(last.code==='GEMINI_UNAVAILABLE')throw last;if(attempt===0)await new Promise(r=>setTimeout(r,500));}
  }
  throw last;
}
