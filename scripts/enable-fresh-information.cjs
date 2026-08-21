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
  source = source.replace(
    '- For sports, report the exact latest result from the search evidence; do not substitute an older match.',
    '- For sports, verify the exact fixture date, opponent, competition, venue, and kickoff time from the freshest available evidence. For Tanzanian football, prefer the Tanzania Football Federation/TFF official fixture or ticket listing when available. Never guess or convert a kickoff time from a secondary site when an authoritative Tanzania-local time is available.'
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
    'if(sports){\n   searches.push(runTavilySearch(`${query} final score FT full time result completed match`,' + "'news'" + '));',
    'if(sports){\n   const tomorrowDate = containsRelativeDay(query,\'kesho\') ? getTanzaniaDate(1) : getTanzaniaDate(0);\n   const yesterdayDate = containsRelativeDay(query,\'jana\') ? getTanzaniaDate(-1) : getTanzaniaDate(0);\n   // For Tanzanian fixtures, query the official TFF ticket/fixture source directly.\n   // This prevents a secondary site with a stale or incorrectly converted kickoff time\n   // from winning merely because its text matches the query better.\n   searches.unshift(runTavilySearch(`${query} Tanzania Football Federation official fixture kickoff ${tomorrowDate}`,\'general\',[\'tff-tickets.com\']));\n   searches.push(runTavilySearch(`${query} official TFF fixture kickoff time Tanzania`,\'general\',[\'tff-tickets.com\']));\n   searches.push(runTavilySearch(`${query} final score FT full time result completed match`,' + "'news'" + '));'
  );
  source = source.replace(
    'if(containsRelativeDay(query,\'jana\'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(-1)} FT final score result completed`,\'news\'));',
    'if(containsRelativeDay(query,\'jana\'))searches.push(runTavilySearch(`${query} Tanzania ${yesterdayDate} FT final score result completed`,\'news\'));'
  );
  source = source.replace(
    'if(containsRelativeDay(query,\'leo\'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(0)} FT final score result completed`,\'news\'));',
    'if(containsRelativeDay(query,\'leo\'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(0)} FT final score result completed`,\'news\'));'
  );
  source = source.replace(
    'if(containsRelativeDay(query,\'kesho\'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(1)} fixture schedule`,\'news\'));',
    'if(containsRelativeDay(query,\'kesho\'))searches.push(runTavilySearch(`${query} Tanzania ${tomorrowDate} fixture schedule kickoff time`,\'news\'));'
  );
  source = source.replace(
    'const results=Array.from(unique.values()).sort((a,b)=>{\n  const aDate=Date.parse(String(a.published_date||\'\'));\n  const bDate=Date.parse(String(b.published_date||\'\'));\n  if(Number.isFinite(aDate)&&Number.isFinite(bDate)&&aDate!==bDate) return bDate-aDate;\n  if(Number.isFinite(bDate)&&!Number.isFinite(aDate)) return 1;\n  if(Number.isFinite(aDate)&&!Number.isFinite(bDate)) return -1;\n  return Number(b.score||0)-Number(a.score||0);\n}).slice(0,20);',
    `const results=Array.from(unique.values()).sort((a,b)=>{
  const aUrl=String(a?.url||'').toLowerCase();
  const bUrl=String(b?.url||'').toLowerCase();
  const aOfficialSports=aUrl.includes('tff-tickets.com');
  const bOfficialSports=bUrl.includes('tff-tickets.com');
  if(sports && aOfficialSports!==bOfficialSports) return aOfficialSports ? -1 : 1;
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

console.log('MKUU: fresh-information routing, newest-result ranking, and authoritative TFF sports verification enabled.');
