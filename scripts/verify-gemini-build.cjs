const fs = require('fs');
const path = require('path');

const bundle = path.join(process.cwd(), 'dist', 'server.cjs');
if (!fs.existsSync(bundle)) {
  console.error('[GEMINI-BUILD] FAILED: dist/server.cjs was not generated.');
  process.exit(1);
}

const source = fs.readFileSync(bundle, 'utf8');
const forbidden = [
  '@google/genai',
  'GoogleGenAI',
  '.models.generateContent',
  'getClient()',
];

const found = forbidden.filter((token) => source.includes(token));
if (found.length) {
  console.error(`[GEMINI-BUILD] FAILED: stale Gemini SDK execution path detected: ${found.join(', ')}`);
  process.exit(1);
}

const required = [
  'generativelanguage.googleapis.com/v1beta/models/',
  'x-goog-api-key',
  '[MKUU-BACKEND] [GEMINI_REST_REQUEST]',
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  console.error(`[GEMINI-BUILD] FAILED: direct Gemini REST execution path is incomplete: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[GEMINI-BUILD] OK: production bundle uses direct Gemini REST only.');
console.log('[GEMINI-BUILD] ENGINE=REST');
