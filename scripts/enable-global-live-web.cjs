const fs = require('node:fs');

const geminiFile = 'server/geminiService.ts';
let geminiSource = fs.readFileSync(geminiFile, 'utf8');

const oldMethod = /  private detectSearchIntent\(message: string\): boolean \{[\s\S]*?\n  \}\n\n  private isInsufficientKnowledgeResponse/;
const newMethod = `  // MKUU_GLOBAL_LIVE_WEB_V2
  private detectSearchIntent(message: string): boolean {
    if (!message) return false;
    const lower = message.toLowerCase().trim();
    const personalOnly = [
      'mke wangu unamjua', 'mke wangu ni nani', 'mume wangu ni nani', 'mama yangu ni nani',
      'baba yangu ni nani', 'mtoto wangu ni nani', 'unamjua ', 'unakumbuka ', 'kumbuka ',
      'nimekwambia', 'nilikuambia', 'nilikwambia', 'max memory'
    ];
    if (personalOnly.some((x) => lower.includes(x))) return false;

    const explicitSearch = /\\b(tafuta|search|google|web|mtandao|online|source|chanzo)\\b/i.test(lower);
    const currentSignals = /\\b(leo|kesho|jana|sasa|hivi sasa|kwa sasa|latest|current|today|tomorrow|yesterday|now|recent|recently|breaking|live|updated|update|mpya|hivi punde|hivi karibuni)\\b/i.test(lower);
    const factualQuestion = /^(nani|nini|lini|wapi|kwa nini|vipi|je|how|who|what|when|where|why|which|is|are|can|does|did|will)\\b/i.test(lower) || /[?？]/.test(lower);
    const dynamicDomains = /\\b(serikali|rais|waziri|wizara|kiongozi|uchaguzi|siasa|habari|news|michezo|mpira|football|soccer|basketball|tennis|cricket|mechi|mchezo|ratiba|matokeo|score|standings|msimamo|biashara|kampuni|uchumi|economy|market|hisa|stock|bei|price|dola|exchange rate|sarafu|crypto|bitcoin|ethereum|msanii|wasanii|artist|celebrity|music|album|wimbo|concert|movie|filamu|technology|teknolojia|ai|artificial intelligence|iphone|android|product|launch|event|weather|hali ya hewa|trafiki|flight|ndege|visa|sheria|law|court|mahakama|scientist|sayansi|space|science|transfer|injury|election|president|minister|prime minister|company|business|finance|stock price)\\b/i.test(lower);

    if (explicitSearch || currentSignals || (factualQuestion && dynamicDomains)) return true;
    if (factualQuestion && lower.length >= 8 && lower.length <= 500) return true;
    return false;
  }

  private isInsufficientKnowledgeResponse`;

if (oldMethod.test(geminiSource)) {
  geminiSource = geminiSource.replace(oldMethod, newMethod);
  console.log('MKUU: Global live factual-question routing V2 applied.');
} else if (geminiSource.includes('MKUU_GLOBAL_LIVE_WEB_V2')) {
  console.log('MKUU: Global live factual-question routing V2 already applied.');
} else {
  throw new Error('MKUU: global live web detectSearchIntent insertion point not found.');
}

// Critical fix: previous assistant messages can contain stale/wrong answers.
// For a live-web turn, do not let those answers compete with fresh evidence.
if (!geminiSource.includes('MKUU_LIVE_HISTORY_ISOLATION_V1')) {
  const historyMarker = '        const groundedContents = this.buildConversationHistory(\n          conversationHistory,';
  if (!geminiSource.includes(historyMarker)) throw new Error('MKUU: live-history isolation insertion point not found.');
  const historyReplacement = `        // MKUU_LIVE_HISTORY_ISOLATION_V1\n        // Preserve user context, but remove prior assistant answers so stale claims cannot override fresh web evidence.\n        const liveConversationHistory = conversationHistory.filter((item) => item?.role === 'user');\n        const groundedContents = this.buildConversationHistory(\n          liveConversationHistory,`;
  geminiSource = geminiSource.replace(historyMarker, historyReplacement);
  console.log('MKUU: live-search history isolation applied; stale assistant answers cannot override fresh evidence.');
}

// Add an explicit evidence-priority instruction to the live-search prompt.
if (!geminiSource.includes('MKUU_LIVE_EVIDENCE_PRIORITY_V1')) {
  const promptMarker = '          const groundedSystemPrompt = `${systemPrompt}\\n\\nLIVE WEB SEARCH RESULTS (Tavily):';
  if (!geminiSource.includes(promptMarker)) throw new Error('MKUU: live-evidence prompt insertion point not found.');
  const promptReplacement = '          const groundedSystemPrompt = `${systemPrompt}\\n\\n// MKUU_LIVE_EVIDENCE_PRIORITY_V1\\nLIVE WEB SEARCH RESULTS (Tavily):';
  geminiSource = geminiSource.replace(promptMarker, promptReplacement);
  geminiSource = geminiSource.replace(
    '- Never invent a name, score, date, or event that is not supported by the supplied results.\\n- You may include source names/URLs when useful.',
    '- Never invent a name, score, date, or event that is not supported by the supplied results.\\n- If one or more recent search results explicitly confirm an event, do not deny that event merely because older conversation history or model memory says otherwise.\\n- Treat recent search evidence as authoritative for current factual questions.\\n- You may include source names/URLs when useful.'
  );
  console.log('MKUU: live evidence priority rules applied.');
}
fs.writeFileSync(geminiFile, geminiSource, 'utf8');

const tavilyFile = 'server/tavilySearch.ts';
let tavilySource = fs.readFileSync(tavilyFile, 'utf8');
if (!tavilySource.includes('MKUU_GLOBAL_LIVE_SEARCH_V2')) {
  const marker = " const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
  if (!tavilySource.includes(marker)) throw new Error('MKUU: global Tavily fan-out insertion point not found.');
  const replacement = " const searches:Promise<TavilySearchResult[]>[]=[\n   runTavilySearch(query,'general'),\n   runTavilySearch(`${query} latest current update news`,'news'),\n   runTavilySearch(`${query} latest 2026 official announcement`,'general'),\n   runTavilySearch(`${query} latest social media Instagram TikTok YouTube Facebook X official`,'general'),\n ];\n // MKUU_GLOBAL_LIVE_SEARCH_V2\n // Worldwide evidence fan-out: search engines/news plus social/official web results.\n";
  tavilySource = tavilySource.replace(marker, replacement);
  fs.writeFileSync(tavilyFile, tavilySource, 'utf8');
  console.log('MKUU: Global worldwide Tavily evidence fan-out V2 enabled.');
} else {
  console.log('MKUU: Global worldwide Tavily evidence fan-out V2 already enabled.');
}
