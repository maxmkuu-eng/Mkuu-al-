import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Live MKUU AI backend.
// APK ya Capacitor haiwezi kutumia /api/... kwenye WebView yake,
// hivyo tunaelekeza API requests kwenye server inayofanya kazi.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-pre-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app'
).replace(/\/$/, '');

const originalFetch = window.fetch.bind(window);

window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return originalFetch(`${API_BASE_URL}${input}`, init);
  }

  if (input instanceof URL && input.pathname.startsWith('/api/')) {
    return originalFetch(
      `${API_BASE_URL}${input.pathname}${input.search}`,
      init
    );
  }

  return originalFetch(input, init);
}) as typeof window.fetch;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
