const fs = require('node:fs');

const file = 'server/tavilySearch.ts';
let source = fs.readFileSync(file, 'utf8');

// MKUU_GLOBAL_LIVE_WEB_V2 owns the main worldwide search fan-out. This script
// must only add entertainment-specific detection/rules and must never fail when
// the global engine has already replaced the old search insertion point.
if (!source.includes('MKUU_ENTERTAINMENT_LIVE_SEARCH_V2')) {
  const termsMarker = 'const GOVERNMENT_TERMS =';
  if (!source.includes('const ENTERTAINMENT_TERMS =')) {
    if (!source.includes(termsMarker)) {
      throw new Error('MKUU: entertainment terms insertion point not found.');
    }
    source = source.replace(termsMarker, `const ENTERTAINMENT_TERMS = ['msanii','wasanii','artist','singer','musician','actor','actress','celebrity','staa','bongo fleva','bongofleva','wcb','wasafi','zuchu','diamond platnumz','harmonize','rayvanny','alikiba','marioo','burna boy','wizkid','davido','tiwa savage','ayra starr','tems','rihanna','beyonce','taylor swift','drake','travis scott','movie','filamu','muziki','music','album','wimbo','song','concert','baby','pregnancy','ujauzito','kujifungua','amejifungua','mtoto wa','talaka','divorce','relationship','harusi','wedding','award','tuzo','instagram','tiktok','youtube','facebook','x.com','twitter'];
function isEntertainmentQuery(query: string): boolean { const lower = String(query || '').toLowerCase(); return ENTERTAINMENT_TERMS.some(t => lower.includes(t)); }
` + termsMarker);
  }

  const searchMarker = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
  const globalMarker = 'MKUU_GLOBAL_LIVE_SEARCH_V2';

  // If the old marker still exists, add entertainment-specific searches.
  if (source.includes(searchMarker)) {
    source = source.replace(searchMarker, `${searchMarker}
// MKUU_ENTERTAINMENT_LIVE_SEARCH_V2
if (isEntertainmentQuery(query)) {
  searches.push(runTavilySearch(\`${query} latest celebrity entertainment news worldwide today current\`, 'news'));
  searches.push(runTavilySearch(\`${query} latest Tanzania entertainment celebrity news current\`, 'news', ['mwanaspoti.co.tz','thecitizen.co.tz','wasafimedia.co.tz','globalpublishers.co.tz']));
  searches.push(runTavilySearch(\`${query} latest official social media Instagram TikTok YouTube Facebook X\`, 'general', ['instagram.com','tiktok.com','youtube.com','facebook.com','x.com','twitter.com']));
  searches.push(runTavilySearch(\`${query} latest baby pregnancy birth child relationship marriage breakup award album concert\`, 'news'));
  searches.push(runTavilySearch(\`${query} latest confirmed report source date 2026\`, 'general'));
}
`);
  } else if (source.includes(globalMarker)) {
    // Global engine already searches worldwide news/social sources. Do not fail
    // merely because its replacement removed the legacy insertion marker.
    console.log('MKUU: Global Live Web V2 owns the search fan-out; entertainment routing remains compatible.');
  } else {
    throw new Error('MKUU: no compatible live-search insertion point found.');
  }

  if (!source.includes('[GLOBAL ENTERTAINMENT LIVE-SEARCH RULES]')) {
    const rulesMarker = 'return formatResults(results);';
    if (!source.includes(rulesMarker)) throw new Error('MKUU: entertainment result rules insertion point not found.');
    source = source.replace(rulesMarker, `return formatResults(results) + '\n\n[GLOBAL ENTERTAINMENT LIVE-SEARCH RULES]\n- Search worldwide web/news plus major social networks for artists and celebrities.\n- Check Instagram, TikTok, YouTube, Facebook and X/Twitter when relevant.\n- Treat a direct post from the person or verified official account as primary evidence when available.\n- Do not dismiss a claim merely because it first appears on social media; corroborate with recent reporting when possible.\n- Prefer the newest dated evidence and distinguish publication date from event date.\n- If reports conflict, investigate further and clearly state the conflict instead of declaring the information false without evidence.\n- Never invent names, dates, locations or other details that retrieved evidence does not support.\n`);
  }

  source = source.replace(/(if \(isEntertainmentQuery\(query\)\) \{[\s\S]*?\n\})\n\1/, '$1');
  source += '\n// MKUU_ENTERTAINMENT_LIVE_SEARCH_V2\n';
  fs.writeFileSync(file, source, 'utf8');
  console.log('MKUU: Global entertainment/celebrity web + social live search enabled worldwide.');
} else {
  console.log('MKUU: Global entertainment/celebrity web + social live search already enabled.');
}
