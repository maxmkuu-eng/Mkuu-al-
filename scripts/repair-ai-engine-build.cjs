const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/services/aiEngine.ts');
let s = fs.readFileSync(file, 'utf8');

// Previous build-time patch accidentally inserted the webSources field into
// handleDirectSmsCommand. Remove that misplaced field before TypeScript parses it.
s = s.replace(/\n\s*webSources\?: Array<\{ title:string; url:string \}>;\n/g, '\n');

// Keep the result interface valid and expose live-web citations to ChatView.
s = s.replace(
  /export interface ChatEngineResult \{[^\n]*\}/,
  "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>; engineUsed:'server'|'direct_gemini'; aiProvider?:string; chatModel?:string; intent?:string; }"
);

// Live/current/social queries must never use the direct Gemini client path.
const oldRouting = 'const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);';
const newRouting = 'const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);';
if (s.includes(oldRouting)) s = s.replace(oldRouting, newRouting);

// Preserve structured Exa source cards returned by the server.
s = s.replace(
  /generatedFiles:serverRes\.generatedFiles,engineUsed:/,
  'generatedFiles:serverRes.generatedFiles,webSources:Array.isArray(serverRes.webSources)?serverRes.webSources:[],engineUsed:'
);

fs.writeFileSync(file, s, 'utf8');
console.log('[MKUU-BUILD-REPAIR] aiEngine syntax, Exa-only live routing, and source bridge repaired.');
