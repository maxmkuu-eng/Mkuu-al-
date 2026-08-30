const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), value, 'utf8');

function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`[MKUU-EXA] Patch target not found: ${label}`);
  return next;
}

// Exa is the ONLY live-web/social provider. Gemini is never called to synthesize
// or fallback for live-search requests. Normal chat remains Gemini-powered.
let gemini = read('server/geminiService.ts');
gemini = gemini.replace(/import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/, "import { searchWithExa } from './exaSearch.js';\n");

const liveStart = gemini.indexOf('    // IMPORTANT: Current-information questions must be grounded in fresh web data.');
const exaStart = gemini.indexOf('    // Exa is the authoritative live-web/social retrieval layer.');
const start = liveStart >= 0 ? liveStart : exaStart;
const endMarker = '    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback';
const end = start >= 0 ? gemini.indexOf(endMarker, start) : -1;
if (start < 0 || end < 0) throw new Error('[MKUU-EXA] Live-search branch not found in geminiService.ts');

const directLiveBlock = `    // LIVE WEB/SOCIAL: Exa is the only provider. Gemini is NEVER called here.
    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Direct live web/social query.');
        const timeContext = getCurrentTanzaniaTimeContext();
        const exa = await searchWithExa(message + '\\nCurrent date/time in Tanzania: ' + timeContext.formattedString);
        webSources = Array.isArray(exa.citations) ? exa.citations.filter((c) => c && c.url).map((c) => ({ title: String(c.title || c.url), url: String(c.url) })) : [];
        aiReplyText = String(exa.answer || '').trim();
        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live evidence.');
        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Direct Exa answer; Gemini bypassed.');
      } catch (exaErr) {
        const msg = String(exaErr && exaErr.message ? exaErr.message : exaErr);
        console.error('[MKUU-BACKEND] [EXA_SEARCH_FAILED] ' + msg);
        throw new Error('LIVE_SEARCH_UNAVAILABLE: Exa live web/social search failed. ' + msg);
      }
`;
gemini = gemini.slice(0, start) + directLiveBlock + gemini.slice(end);

// Relative-date/result wording must trigger live search: jana, juzi, kesho,
// and phrases such as "zimeishaje" were previously falling into Gemini chat.
const relativeTerms = ['jana','juzi','kesho','yesterday','day before yesterday','tomorrow','zimeishaje','iliishaje','imeishaje','zimefanyaje','ilifanyaje','amecheza na nani','alicheza na nani','amecheza dhidi ya nani','alicheza dhidi ya nani','opponent'];
if (!gemini.includes("'zimeishaje'")) {
  gemini = replaceOnce(gemini, 'const searchKeywords = [', 'const searchKeywords = [' + relativeTerms.map((x) => JSON.stringify(x)).join(',') + ',', 'relative-date search keywords');
}

if (!gemini.includes("let webSources: Array<{ title: string; url: string }> = [];")) {
  gemini = replaceOnce(gemini, "    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];", 'webSources state');
}
if (!gemini.includes('      webSources,\n    };')) {
  gemini = replaceOnce(gemini, "      latencyMs: Date.now() - startTime,\n    };", "      latencyMs: Date.now() - startTime,\n      webSources,\n    };", 'webSources result');
}

// Health must reflect a real Gemini outage instead of returning "connected".
gemini = gemini.replace(
  /    \} catch \(err: any\) \{\n      return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \}/,
  "    } catch (err: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: String(err?.message || err) };\n    }",
);
write('server/geminiService.ts', gemini);

// A past-date question asking how matches ended is a completed-result query.
let exa = read('server/exaSearch.ts');
exa = exa.replace(
  "return /\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final)\\b/i.test(q)&&",
  "return /\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final|zimeishaje|iliishaje|imeishaje|zimefanyaje|ilifanyaje)\\b/i.test(q)&&",
);
write('server/exaSearch.ts', exa);

// The alternate /api/agent path must obey the same Exa-only rule and detect
// relative-date live questions too.
let agent = read('server/agentEngine.ts');
if (!agent.includes("from './exaSearch.js'")) agent = agent.replace("import { geminiService } from './geminiService.js';", "import { geminiService } from './geminiService.js';\nimport { searchWithExa } from './exaSearch.js';");
if (!agent.includes("'jana','juzi','kesho'")) {
  agent = agent.replace("const LIVE_WEB_TERMS = [", "const LIVE_WEB_TERMS = ['jana','juzi','kesho','yesterday','tomorrow','zimeishaje','iliishaje','amecheza na nani','alicheza na nani',");
}
const anchor = "    let liveAwareMessage = request.message;\n    if (isLiveWebQuestion(request.message)) {";
if (agent.includes(anchor) && !agent.includes("[EXA_AGENT_LIVE]")) {
  agent = agent.replace(anchor, "    let liveAwareMessage = request.message;\n    if (isLiveWebQuestion(request.message)) {\n      console.log('[EXA_AGENT_LIVE] Gemini bypassed for live query.');\n      const exa = await searchWithExa(request.message);\n      return { intent, reply: exa.answer, cleanSpeechText: exa.answer, generatedFiles: [], memoriesExtracted: [], peopleRecognized: [], aiProvider: 'Exa Live Search', chatModel: 'Exa', latencyMs: Date.now() - started };\n    }\n    if (false) {");
}
write('server/agentEngine.ts', agent);

console.log('MKUU: Exa-only live web/social search enabled. Gemini is bypassed for live queries; Tanzania relative dates and completed sports-result wording are handled.');
