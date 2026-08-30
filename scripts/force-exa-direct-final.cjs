const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

// FINAL LIVE SEARCH SAFETY LAYER.
// This script must be idempotent: build-time patching must never fail merely
// because an earlier patch already changed the same code.
let gemini = read('server/geminiService.ts');

// Normalize the live provider import.
gemini = gemini.replace(/import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/g, "import { searchWithExa } from './exaSearch.js';\n");
if (!gemini.includes("import { searchWithExa } from './exaSearch.js';")) {
  const anchor = "import { generateRealFile } from './files.js';";
  if (gemini.includes(anchor)) gemini = gemini.replace(anchor, anchor + "\nimport { searchWithExa } from './exaSearch.js';");
}

// Replace the complete top-level live-search branch without relying on fragile
// comment markers. We locate `if (isSearchQuery)` and its matching `else` by
// balanced braces, so this survives previous build-time transformations.
function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const searchIf = gemini.indexOf('if (isSearchQuery)');
let branchPatched = false;
if (searchIf >= 0) {
  const open = gemini.indexOf('{', searchIf);
  const close = open >= 0 ? findMatchingBrace(gemini, open) : -1;
  if (open >= 0 && close >= 0) {
    // The `else` belonging to this if is immediately after the closing brace,
    // allowing whitespace/comments produced by earlier patch scripts.
    const elseMatch = gemini.slice(close + 1).match(/^\s*else\s*\{/);
    if (elseMatch) {
      const elseOpen = close + 1 + elseMatch[0].lastIndexOf('{');
      const directBlock = `if (isSearchQuery) {\n      try {\n        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Direct live web/social query; Gemini bypassed.');\n        const timeContext = getCurrentTanzaniaTimeContext();\n        const exa = await searchWithExa(message + '\\nCurrent date/time in Tanzania: ' + timeContext.formattedString);\n        webSources = Array.isArray(exa.citations) ? exa.citations.filter((c) => c && c.url).map((c) => ({ title: String(c.title || c.url), url: String(c.url) })) : [];\n        aiReplyText = String(exa.answer || '').trim();\n        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live answer.');\n        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Direct Exa answer; Gemini bypassed.');\n      } catch (exaErr) {\n        const msg = String(exaErr && exaErr.message ? exaErr.message : exaErr);\n        console.error('[MKUU-BACKEND] [EXA_SEARCH_FAILED] ' + msg);\n        throw new Error('LIVE_SEARCH_UNAVAILABLE: Exa live web/social search failed. ' + msg);\n      }\n    `;
      gemini = gemini.slice(0, searchIf) + directBlock + gemini.slice(elseOpen);
      branchPatched = true;
    }
  }
}

// If an earlier patch already installed the Exa-only branch, do not fail the build.
if (!branchPatched && !gemini.includes('[EXA_SEARCH_STARTED] Direct live web/social query; Gemini bypassed.')) {
  console.warn('[MKUU-FINAL-LIVE] Existing live-search branch could not be located; preserving current implementation instead of failing build.');
}

// Real Tanzania clock: pure time/date questions are answered locally.
if (!gemini.includes('const timeQuestion = /')) {
  const anchor = '    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;';
  const timeGuard = `    const timeQuestion = /\\b(saa ngapi|saa ya sasa|muda wa sasa|muda gani sasa|time now|current time|what time is it|leo ni siku gani|leo tarehe ngapi|tarehe ya leo|date today|today's date)\\b/i.test(String(message || ''));\n    if (timeQuestion) {\n      const t = getCurrentTanzaniaTimeContext();\n      const timeReply = t.timeString + ' sasa hivi, ' + t.dayOfWeek + ' ' + t.dateString + ' (Tanzania, UTC+3).';\n      return { reply: timeReply, cleanSpeechText: timeReply, memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], webSources: [], aiProvider: AI_PROVIDER, chatModel: 'Tanzania Real-Time Clock', latencyMs: Date.now() - startTime };\n    }\n`;
  if (gemini.includes(anchor)) gemini = gemini.replace(anchor, anchor + '\n' + timeGuard);
}

// Ensure relative-date questions enter live search.
const searchAnchor = 'const searchKeywords = [';
if (gemini.includes(searchAnchor) && !gemini.includes("'zimeishaje'")) {
  const relative = "'jana','juzi','kesho','yesterday','tomorrow','zimeishaje','iliishaje','imeishaje','zimefanyaje','amecheza na nani','alicheza na nani','amecheza dhidi ya nani','alicheza dhidi ya nani','opponent','live score','final result',";
  gemini = gemini.replace(searchAnchor, searchAnchor + relative);
}

// Persist Exa source cards on the response.
if (!gemini.includes('webSources: Array<{ title: string; url: string }>')) {
  gemini = gemini.replace('  latencyMs: number;\n}', '  latencyMs: number;\n  webSources: Array<{ title: string; url: string }>;\n}');
}
const declaration = "    let webSources: Array<{ title: string; url: string }> = [];";
gemini = gemini.split(declaration).join('');
if (gemini.includes("    let aiReplyText = '';")) {
  gemini = gemini.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n" + declaration);
}
if (!gemini.includes('      webSources,\n      aiProvider:')) {
  gemini = gemini.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
}

// Client hard guard: stored Gemini credentials are allowed only for normal chat.
const enginePath = 'src/services/aiEngine.ts';
let engine = read(enginePath);
engine = engine.replace(
  /const directApiKey=getStoredGeminiApiKey\(\);if\(directApiKey&&directApiKey\.trim\(\)\.length>10\)return callDirectGemini\(directApiKey\.trim\(\),params\);if\(isCapacitorNative\(\)\)return callNativeServerChat\(params\);/,
  "const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);"
);
write('server/geminiService.ts', gemini);
write(enginePath, engine);

console.log('[MKUU-FINAL-LIVE] Exa-only live web/social routing enforced; Gemini bypassed where live branch is present; Tanzania real-time clock enforced.');
