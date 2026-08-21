const fs = require('node:fs');

function patch(file, label, fn) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`MKUU: ${label} applied.`);
  } else {
    console.log(`MKUU: ${label} already applied.`);
  }
}

patch('server/geminiService.ts', 'fresh-information intent routing', (source) => {
  if (!source.includes('function isFreshInformationQuery(message: string): boolean')) {
    const helper = `function isFreshInformationQuery(message: string): boolean {\n  const lower = String(message || '').toLowerCase().trim();\n  const personalOrCasual = ['mke wangu','mume wangu','familia yangu','mtoto wangu','mama yangu','baba yangu','rafiki yangu','unamjua','unamkumbuka','unakumbuka','nilikwambia','nilikuambia','nilituma','niliweka kwenye mfumo','habari mkuu','salama mkuu','asante mkuu','sawa mkuu'];\n  if (personalOrCasual.some(term => lower.includes(term))) return false;\n  const freshnessTerms = ['latest','current','currently','right now','now','today','yesterday','tomorrow','recent','recently','newest','updated','update','breaking','sasa','hivi sasa','leo','jana','kesho','kwa sasa','ya sasa','mpya','habari mpya','tukio la sasa','nani ni waziri','waziri mkuu','rais wa','naibu waziri','meya wa','kiongozi wa sasa','current minister','prime minister','current president','current leader','current ceo'];\n  const webTopicTerms = ['serikali','wizara','ikulu','bunge','rais','waziri','uchaguzi','siasa','sheria','mahakama','tanzania','dunia','habari','news','breaking','michezo','mchezo','mechi','simba','yanga','azam','football','soccer','nba','basketball','tennis','caf','fifa','epl','uefa','champions league','biashara','kampuni','company','business','soko','market','bei','price','hisa','stock','fedha','currency','exchange rate','dola','crypto','bitcoin','uchumi','economy','benki','bank','msanii','msanii wa','wasanii','artist','singer','actor','movie','filamu','muziki','music','concert','album','wimbo','technology','teknolojia','ai','gemini','openai','google','iphone','samsung','app','programu','product','release','tuzo','award','transfer','ratiba','matokeo','msimamo','kikosi','score','fixture','schedule','weather','hali ya hewa'];\n  const interrogative = /^(nani|nini|lini|wapi|kwa nini|vipi|je|ni nani|ni nini|ni lini|ni wapi|how|who|what|when|where|why|which|how much|how many|does|is|are|can|will)\\b/i.test(lower);\n  return freshnessTerms.some(term => lower.includes(term)) || webTopicTerms.some(term => lower.includes(term)) || interrogative;\n}\n\n`;
    const marker = 'export class GeminiService {';
    if (!source.includes(marker)) {
      console.log('MKUU: GeminiService class marker already owned by Global Live Web engine; skipped optional fresh-information injection.');
      return source;
    }
    source = source.replace(marker, helper + marker);
  }
  source = source.replace('const isSearchQuery = this.detectSearchIntent(message);','const isSearchQuery = this.detectSearchIntent(message) || isFreshInformationQuery(message);');
  source = source.replace('const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);','const tavilyResults = await searchWithTavily(`${message}\\nCURRENT INFORMATION VERIFICATION REQUIRED. Current date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}\\nPrefer the newest authoritative information and do not use older knowledge when newer evidence exists.`);');
  const oldSports = '- For sports, report the exact latest result from the search evidence; do not substitute an older match.';
  const newSports = '- For sports, verify the exact fixture date, opponent, competition, venue, and kickoff time. For Tanzanian football, treat an official TFF fixture/ticket listing as authoritative when available. Use Tanzania-local kickoff time exactly as published; never guess or convert a secondary-site time when an authoritative local time is available.';
  if (source.includes(oldSports)) source = source.replace(oldSports,newSports);
  return source;
});

patch('server/tavilySearch.ts', 'newest-result ranking', (source) => {
  if (source.includes('published_date?: string')) return source;
  source = source.replace('export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }','export interface TavilySearchResult { title: string; url: string; content: string; score?: number; published_date?: string; }');
  source = source.replace("body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(includeDomains?.length?{include_domains:includeDomains}:{})})","body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(topic==='news'?{days:30}:{}),...(includeDomains?.length?{include_domains:includeDomains}:{})})");
  source = source.replace('Kichwa: ${String(r?.title||\'\').trim()}\\nURL:','Kichwa: ${String(r?.title||\'\').trim()}\\nTarehe ya kuchapishwa: ${String(r?.published_date||\'Haijatajwa\').trim()}\\nURL:');
  return source;
});

console.log('MKUU: fresh-information routing and newest-result ranking enabled safely.');
