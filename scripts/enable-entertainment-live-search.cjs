const fs = require('node:fs');

const file = 'server/tavilySearch.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = 'MKUU_GLOBAL_LIVE_SEARCH_V2';
const entertainmentMarker = 'MKUU_ENTERTAINMENT_LIVE_SEARCH_V3';

if (!source.includes(entertainmentMarker)) {
  const termsMarker = 'const GOVERNMENT_TERMS =';
  if (!source.includes('const ENTERTAINMENT_TERMS =')) {
    if (!source.includes(termsMarker)) {
      console.log('MKUU: entertainment terms already owned by another live-search layer; continuing.');
    } else {
      source = source.replace(termsMarker, `const ENTERTAINMENT_TERMS = ['msanii','wasanii','artist','singer','musician','actor','actress','celebrity','staa','bongo fleva','bongofleva','wcb','wasafi','zuchu','diamond platnumz','harmonize','rayvanny','alikiba','marioo','burna boy','wizkid','davido','tiwa savage','ayra starr','tems','rihanna','beyonce','taylor swift','drake','travis scott','movie','filamu','muziki','music','album','wimbo','song','concert','baby','pregnancy','ujauzito','kujifungua','amejifungua','mtoto wa','talaka','divorce','relationship','harusi','wedding','award','tuzo','instagram','tiktok','youtube','facebook','x.com','twitter'];
function isEntertainmentQuery(query: string): boolean { const lower = String(query || '').toLowerCase(); return ENTERTAINMENT_TERMS.some(t => lower.includes(t)); }
` + termsMarker);
    }
  }

  const globalFanoutMarker = ' // MKUU_GLOBAL_LIVE_SEARCH_V2';
  const legacySearchMarker = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
  const entertainmentBlock = `\n // MKUU_ENTERTAINMENT_LIVE_SEARCH_V3\n if(isEntertainmentQuery(query)){\n   searches.unshift(runTavilySearch(\`${query} latest entertainment celebrity news worldwide current 2026\`,'news'));\n   searches.unshift(runTavilySearch(\`${query} latest Tanzania entertainment celebrity news current 2026\`,'news',['mwanaspoti.co.tz','thecitizen.co.tz','wasafimedia.co.tz','globalpublishers.co.tz']));\n   searches.unshift(runTavilySearch(\`${query} latest official Instagram TikTok YouTube Facebook X Twitter post statement\`,'general',['instagram.com','tiktok.com','youtube.com','facebook.com','x.com','twitter.com']));\n   searches.unshift(runTavilySearch(\`${query} latest baby pregnancy birth child relationship marriage breakup confirmed\`,'news'));\n   searches.unshift(runTavilySearch(\`${query} latest confirmed report today source date official statement\`,'general'));\n }\n`;

  if (source.includes(globalFanoutMarker)) {
    source = source.replace(globalFanoutMarker, entertainmentBlock + globalFanoutMarker);
  } else if (source.includes(legacySearchMarker)) {
    source = source.replace(legacySearchMarker, legacySearchMarker + entertainmentBlock);
  } else {
    console.log('MKUU: no compatible Tavily fan-out marker found; global source layer will remain authoritative.');
  }

  const rulesMarker = 'return formatResults(results);';
  if (source.includes(rulesMarker) && !source.includes('[GLOBAL ENTERTAINMENT LIVE-SEARCH RULES]')) {
    source = source.replace(rulesMarker, `return formatResults(results) + '\n\n[GLOBAL ENTERTAINMENT LIVE-SEARCH RULES]\n- For entertainment and celebrity questions, search worldwide web/news and public social-media pages.\n- Check Instagram, TikTok, YouTube, Facebook and X/Twitter when relevant.\n- A direct post from the person or verified official account is valid evidence; do not dismiss it merely because it is social media.\n- Corroborate major claims with recent independent reporting where available.\n- Prefer the newest dated evidence and distinguish publication date from event date.\n- If sources conflict, report the conflict and use the newest/most authoritative evidence instead of reverting to model memory.\n- Never declare a claim false solely because an official statement was not found.\n`);
  }

  fs.writeFileSync(file, source, 'utf8');
  console.log('MKUU: Worldwide entertainment + social Tavily search enabled.');
} else {
  console.log('MKUU: Worldwide entertainment + social Tavily search already enabled.');
}
