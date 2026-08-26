const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  "import { searchWithTavily } from './tavilySearch.js';",
  "import { searchWithExa } from './exaSearch.js';",
);

const startMarker = '    if (isSearchQuery) {';
const endMarker = '\n    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('EXA patch: live-search block markers were not found; refusing to modify the service.');
}

const exaBlock = `    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Using Exa for live web grounding.');
        const exaResults = await searchWithExa(\`${'${message}'}\\nCurrent date/time in Tanzania: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\`);
        const groundedSystemPrompt = \`${'${systemPrompt}'}\\n\\nLIVE WEB SEARCH RESULTS (Exa):\\n${'${exaResults}'}\\n\\nSTRICT LIVE-DATA RULES:\\n- Answer using the supplied Exa search results as the primary evidence.\\n- Do not use stale model memory to override the search results.\\n- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.\\n- For current public officials, report the current office holder supported by the newest credible source.\\n- If sources conflict, explain the conflict briefly and prefer the newest authoritative source.\\n- Never invent a name, score, date, or event that is not supported by the supplied results.\\n- Include source URLs when useful.\`;
        const groundedContents = this.buildConversationHistory(
          conversationHistory,
          \`${'${message}'}\\n\\n[MKUU LIVE SEARCH EVIDENCE - use this Exa evidence to answer]\\n${'${exaResults}'}\`,
          attachments,
        );
        aiReplyText = await this.executeGeminiCallWithFallback({
          contents: groundedContents,
          config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 },
          preferredModel: PERSONAL_CHAT_MODEL,
        });
        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Exa search.');
        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Live search answer generated from fresh Exa web evidence.');
      } catch (exaErr) {
        const exaMsg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] Exa search failed: ${'${exaMsg}'}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa search failed. ${'${exaMsg}'}\`);
      }

      console.log(\`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] provider=Exa model="${'${PERSONAL_CHAT_MODEL}'}" latency=${'${Date.now() - startTime}'}ms status=200\`);
`;

source = source.slice(0, start) + exaBlock + source.slice(end);
source = source
  .replace(/Tavily/g, 'Exa')
  .replace(/tavily/gi, 'exa')
  .replace(/Google Search is retained as a secondary fallback/g, 'Exa is the exclusive live-search provider');

fs.writeFileSync(file, source);
console.log('MKUU: Exa live-search provider enabled; Tavily removed from runtime path.');
