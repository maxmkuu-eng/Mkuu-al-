const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  /import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/,
  "import { searchWithExa } from './exaSearch.js';\n",
);

const startMarker = '    if (isSearchQuery) {';
const endMarker = '\n    } else {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) throw new Error('EXA patch: live-search block markers were not found.');

const exaBlock = `    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Exa is the exclusive live/social search provider.');
        const searchQuery = \`${'${message}'}\\nCurrent date/time in Tanzania: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\\nFor relative dates, "jana" means the previous Tanzania calendar date.\`;
        const exaResult = await searchWithExa(searchQuery);
        webSources = exaResult.citations;
        const evidence = String(exaResult.answer || '').trim();
        if (!evidence) throw new Error('Exa returned no usable evidence.');

        // Exa retrieves current evidence; Gemini performs the final natural-language
        // synthesis. This prevents raw search output (or a search engine "no answer"
        // summary) from being shown as the final answer.
        const groundedSystemPrompt = \`${'${systemPrompt}'}\\n\\nLIVE EXA EVIDENCE:\\n${'${evidence}'}\\n\\nSTRICT EVIDENCE RULES:\\n- Answer the user's exact question using the supplied Exa evidence as the primary source.\\n- Do not answer from stale model memory when the evidence contains the requested fact.\\n- Extract concrete names, dates, scores, opponents, times and event details from the evidence.\\n- For news/celebrity questions, do not say "hakuna taarifa" merely because the user did not mention a date; use credible evidence about the event.\\n- For sports, distinguish upcoming fixtures from completed results and use Tanzania time (Africa/Dar_es_Salaam, UTC+3).\\n- If evidence confirms the event, state the confirmed fact directly.\\n- If the evidence conflicts, explain the conflict briefly and identify which source is stronger/newer.\\n- If the evidence truly does not contain the requested fact, say that the search did not find enough reliable evidence; never invent it.\\n- Keep the answer direct and natural in Kiswahili unless the user uses another language.\`;
        const groundedContents = this.buildConversationHistory(
          conversationHistory,
          `${message}\\n\\n[MKUU EXA EVIDENCE - ANSWER FROM THIS EVIDENCE]\\n${evidence}`,
          attachments,
        );
        aiReplyText = await this.executeGeminiCallWithFallback({
          contents: groundedContents,
          config: { systemInstruction: groundedSystemPrompt, temperature: 0.15 },
          preferredModel: PERSONAL_CHAT_MODEL,
        });
        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Exa grounding.');
        console.log('[MKUU-BACKEND] [EXA_SYNTHESIS_SUCCESS] Gemini synthesized the final answer from Exa evidence.');
      } catch (exaErr) {
        const exaMsg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] Exa/synthesis failed: ${'${exaMsg}'}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa search/synthesis failed. ${'${exaMsg}'}\`);
      }

      console.log(\`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] provider=Exa+Gemini model=${'${PERSONAL_CHAT_MODEL}'} latency=${'${Date.now() - startTime}'}ms status=200\`);
`;
source = source.slice(0, start) + exaBlock + source.slice(end);

const insufficientStart = source.indexOf('        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {');
if (insufficientStart !== -1) {
  const insufficientEnd = source.indexOf('        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED]', insufficientStart);
  if (insufficientEnd !== -1) source = source.slice(0, insufficientStart) + source.slice(insufficientEnd);
}

source = source.replace(
  'const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;',
  "const usedModel = isSearchQuery ? PERSONAL_CHAT_MODEL : PERSONAL_CHAT_MODEL;",
);
source = source.replace(
  '      aiProvider: AI_PROVIDER,\n      chatModel: usedModel,',
  "      aiProvider: isSearchQuery ? 'Exa + Google Gemini' : AI_PROVIDER,\n      chatModel: usedModel,",
);
source = source.replace(/Tavily/g, 'Exa').replace(/tavily/gi, 'exa');

// Treat current/news/celebrity questions as live-search requests, including
// questions that do not contain an explicit word such as "latest" or "today".
const liveIntentTerms = 'waziri mkuu|rais wa|makamu wa rais|kiongozi wa sasa|mkuu wa nchi|meya wa|mkuu wa|mkurugenzi wa|mwanasiasa|current|latest|sasa|wa sasa|leo|jana|juzi|yesterday|today|hivi punde|habari mpya|habari za leo|habari|news|taarifa|msanii|celebrity|zuchu|diamond|harmonize|alikiba|rayvanny|amejifungua|kujifungua|amepata mtoto|mtoto gani|mtoto wa kike|mtoto wa kiume|amefariki|ameoa|ameolewa|ujauzito|mimba|uvumi|rumour|rumor|imethibitishwa|confirmed|imebainika|wiki hii|this week|bei ya|thamani ya|exchange rate|rate ya|matokeo ya|mechi ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda';
const listPattern = /const searchKeywords = \[[\s\S]*?\];/;
if (listPattern.test(source)) {
  source = source.replace(listPattern, `const searchKeywords = [${liveIntentTerms.split('|').map((x) => JSON.stringify(x)).join(',')},'tafuta mtandaoni','tafuta google','search google','search online','google search','yanga','yangu','young africans','simba','simba sc','azam fc','singida','mashujaa','geita gold','jkt tanzania','namungo','coastal union','dodoma jiji','kagera sugar','tabora united','mechi','mchezo','ratiba','matokeo','msimamo','kikosi','magoli','tff','nbc premier league','ligi kuu','caf champions league','caf confederation','shirikisho','ngao ya jamii','kombe la mapinduzi','crdb federation cup','kuna mechi','nani anacheza','arsenal','manchester','man utd','man city','chelsea','liverpool','real madrid','barcelona','bayern','psg','epl','uefa','champions league','la liga','serie a'];`);
}

if (!source.includes('webSources: Array<{ title: string; url: string }>')) {
  source = source.replace('  generatedFiles: GeneratedFileSummary[];\n  aiProvider:', '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:');
}
if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
  source = source.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];");
}
if (!source.includes('      webSources,\n      aiProvider:')) {
  source = source.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
}

fs.writeFileSync(file, source);
console.log('MKUU: Exa retrieves live evidence and Gemini synthesizes the final answer; current/news/celebrity intent is enforced.');
