const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  "import { searchWithTavily } from './tavilySearch.js';",
  "import { searchWithExa } from './exaSearch.js';"
);

source = source.replace(
  /\/\/ Live-search path: Tavily -> Gemini without tools; Google Search is retained as a secondary fallback/,
  "// Live-search path: Exa -> Gemini evidence synthesis; no Tavily or stale-model fallback."
);

const startMarker = '    // IMPORTANT: Current-information questions must be grounded in fresh web data.';
const elseMarker = '    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback';
const start = source.indexOf(startMarker);
const end = source.indexOf(elseMarker, start);

if (start === -1 || end === -1) {
  console.log('MKUU: live-provider root target not found; preserving current implementation.');
  process.exit(0);
}

const replacement = `    // IMPORTANT: All current/live/news/sports questions are grounded through Exa first.
    // Exa is the single live-search provider. Gemini is used only to synthesize the
    // returned evidence, never to replace it with stale model memory.
    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live query routed to Exa.');
        const exa = await searchWithExa(\`${'${message}'}\\nCurrent date/time in Tanzania: \${getCurrentTanzaniaTimeContext().formattedString}\`);
        const citationsText = exa.citations.map((c) => \`- \${c.title}: \${c.url}\`).join('\\n');
        const evidence = exa.answer;
        if (!evidence.trim()) throw new Error('EXA_SEARCH_EMPTY: no usable live evidence returned.');
        const groundedSystemPrompt = \`${'${systemPrompt}'}\\n\\nLIVE WEB EVIDENCE (EXA):\\n\${evidence}\\n\\nSOURCE LINKS:\\n\${citationsText}\\n\\nSTRICT LIVE-DATA RULES:\\n- Treat the EXA evidence above as the factual source of truth for this live query.\\n- Answer the exact question asked; do not answer a different or broader question.\\n- Never say “hakuna taarifa”, “no information”, or “sijui” if the supplied evidence contains a credible direct answer.\\n- Do not use stale model memory to contradict the supplied evidence.\\n- For sports, distinguish scheduled fixtures from completed results and preserve the source kickoff timezone before converting to Tanzania time.\\n- For news/celebrity questions, prefer explicit confirmed facts and named details over generic summaries or rumors.\\n- If evidence is conflicting, state the conflict and identify which source is stronger/newer.\\n- Never invent a name, date, score, time, child gender/name, or event not supported by the evidence.\\n- Keep the answer concise and directly answer the user's question.\`;
        const groundedContents = this.buildConversationHistory(
          conversationHistory,
          \`${'${message}'}\\n\\n[MKUU EXA EVIDENCE - answer strictly from this evidence]\\n\${evidence}\`,
          attachments,
        );
        aiReplyText = await this.executeGeminiCallWithFallback({
          contents: groundedContents,
          config: { systemInstruction: groundedSystemPrompt, temperature: 0.1 },
          preferredModel: PERSONAL_CHAT_MODEL,
        });
        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Exa grounding.');
        console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] evidence=\${exa.citations.length} citations latency=\${Date.now() - startTime}ms\`);
      } catch (exaErr) {
        const msg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] \${msg}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${msg}\`);
      }
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source);
console.log('MKUU: LIVE ROOT FIX applied — /api/chat live queries now use Exa evidence before Gemini synthesis.');
