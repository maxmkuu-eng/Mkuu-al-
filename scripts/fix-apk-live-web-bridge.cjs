const fs = require('fs');
const path = require('path');

function patchFile(relative, transform) {
  const file = path.join(process.cwd(), relative);
  if (!fs.existsSync(file)) throw new Error(`[APK-LIVE-BRIDGE] Missing ${relative}`);
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next, 'utf8');
}

// The APK must use the same server live-web pipeline as the web app.
// A locally stored Gemini key must NEVER bypass the server for native APK chat.
patchFile('src/services/aiEngine.ts', (source) => {
  source = source.replace(
    "const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);",
    "if(isCapacitorNative())return callNativeServerChat(params);const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);"
  );

  if (!source.includes('webSources?: Array<{title:string;url:string}>')) {
    source = source.replace(
      "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[]; engineUsed:'server'|'direct_gemini'; aiProvider?:string; chatModel?:string; intent?:string; }",
      "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>; engineUsed:'server'|'direct_gemini'; aiProvider?:string; chatModel?:string; intent?:string; }"
    );
  }

  source = source.replace(
    "generatedFiles:serverRes.generatedFiles,engineUsed:'server'",
    "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server'"
  );
  return source;
});

// Return Exa citations from the backend so the APK can render the same source
// links/cards that the web client already supports.
patchFile('server/geminiService.ts', (source) => {
  if (!source.includes('import { searchWithExa } from')) {
    source = source.replace(
      "import { generateRealFile } from './files.js';",
      "import { generateRealFile } from './files.js';\nimport { searchWithExa } from './exaSearch.js';"
    );
  }
  if (!source.includes('webSources?: Array<{ title: string; url: string }>')) {
    source = source.replace(
      'export interface ChatProcessResult {',
      'export interface ChatProcessResult {\n  webSources?: Array<{ title: string; url: string }>;'
    );
  }
  if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
    source = source.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];");
  }
  source = source.replace(
    "aiReplyText = String(exaResult?.answer || '').trim();",
    "aiReplyText = String(exaResult?.answer || '').trim();\n        webSources = Array.isArray(exaResult?.citations) ? exaResult.citations : [];"
  );
  source = source.replace(
    "return {\n      reply: aiReplyText,",
    "return {\n      reply: aiReplyText,\n      webSources,"
  );
  return source;
});

// Expose the citations on both JSON and SSE chat responses and persist them.
patchFile('server.ts', (source) => {
  source = source.replace(
    "generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)",
    "generatedFiles:result.generatedFiles,webSources:result.webSources||[],memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)"
  );
  source = source.replace(
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};"
  );
  return source;
});

// Persist the sources in the APK's local conversation object too.
patchFile('src/App.tsx', (source) => {
  source = source.replace(
    "generatedFiles: processedFiles,\n        memoryExtracted:",
    "generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:"
  );
  return source;
});

console.log('[APK-LIVE-BRIDGE] Native APK now uses the MKUU server live-web pipeline directly.');
console.log('[APK-LIVE-BRIDGE] Stored Gemini API keys cannot bypass Exa live/social search on Android.');
console.log('[APK-LIVE-BRIDGE] Exa citations are returned to and persisted by the APK UI.');
