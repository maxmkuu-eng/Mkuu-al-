import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const API_BASE_URL =
  'https://ais-pre-226ybn2ptvxoimveetx6am-805534629417.europe-west2.run.app';

const originalFetch = window.fetch.bind(window);

window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  let url: string;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  if (url.startsWith('/api/')) {
    url = `${API_BASE_URL}${url}`;
  } else if (url.startsWith(window.location.origin + '/api/')) {
    url = `${API_BASE_URL}${url.substring(window.location.origin.length)}`;
  }

  return originalFetch(url, init);
}) as typeof window.fetch;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
