const fs = require('node:fs');

const geminiFile = 'server/geminiService.ts';
let geminiSource = fs.readFileSync(geminiFile, 'utf8');

// The existing GeminiService already has the Tavily-authority block. Only patch
// the search-intent detector here. Do not rewrite groundedContents or prompt
// strings at build time; those previous injections were the source of malformed
// TypeScript and allowed stale-history regressions.
const oldMethod = /  private detectSearchIntent\(message: string\): boolean \{[\s\S]*?\n  \}\n\n  private isInsufficientKnowledgeResponse/;
const newMethod = String.raw`  // MKUU_GLOBAL_LIVE_WEB_V2
  private detectSearchIntent(message: string): boolean {
    if (!message) return false;
    const lower = message.toLowerCase().trim();
    const personalOnly = [
      'mke wangu unamjua', 'mke wangu ni nani', 'mume wangu ni nani', 'mama yangu ni nani',
      'baba yangu ni nani', 'mtoto wangu ni nani', 'unamjua ', 'unakumbuka ', 'kumbuka ',
      'nimekwambia', 'nilikuambia', 'nilikwambia', 'max memory'
    ];
    if (personalOnly.some((x) => lower.includes(x))) return false;

    const explicitSearch = /\b(tafuta|search|google|web|mtandao|online|source|chanzo)\b/i.test(lower);
    const currentSignals = /\b(leo|kesho|jana|sasa|hivi sasa|kwa sasa|latest|current|today|tomorrow|yesterday|now|recent|recently|breaking|live|updated|update|mpya|hivi punde|hivi karibuni)\b/i.test(lower);
    const factualQuestion = /^(nani|nini|lini|wapi|kwa nini|vipi|je|how|who|what|when|where|why|which|is|are|can|does|did|will)\b/i.test(lower) || /[?？]/.test(lower);
    const dynamicDomains = /\b(serikali|rais|waziri|wizara|kiongozi|uchaguzi|siasa|habari|news|michezo|mpira|football|soccer|basketball|tennis|cricket|mechi|mchezo|ratiba|matokeo|score|standings|msimamo|biashara|kampuni|uchumi|economy|market|hisa|stock|bei|price|dola|exchange rate|sarafu|crypto|bitcoin|ethereum|msanii|wasanii|artist|celebrity|music|album|wimbo|concert|movie|filamu|technology|teknolojia|ai|artificial intelligence|iphone|android|product|launch|event|weather|hali ya hewa|trafiki|flight|ndege|visa|sheria|law|court|mahakama|scientist|sayansi|space|science|transfer|injury|election|president|minister|prime minister|company|business|finance|stock price|zuchu|diamond|wcb|wasafi|instagram|tiktok|youtube|facebook|twitter|x.com)\b/i.test(lower);

    if (explicitSearch || currentSignals || (factualQuestion && dynamicDomains)) return true;
    // Any normal factual question is live-web first. This is the key worldwide
    // behavior: government, sport, business, entertainment, technology, world
    // news and other dynamic facts must not be answered from Gemini memory.
    if (factualQuestion && lower.length >= 8 && lower.length <= 500) return true;
    return false;
  }

  private isInsufficientKnowledgeResponse`;

if (oldMethod.test(geminiSource)) {
  geminiSource = geminiSource.replace(oldMethod, newMethod);
  console.log('MKUU: Global live factual-question routing V2 applied safely.');
} else if (geminiSource.includes('MKUU_GLOBAL_LIVE_WEB_V2')) {
  console.log('MKUU: Global live factual-question routing V2 already applied.');
} else {
  console.log('MKUU: Global live routing detector anchor changed; continuing without unsafe injection.');
}

fs.writeFileSync(geminiFile, geminiSource, 'utf8');

const tavilyFile = 'server/tavilySearch.ts';
let tavilySource = fs.readFileSync(tavilyFile, 'utf8');

// Worldwide Tavily fan-out. Keep the generated TypeScript as plain source text;
// String.raw prevents build-time interpolation of the runtime `query` variable.
if (!tavilySource.includes('MKUU_GLOBAL_LIVE_SEARCH_V2')) {
  const marker = " const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
  const replacement = String.raw` const searches:Promise<TavilySearchResult[]>[]=[
   runTavilySearch(query,'general'),
   runTavilySearch(\`${query} latest current update news today\`,'news'),
   runTavilySearch(\`${query} latest official announcement statement 2026\`,'general'),
   runTavilySearch(\`${query} latest public social media Instagram TikTok YouTube Facebook X Twitter\`,'general'),
 ];
 // MKUU_GLOBAL_LIVE_SEARCH_V2
 // Worldwide evidence fan-out: web/news plus public social/official sources.
`;
  if (tavilySource.includes(marker)) {
    tavilySource = tavilySource.replace(marker, replacement);
    console.log('MKUU: Global worldwide Tavily evidence fan-out V2 enabled safely.');
  } else {
    console.log('MKUU: Global Tavily fan-out is already owned by another source layer; continuing.');
  }
} else {
  console.log('MKUU: Global worldwide Tavily evidence fan-out already enabled.');
}

fs.writeFileSync(tavilyFile, tavilySource, 'utf8');
console.log('MKUU: Global live web engine is Tavily-first worldwide; Gemini only synthesizes returned evidence.');