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
  const helper = `function isFreshInformationQuery(message: string): boolean {
  const lower = String(message || '').toLowerCase().trim();
  const freshnessTerms = [
    'latest', 'current', 'currently', 'right now', 'now', 'today', 'yesterday', 'tomorrow',
    'recent', 'recently', 'newest', 'updated', 'update', 'breaking', 'sasa', 'hivi sasa',
    'leo', 'jana', 'kesho', 'kwa sasa', 'ya sasa', 'mpya', 'habari mpya', 'tukio la sasa',
    'nani ni waziri', 'waziri mkuu', 'rais wa', 'naibu waziri', 'meya wa', 'kiongozi wa sasa',
    'current minister', 'prime minister', 'current president', 'current leader', 'current ceo'
  ];
  return freshnessTerms.some(term => lower.includes(term));
}

`;
  if (!source.includes('function isFreshInformationQuery(message: string): boolean')) {
    const marker = 'export class GeminiService {';
    if (!source.includes(marker)) throw new Error('MKUU: GeminiService class marker not found.');
    source = source.replace(marker, helper + marker);
  }
  source = source.replace(
    'const isSearchQuery = this.detectSearchIntent(message);',
    'const isSearchQuery = this.detectSearchIntent(message) || isFreshInformationQuery(message);'
  );
  source = source.replace(
    'const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);',
    'const tavilyResults = await searchWithTavily(`${message}\\nCURRENT INFORMATION VERIFICATION REQUIRED. Current date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}\\nPrefer the newest authoritative information and do not use older knowledge when newer evidence exists.`);'
  );
  return source;
});

patch('server/tavilySearch.ts', 'Tavily freshness ranking', (source) => {
  source = source.replace(
    'export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }',
    'export interface TavilySearchResult { title: string; url: string; content: string; score?: number; published_date?: string; }'
  );
  source = source.replace(
    "body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(includeDomains?.length?{include_domains:includeDomains}:{})})",
    "body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(topic==='news'?{days:30}:{}),...(includeDomains?.length?{include_domains:includeDomains}:{})})"
  );
  source = source.replace(
    "Kichwa: ${String(r?.title||'').trim()}\\nURL:",
    "Kichwa: ${String(r?.title||'').trim()}\\nTarehe ya kuchapishwa: ${String(r?.published_date||'Haijatajwa').trim()}\\nURL:"
  );
  source = source.replace(
    'const results=Array.from(unique.values()).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,20);',
    `const results=Array.from(unique.values()).sort((a,b)=>{
  const aDate=Date.parse(String(a.published_date||''));
  const bDate=Date.parse(String(b.published_date||''));
  if(Number.isFinite(aDate)&&Number.isFinite(bDate)&&aDate!==bDate) return bDate-aDate;
  if(Number.isFinite(bDate)&&!Number.isFinite(aDate)) return 1;
  if(Number.isFinite(aDate)&&!Number.isFinite(bDate)) return -1;
  return Number(b.score||0)-Number(a.score||0);
}).slice(0,20);`
  );
  return source;
});

console.log('MKUU: fresh-information routing and newest-result ranking enabled.');
