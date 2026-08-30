const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

// FINAL SAFETY LAYER: live web/social queries must never call Gemini.
// This runs last, after the older compatibility patches, so no later patch can
// silently restore Gemini synthesis or Google Search grounding.
let gemini = read('server/geminiService.ts');
if (!gemini.includes("import { searchWithExa } from './exaSearch.js';")) {
  gemini = gemini.replace(/import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/, "import { searchWithExa } from './exaSearch.js';\n");
  if (!gemini.includes("import { searchWithExa } from './exaSearch.js';")) {
    gemini = gemini.replace("import { generateRealFile } from './files.js';", "import { generateRealFile } from './files.js';\nimport { searchWithExa } from './exaSearch.js';");
  }
}

gemini = gemini.replace(/import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/g, "import { searchWithExa } from './exaSearch.js';\n");

const startMarker = '    // IMPORTANT: Current-information questions must be grounded in fresh web data.';
const exaMarker = '    // LIVE WEB/SOCIAL: Exa is the only provider. Gemini is NEVER called here.';
const start = gemini.indexOf(startMarker);
const exaStart = gemini.indexOf(exaMarker);
const branchStart = start >= 0 ? start : exaStart;
const endMarker = '    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback';
const end = branchStart >= 0 ? gemini.indexOf(endMarker, branchStart) : -1;

if (branchStart >= 0 && end >= 0) {
  const directBlock = `    // LIVE WEB/SOCIAL: Exa is the only provider. Gemini is NEVER called here.
    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Direct live web/social query; Gemini bypassed.');
        const timeContext = getCurrentTanzaniaTimeContext();
        const exa = await searchWithExa(message + '\\nCurrent date/time in Tanzania: ' + timeContext.formattedString);
        webSources = Array.isArray(exa.citations) ? exa.citations.filter((c) => c && c.url).map((c) => ({ title: String(c.title || c.url), url: String(c.url) })) : [];
        aiReplyText = String(exa.answer || '').trim();
        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live answer.');
        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Direct Exa answer; Gemini bypassed.');
      } catch (exaErr) {
        const msg = String(exaErr && exaErr.message ? exaErr.message : exaErr);
        console.error('[MKUU-BACKEND] [EXA_SEARCH_FAILED] ' + msg);
        throw new Error('LIVE_SEARCH_UNAVAILABLE: Exa live web/social search failed. ' + msg);
      }
`;
  gemini = gemini.slice(0, branchStart) + directBlock + gemini.slice(end);
} else {
  throw new Error('[MKUU-FINAL-LIVE] Could not locate live-search branch in server/geminiService.ts');
}

// Real Tanzania clock: time/date questions are answered locally from the server
// clock and never sent to Gemini or the web. This avoids quota failures and stale dates.
const timeGuard = `    const timeQuestion = /\\b(saa ngapi|saa ya sasa|muda wa sasa|muda gani sasa|time now|current time|what time is it|leo ni siku gani|leo tarehe ngapi|tarehe ya leo|date today|today's date)\\b/i.test(String(message || ''));
    if (timeQuestion) {
      const t = getCurrentTanzaniaTimeContext();
      const timeReply = \\`Ni \\${t.timeString} sasa hivi, \\${t.dayOfWeek} \\${t.dateString} (Tanzania, UTC+3).\\`;
      return { reply: timeReply, cleanSpeechText: timeReply, memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], webSources: [], aiProvider: AI_PROVIDER, chatModel: 'Tanzania Real-Time Clock', latencyMs: Date.now() - startTime };
    }
`;
if (!gemini.includes('const timeQuestion = /')) {
  const anchor = '    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;';
  if (!gemini.includes(anchor)) throw new Error('[MKUU-FINAL-LIVE] processChat destructuring anchor not found.');
  gemini = gemini.replace(anchor, anchor + '\n' + timeGuard);
}

// Ensure every relative-date/time phrase routes to live search when it is not a pure clock query.
const searchAnchor = 'const searchKeywords = [';
const relative = "'jana','juzi','kesho','yesterday','tomorrow','zimeishaje','iliishaje','imeishaje','zimefanyaje','ilifanyaje','amecheza na nani','alicheza na nani','amecheza dhidi ya nani','alicheza dhidi ya nani','opponent','live score','final result','saa ngapi','muda wa sasa',";
if (gemini.includes(searchAnchor) && !gemini.includes("'zimeishaje'")) {
  gemini = gemini.replace(searchAnchor, searchAnchor + relative);
}

// The final result must expose Exa citations, while the normal chat model remains Gemini.
if (!gemini.includes('webSources: Array<{ title: string; url: string }>')) {
  gemini = gemini.replace('  latencyMs: number;\n}', '  latencyMs: number;\n  webSources: Array<{ title: string; url: string }>;\n}');
}
const declaration = "    let webSources: Array<{ title: string; url: string }> = [];";
gemini = gemini.split(declaration).join('');
gemini = gemini.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n" + declaration);
if (!gemini.includes('      webSources,\n      aiProvider:')) {
  gemini = gemini.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
}

write('server/geminiService.ts', gemini);

// Client hard guard: a stored Gemini key may be used for normal chat only.
const enginePath = 'src/services/aiEngine.ts';
let engine = read(enginePath);
engine = engine.replace(
  /const directApiKey=getStoredGeminiApiKey\(\);if\(directApiKey&&directApiKey\.trim\(\)\.length>10\)return callDirectGemini\(directApiKey\.trim\(\),params\);if\(isCapacitorNative\(\)\)return callNativeServerChat\(params\);/,
  "const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);"
);
write(enginePath, engine);

console.log('[MKUU-FINAL-LIVE] Exa-only live web/social routing enforced; Gemini bypassed; Tanzania real-time clock enforced.');
