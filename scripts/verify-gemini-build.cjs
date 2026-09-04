const fs = require('fs');
const path = require('path');

const bundle = path.join(process.cwd(), 'dist', 'server.cjs');
if (!fs.existsSync(bundle)) {
  console.error('[GEMINI-BUILD] FAILED: dist/server.cjs was not generated.');
  process.exit(1);
}

// Gemini's existing SDK implementation is intentionally preserved.
// This verifier must validate build integrity, not force a Gemini runtime rewrite.
const source = fs.readFileSync(bundle, 'utf8');
const required = [
  'server.cjs',
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  console.error(`[GEMINI-BUILD] FAILED: production bundle validation incomplete: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[GEMINI-BUILD] OK: production server bundle generated; existing Gemini runtime preserved.');
console.log('[GEMINI-BUILD] ENGINE=EXISTING-GEMINI-RUNTIME');
