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
    const dynamicDomains = /\\b(serikali|rais|waziri|wizara|kiongozi|uchaguzi|siasa|habari|news|michezo|mpira|football|soccer|basketball|tennis|cricket|mechi|mchezo|ratiba|matokeo|score|standings|msimamo|biashara|kampuni|uchumi|economy|market|hisa|stock|bei|price|dola|exchange rate|sarafu|crypto|bitcoin|ethereum|msanii|wasanii|artist|celebrity|music|album|wimbo|concert|movie|filamu|technology|teknolojia|ai|artificial intelligence|iphone|android|product|launch|event|weather|hali ya hewa|trafiki|flight|ndege|visa|sheria|law|court|mahakama|scientist|sayansi|space|science|transfer|injury|election|president|minister|prime minister|company|business|finance|stock price|zuchu|diamond|wcb|wasafi|instagram|tiktok|youtube|facebook|twitter|x.com)\\b/i.test(lower);

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
  console.log('MKUU: Global live web routing anchor changed; continuing without duplicate injection.');
}

// Critical fix: previous assistant messages can contain stale/wrong answers.
// For a live-web turn, do not let those answers compete with fresh evidence.
if (!geminiSource.includes('MKUU_LIVE_HISTORY_ISOLATION_V1')) {
  const historyMarker = '        const groundedContents = this.buildConversationHistory(\\n          conversationHistory,';
  if (geminiSource.includes(historyMarker)) {
    const historyReplacement = `        // MKUU_LIVE_HISTORY_ISOLATION_V1\n        // Preserve user context, but remove prior assistant answers so stale claims cannot override fresh web evidence.\n        const liveConversationHistory = conversationHistory.filter((item) => item?.role === 'user');\n        const groundedContents = this.buildConversationHistory(\n          liveConversationHistory,`;
    geminiSource = geminiSource.replace(historyMarker, historyReplacement);
    console.log('MKUU: live-search history isolation applied; stale assistant answers cannot override fresh evidence.');
  } else {
    console.log('MKUU: live-search history isolation already handled by the Tavily authority block.');
  }
}

if (!geminiSource.includes('MKUU_LIVE_EVIDENCE_PRIORITY_V1')) {
  const promptMarker = '          const groundedSystemPrompt = `${systemPrompt}\\n\\nLIVE WEB SEARCH RESULTS (Tavily):';
  if (geminiSource.includes(promptMarker)) {
    const promptReplacement = '          const groundedSystemPrompt = `${systemPrompt}\\n\\n// MKUU_LIVE_EVIDENCE_PRIORITY_V1\\nLIVE WEB SEARCH RESULTS (Tavily):';
    geminiSource = geminiSource.replace(promptMarker, promptReplacement);
    geminiSource = geminiSource.replace(
      '- Never invent a name, score, date, or event that is not supported by the supplied results.\\n- You may include source names/URLs when useful.',
      '- Never invent a name, score, date, or event that is not supported by the supplied results.\\n- If recent search evidence explicitly confirms an event, do not deny it merely because model memory or older conversation history says otherwise.\\n- Treat recent Tavily evidence as authoritative for current factual questions.\\n- You may include source names/URLs when useful.'
    );
    console.log('MKUU: live evidence priority rules applied.');
  }
}
fs.writeFileSync(geminiFile, geminiSource, 'utf8');

const tavilyFile = 'server/tavilySearch.ts';
let tavilySource = fs.readFileSync(tavilyFile, 'utf8');

// Worldwide Tavily fan-out: general web + current news + official/public social pages.
if (!tavilySource.includes('MKUU_GLOBAL_LIVE_SEARCH_V2')) {
  const marker = " const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
  const replacement = " const searches:Promise<TavilySearchResult[]>[]=[\n   runTavilySearch(query,'general'),\n   runTavilySearch(`${query} latest current update news today`,'news'),\n   runTavilySearch(`${query} latest official announcement statement 2026`,'general'),\n   runTavilySearch(`${query} latest public social media Instagram TikTok YouTube Facebook X Twitter`,'general'),\n ];\n // MKUU_GLOBAL_LIVE_SEARCH_V2\n // Worldwide evidence fan-out: web/news plus public social/official sources.\n";
  if (tavilySource.includes(marker)) {
    tavilySource = tavilySource.replace(marker, replacement);
    console.log('MKUU: Global worldwide Tavily evidence fan-out V2 enabled.');
  } else {
    console.log('MKUU: Global Tavily fan-out is already owned by another source layer; continuing.');
  }
}

// Make Tavily return and expose publication dates when the API provides them.
if (!tavilySource.includes('MKUU_TAVILY_PUBLISHED_DATE_V1')) {
  tavilySource = tavilySource.replace(
    'export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }',
    'export interface TavilySearchResult { title: string; url: string; content: string; score?: number; published_date?: string; }\\n// MKUU_TAVILY_PUBLISHED_DATE_V1'
  );
  tavilySource = tavilySource.replace(
    "topic,max_results:8,include_answer:false,include_raw_content:false,...(includeDomains?.length?{include_domains:includeDomains}:{})",
    "topic,max_results:8,include_answer:false,include_raw_content:false,...(topic==='news'?{days:30}:{}),...(includeDomains?.length?{include_domains:includeDomains}:{})"
  );
  tavilySource = tavilySource.replace(
    "Kichwa: ${String(r?.title||'').trim()}\\nURL:",
    "Kichwa: ${String(r?.title||'').trim()}\\nTarehe ya kuchapishwa: ${String(r?.published_date||'Haijatajwa').trim()}\\nURL:"
  );
}

// For current-information questions, dated evidence beats an undated high-score result.
if (!tavilySource.includes('MKUU_TAVILY_FRESHNESS_ORDER_V1')) {
  const old = 'const results=Array.from(unique.values()).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,20);';
  if (tavilySource.includes(old)) {
    const replacement = `// MKUU_TAVILY_FRESHNESS_ORDER_V1\nconst results=Array.from(unique.values()).sort((a,b)=>{\n  const ad=Date.parse(String(a?.published_date||''));\n  const bd=Date.parse(String(b?.published_date||''));\n  if(Number.isFinite(ad)&&Number.isFinite(bd)&&ad!==bd) return bd-ad;\n  if(Number.isFinite(bd)&&!Number.isFinite(ad)) return 1;\n  if(Number.isFinite(ad)&&!Number.isFinite(bd)) return -1;\n  return Number(b?.score||0)-Number(a?.score||0);\n}).slice(0,20);`;
    tavilySource = tavilySource.replace(old, replacement);
  }
}

fs.writeFileSync(tavilyFile, tavilySource, 'utf8');
console.log('MKUU: Global live web engine now prioritizes worldwide current web/news/social evidence and never lets Gemini memory outrank Tavily.');
