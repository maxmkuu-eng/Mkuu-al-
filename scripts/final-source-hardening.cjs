const fs = require('fs');
const path = require('path');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`[FINAL-HARDENING] Missing ${file}`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, source) { fs.writeFileSync(file, source, 'utf8'); }

// Re-run the canonical backend transforms as the final source-of-truth step.
// These scripts are intentionally invoked here so later legacy patch scripts
// cannot reintroduce Tavily, Google Search live fallback, or the Gemini SDK.
require(path.join(process.cwd(), 'scripts', 'enforce-exa-only-live.cjs'));
require(path.join(process.cwd(), 'scripts', 'fix-gemini-runtime-fallback.cjs'));

const aiFile = path.join(process.cwd(), 'src', 'services', 'aiEngine.ts');
let ai = read(aiFile);

// Browser/mobile chat must never call Gemini directly. Gemini credentials stay
// on the backend; live queries are routed to the backend where Exa is used.
const directStart = ai.indexOf('async function callDirectGemini(');
const nativeStart = ai.indexOf('async function callNativeServerChat(', directStart);
if (directStart >= 0 && nativeStart > directStart) {
  ai = ai.slice(0, directStart) + ai.slice(nativeStart);
}

// Remove any old direct-Gemini branch left by a legacy build patch.
ai = ai.replace(
  /const directApiKey=getStoredGeminiApiKey\(\);if\(directApiKey&&directApiKey\.trim\(\)\.length>10\)return callDirectGemini\(directApiKey\.trim\(\),params\);/g,
  ''
);
ai = ai.replace(
  /const directApiKey=getStoredGeminiApiKey\(\);if\(isCapacitorNative\(\)\)return callNativeServerChat\(params\);/g,
  'if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);'
);
ai = ai.replace(
  /if\(isCapacitorNative\(\)\)return callNativeServerChat\(params\);/g,
  'if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);'
);

// Streaming remains the normal web chat path; it also goes only to MKUU backend.
if (ai.includes('callDirectGemini(')) {
  throw new Error('[FINAL-HARDENING] Direct Gemini browser call remains in aiEngine.ts');
}
if (/https:\/\/generativelanguage\.googleapis\.com/.test(ai)) {
  throw new Error('[FINAL-HARDENING] Direct Gemini API URL remains in frontend aiEngine.ts');
}
if (/google_search|googleSearch|Tafuta Google/i.test(ai)) {
  throw new Error('[FINAL-HARDENING] Google live-search routing remains in frontend aiEngine.ts');
}
write(aiFile, ai);

// Final source-integrity checks. These fail the production build instead of
// shipping a partially patched application.
const serverFile = path.join(process.cwd(), 'server', 'geminiService.ts');
const server = read(serverFile);
const forbiddenServer = [
  "@google/genai",
  'GoogleGenAI',
  '.models.generateContent',
  'searchWithTavily',
  'Tavily',
  'googleSearch',
  'google_search',
];
const badServer = forbiddenServer.filter((token) => server.includes(token));
if (badServer.length) throw new Error(`[FINAL-HARDENING] Forbidden backend references remain: ${badServer.join(', ')}`);
if (!server.includes("import { searchWithExa } from './exaSearch.js';")) throw new Error('[FINAL-HARDENING] Exa backend integration is missing.');
if (!server.includes('[GEMINI_REST_REQUEST]')) throw new Error('[FINAL-HARDENING] Gemini REST integration is missing.');

// Detect accidental duplicate object keys in the common webSources return area.
const webSourceReturnBlocks = server.match(/webSources\s*:/g) || [];
if (webSourceReturnBlocks.length > 6) {
  console.warn(`[FINAL-HARDENING] Review: ${webSourceReturnBlocks.length} webSources occurrences remain; build continues because some are separate scopes.`);
}

console.log('[FINAL-HARDENING] OK: frontend -> MKUU backend only; normal chat -> Gemini REST; live/social -> Exa only; Tavily/Google live search/direct Gemini browser calls blocked.');
