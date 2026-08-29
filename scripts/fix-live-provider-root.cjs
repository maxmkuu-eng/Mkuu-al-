const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  /import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/,
  "import { searchWithExa } from './exaSearch.js';\n",
);
source = source.replace(
  /\/\/ Live-search path: Tavily[^\n]*/,
  '// Live-search path: Exa -> Gemini evidence synthesis; no Tavily or stale-model fallback.',
);

const startMarker = '    // IMPORTANT: Current-information questions must be grounded in fresh web data.';
const elseMarker = '    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback';
const start = source.indexOf(startMarker);
const end = source.indexOf(elseMarker, start);

if (start === -1 || end === -1) {
  console.log('MKUU: live-provider root target not found; preserving current implementation.');
  process.exit(0);
}

const replacement = [
  '    // IMPORTANT: All current/live/news/sports questions are grounded through Exa first.',
  '    // Exa is the single live-search provider. Gemini only synthesizes returned evidence.',
  '    if (isSearchQuery) {',
  '      try {',
  "        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live query routed to Exa.');",
  "        const timeContext = getCurrentTanzaniaTimeContext();",
  "        const exaQuery = message + '\\nCurrent date/time in Tanzania: ' + timeContext.formattedString;",
  '        const exa = await searchWithExa(exaQuery);',
  "        webSources = Array.isArray(exa.citations) ? exa.citations.filter((c) => c && c.url).map((c) => ({ title: String(c.title || c.url), url: String(c.url) })) : [];",
  "        const evidence = String(exa.answer || '').trim();",
  "        if (!evidence) throw new Error('EXA_SEARCH_EMPTY: no usable live evidence returned.');",
  "        const citationsText = webSources.map((c) => '- ' + c.title + ': ' + c.url).join('\\n');",
  "        const groundedSystemPrompt = systemPrompt + '\\n\\nLIVE WEB EVIDENCE (EXA):\\n' + evidence + '\\n\\nSOURCE LINKS:\\n' + citationsText + '\\n\\nSTRICT LIVE-DATA RULES:\\n' +",
  "          '- Treat EXA evidence as the factual source for this live query.\\n' +",
  "          '- Answer the exact question asked; do not answer a different question.\\n' +",
  "          '- Never say \"hakuna taarifa\" or \"no information\" if the evidence contains a credible direct answer.\\n' +",
  "          '- Do not use stale model memory to contradict the evidence.\\n' +",
  "          '- For sports, distinguish scheduled fixtures from completed results and convert kickoff times to Africa/Dar_es_Salaam (UTC+3).\\n' +",
  "          '- For news and celebrity questions, prefer explicit confirmed facts and named details over rumors.\\n' +",
  "          '- If sources conflict, state the conflict and prefer the stronger/newer source.\\n' +",
  "          '- Never invent a name, date, score, time, child gender/name, or event unsupported by the evidence.\\n' +",
  "          '- Keep the answer concise and directly answer the user in natural Kiswahili unless another language is requested.';",
  '        const groundedContents = this.buildConversationHistory(',
  "          conversationHistory,",
  "          message + '\\n\\n[MKUU EXA EVIDENCE - answer strictly from this evidence]\\n' + evidence,",
  '          attachments,',
  '        );',
  '        aiReplyText = await this.executeGeminiCallWithFallback({',
  '          contents: groundedContents,',
  '          config: { systemInstruction: groundedSystemPrompt, temperature: 0.1 },',
  '          preferredModel: PERSONAL_CHAT_MODEL,',
  '        });',
  "        if (!aiReplyText || !aiReplyText.trim()) throw new Error('Gemini returned an empty response after Exa grounding.');",
  "        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] evidence=' + webSources.length + ' citations latency=' + (Date.now() - startTime) + 'ms');",
  '      } catch (exaErr) {',
  "        const msg = String(exaErr && exaErr.message ? exaErr.message : exaErr);",
  "        console.error('[MKUU-BACKEND] [EXA_SEARCH_FAILED] ' + msg);",
  "        throw new Error('LIVE_SEARCH_UNAVAILABLE: Exa live search failed. ' + msg);",
  '      }',
].join('\n') + '\n';

source = source.slice(0, start) + replacement + source.slice(end);
source = source.replace(
  'const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;',
  'const usedModel = PERSONAL_CHAT_MODEL;',
);

// Idempotent guard: never leave duplicate webSources declarations behind.
const declaration = "    let webSources: Array<{ title: string; url: string }> = [];";
const count = source.split(declaration).length - 1;
if (count === 0) {
  source = source.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n" + declaration);
} else if (count > 1) {
  const first = source.indexOf(declaration);
  source = source.slice(0, first + declaration.length) + source.slice(first + declaration.length).replaceAll(declaration, '');
}

fs.writeFileSync(file, source);
console.log('MKUU: LIVE ROOT FIX applied — /api/chat live queries now use Exa evidence and return citations before Gemini synthesis.');
