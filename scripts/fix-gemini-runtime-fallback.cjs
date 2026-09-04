const fs = require('fs');
const path = require('path');

// Intentionally disabled. Gemini runtime is rebuilt from the canonical server source
// instead of applying another regex patch layer during deployment.
const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-RUNTIME] server/geminiService.ts not found.');
console.log('[GEMINI-RUNTIME] Legacy runtime fallback patch disabled.');
