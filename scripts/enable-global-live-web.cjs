const fs = require('node:fs');

const geminiFile = 'server/geminiService.ts';
const geminiSource = fs.readFileSync(geminiFile, 'utf8');

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
    if (factualQuestion && lower.length >= 8 && lower.length <= 300) return true;
    return false;
  }

  private isInsufficientKnowledgeResponse`;

if (oldMethod.test(geminiSource)) {
  fs.writeFileSync(geminiFile, geminiSource.replace(oldMethod, newMethod), 'utf8');
  console.log('MKUU: Global live factual-question routing V2 applied.');
} else if (geminiSource.includes('MKUU_GLOBAL_LIVE_WEB_V2')) {
  console.log('MKUU: Global live factual-question routing V2 already applied.');
} else {
  throw new Error('MKUU: global live web detectSearchIntent insertion point not found.');
}

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
