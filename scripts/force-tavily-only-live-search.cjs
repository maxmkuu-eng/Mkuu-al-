const fs = require('fs');
const path = require('path');
function patchFile(relative, transform) {
  const file = path.join(process.cwd(), relative);
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) return;
  fs.writeFileSync(file, next);
}

patchFile('server/geminiService.ts', (source) => {
  if (!source.includes("import { searchWithTavily } from './tavilySearch.js';")) throw new Error('MKUU: Tavily import marker not found.');
  if (!source.includes('getLastTavilySources')) source = source.replace("import { searchWithTavily } from './tavilySearch.js';", "import { searchWithTavily, getLastTavilySources } from './tavilySearch.js';");
  if (!source.includes('webSources: Array<{ title: string; url: string }>;')) {
    const marker = "  generatedFiles: GeneratedFileSummary[];\n  aiProvider: string;";
    if (source.includes(marker)) source = source.replace(marker, "  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider: string;", 1);
  }
  const searchStart = "    if (isSearchQuery) {\n      try {";
  const fallbackStartMarker = "        // Secondary fallback: Google Search grounding.";
  const outerCatchEndMarker = "      }\n\n      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED]";
  const searchStartIndex = source.indexOf(searchStart);
  const fallbackStart = source.indexOf(fallbackStartMarker, searchStartIndex);
  const outerCatchEnd = source.indexOf(outerCatchEndMarker, fallbackStart);
  if (searchStartIndex >= 0 && fallbackStart >= 0 && outerCatchEnd >= 0) {
    const fallbackSection = source.slice(fallbackStart, outerCatchEnd);
    if (/googleSearch|Falling back from Tavily to Google Search grounding/i.test(fallbackSection)) {
      source = source.replace(fallbackSection, "        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily live search failed. MKUU will not use Gemini/Google Search as a fallback. ${tavilyMsg}`);\n");
    }
  }
  const oldGroundedContents = "        const groundedContents = this.buildConversationHistory(\n          conversationHistory,\n          `${message}\\n\\n[MKUU LIVE SEARCH EVIDENCE - use this evidence to answer]\\n${tavilyResults}`,\n          attachments,\n        );";
  const newGroundedContents = "        const groundedContents = [{ role: 'user', parts: [{ text: `${message}\\n\\n[MKUU LIVE SEARCH EVIDENCE - Tavily ONLY]\\n${tavilyResults}` }] }];";
  if (source.includes(oldGroundedContents)) source = source.replace(oldGroundedContents, newGroundedContents, 1);
  const searchPreferred = "          preferredModel: PERSONAL_CHAT_MODEL,\n        });";
  if (source.includes(searchPreferred)) source = source.replace(searchPreferred, "          preferredModel: usedModel,\n        });", 1);
  source = source.replace("// Live-search path: Tavily -> Gemini without tools; Google Search is retained as a secondary fallback", "// Live-search path: Tavily -> Gemini synthesis only; Google Search is forbidden");
  source = source.replace("console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\"${PERSONAL_CHAT_MODEL}\"", "console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\"${usedModel}\"");
  const oldReturn = "      generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,";
  if (source.includes(oldReturn)) source = source.replace(oldReturn, "      generatedFiles: generatedFilesList,\n      webSources: isSearchQuery ? getLastTavilySources() : [],\n      aiProvider: AI_PROVIDER,", 1);
  const liveBlockStart = source.indexOf(searchStart);
  const liveBlockEnd = source.indexOf("    } else {", liveBlockStart);
  if (liveBlockStart >= 0 && liveBlockEnd > liveBlockStart) {
    const liveBlock = source.slice(liveBlockStart, liveBlockEnd);
    if (/googleSearch|Falling back from Tavily to Google Search grounding/i.test(liveBlock)) throw new Error('MKUU: unsafe Google Search fallback remains inside live-search path.');
    if (/buildConversationHistory\(\s*conversationHistory/i.test(liveBlock)) throw new Error('MKUU: historical conversation remains exposed to live-search synthesis.');
  }
  return source;
});

patchFile('server.ts', (source) => {
  const blockStart = source.indexOf('    // Current/changing facts must be grounded with live Google Search.');
  const resultCall = source.indexOf('    const result=await geminiService.processChat', blockStart);
  if (blockStart >= 0 && resultCall > blockStart) {
    source = source.slice(0, blockStart) + "    // Live/current routing is owned by GeminiService -> Tavily. Never inject Google Search instructions here.\n" + source.slice(resultCall);
    source = source.replace('geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments})', 'geminiService.processChat({userId:DEFAULT_USER_ID,message,conversationHistory:effectiveHistory,isVoice,attachments})');
  }
  const oldReturn = 'generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs';
  if (source.includes(oldReturn) && !source.includes('webSources:result.webSources')) source = source.replace(oldReturn, 'generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs', 1);
  if (/Tafuta Google na uthibitishe taarifa za sasa/i.test(source)) throw new Error('MKUU: server API still injects Google Search instructions.');
  return source;
});

patchFile('src/services/aiEngine.ts', (source) => {
  // This script is idempotent: if the client result type has already been
  // changed to the current project shape, do not fail the entire build.
  if (!/function\s+needsLiveSearch\s*\(\s*message\s*:\s*string\s*\)/.test(source)) {
    console.log('MKUU: client live-search detector already uses a different compatible shape; skipping client Tavily patch.');
    return source;
  }
  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) {
    const marker = "  generatedFiles?: GeneratedFileSummary[];\n  engineUsed:";
    if (!source.includes(marker)) {
      console.log('MKUU: ChatEngineResult marker already changed; skipping client result-type patch.');
      return source;
    }
    source = source.replace(marker, "  generatedFiles?: GeneratedFileSummary[];\n  webSources?: Array<{ title: string; url: string }>;\n  engineUsed:", 1);
  }
  const routeMarker = "  const directApiKey = getStoredGeminiApiKey();\n  if (directApiKey && directApiKey.trim().length > 10) return callDirectGemini(directApiKey.trim(), params);";
  if (source.includes(routeMarker) && !source.includes('LIVE/CURRENT QUESTIONS: force the server/Tavily path')) {
    const route = "  // LIVE/CURRENT QUESTIONS: force the server/Tavily path before any stored Gemini API key.\n  if (needsLiveSearch(params.message)) {\n    return isCapacitorNative() ? callNativeServerChat(params) : streamServerChat(params);\n  }\n\n";
    source = source.replace(routeMarker, route + routeMarker, 1);
  }
  const nativeMarker = "    intent: serverRes.intent || 'chat',\n  };";
  if (source.includes(nativeMarker) && !source.includes("webSources: serverRes.webSources || []")) source = source.replace(nativeMarker, "    intent: serverRes.intent || 'chat',\n    webSources: serverRes.webSources || [],\n  };", 1);
  const streamDoneMarker = "  let reply = '';\n  emitStream('', false);";
  if (source.includes(streamDoneMarker) && !source.includes('let donePayload: any = null;')) source = source.replace(streamDoneMarker, "  let reply = '';\n  let donePayload: any = null;\n  emitStream('', false);", 1);
  const donePayloadLine = "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');";
  if (source.includes(donePayloadLine) && !source.includes('donePayload = payload;')) source = source.replace(donePayloadLine, "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done') donePayload = payload;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');", 1);
  const streamReturn = "  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };";
  if (source.includes(streamReturn)) source = source.replace(streamReturn, "  return { reply, cleanSpeechText: (donePayload?.cleanSpeechText || reply).replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: donePayload?.aiProvider || 'Google Gemini', chatModel: donePayload?.chatModel || 'gemini-3.7-flash', intent: donePayload?.intent || 'web_search', webSources: donePayload?.webSources || [] };", 1);
  return source;
});

console.log('MKUU: Tavily live-search patch is idempotent; existing compatible source is preserved and unrelated builds are not blocked by stale markers.');
