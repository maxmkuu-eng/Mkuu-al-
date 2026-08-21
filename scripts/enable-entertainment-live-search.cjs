const fs = require('node:fs');

const file = 'server/tavilySearch.ts';
const source = fs.readFileSync(file, 'utf8');
if (source.includes('MKUU_ENTERTAINMENT_LIVE_SEARCH_V1')) {
  console.log('MKUU: entertainment live search already enabled.');
  process.exit(0);
}

let next = source;
const termsMarker = "const GOVERNMENT_TERMS =";
if (!next.includes(termsMarker)) throw new Error('MKUU: entertainment terms insertion point not found.');
next = next.replace(termsMarker, "const ENTERTAINMENT_TERMS = ['msanii','wasanii','artist','singer','musician','actor','actress','celebrity','staa','bongo fleva','bongofleva','wcb','wasafi','zuchu','diamond platnumz','harmonize','rayvanny','alikiba','marioo','kiba','burna boy','wizkid','davido','tiwa savage','ayra starr','tems','rihanna','beyonce','taylor swift','drake','travis scott','movie','filamu','muziki','music','album','wimbo','song','concert','baby','pregnancy','ujauzito','kujifungua','amejifungua','mtoto wa','talaka','divorce','relationship','harusi','wedding','award','tuzo','mtandaoni','instagram','tiktok','youtube'];\nfunction isEntertainmentQuery(query: string): boolean { const lower=String(query||'').toLowerCase(); return ENTERTAINMENT_TERMS.some(t=>lower.includes(t)); }\n" + termsMarker);

const searchMarker = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
if (!next.includes(searchMarker)) throw new Error('MKUU: entertainment search insertion point not found.');
const injected = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];\n// MKUU_ENTERTAINMENT_LIVE_SEARCH_V1\nif(isEntertainmentQuery(query)){\n  searches.push(runTavilySearch(`${query} latest entertainment celebrity news today August 2026`,'news'));\n  searches.push(runTavilySearch(`${query} latest Tanzania entertainment news celebrity update`,'news',['mwanaspoti.co.tz','thecitizen.co.tz','wasafimedia.co.tz','globalpublishers.co.tz']));\n  searches.push(runTavilySearch(`${query} latest social media Instagram TikTok YouTube official update`,'general',['instagram.com','tiktok.com','youtube.com']));\n  searches.push(runTavilySearch(`${query} latest baby pregnancy birth child relationship official statement`,'news'));\n}";
next = next.replace(searchMarker, injected);

const rulesMarker = "return formatResults(results);";
if (!next.includes(rulesMarker)) throw new Error('MKUU: entertainment output insertion point not found.');
next = next.replace(rulesMarker, "return formatResults(results) + '\\n\\n[ENTERTAINMENT LIVE-SEARCH RULES]\\n- For artists and celebrities, search current entertainment news plus official social accounts.\\n- Treat a direct post from the person or verified official account as primary evidence when available.\\n- Do not dismiss a claim merely because it is from social media; verify it against additional recent reporting when possible.\\n- Prefer the newest evidence and include publication dates.\\n- If reports conflict, clearly state the conflict instead of claiming there is no reliable information.\\n';");

fs.writeFileSync(file, next, 'utf8');
console.log('MKUU: Global entertainment/celebrity live search enabled for Tanzania and worldwide.');
