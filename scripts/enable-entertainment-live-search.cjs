const fs = require('node:fs');

const file = 'server/tavilySearch.ts';
const source = fs.readFileSync(file, 'utf8');
if (source.includes('MKUU_ENTERTAINMENT_LIVE_SEARCH_V2')) {
  console.log('MKUU: entertainment global live search already enabled.');
  process.exit(0);
}

let next = source;
const termsMarker = "const GOVERNMENT_TERMS =";
if (!next.includes(termsMarker)) throw new Error('MKUU: entertainment terms insertion point not found.');
next = next.replace(termsMarker, "const ENTERTAINMENT_TERMS = ['msanii','wasanii','artist','singer','musician','actor','actress','celebrity','staa','bongo fleva','bongofleva','wcb','wasafi','zuchu','diamond platnumz','harmonize','rayvanny','alikiba','marioo','kiba','burna boy','wizkid','davido','tiwa savage','ayra starr','tems','rihanna','beyonce','taylor swift','drake','travis scott','movie','filamu','muziki','music','album','wimbo','song','concert','baby','pregnancy','ujauzito','kujifungua','amejifungua','mtoto wa','talaka','divorce','relationship','harusi','wedding','award','tuzo','mtandaoni','instagram','tiktok','youtube','facebook','x.com','twitter'];\nfunction isEntertainmentQuery(query: string): boolean { const lower=String(query||'').toLowerCase(); return ENTERTAINMENT_TERMS.some(t=>lower.includes(t)); }\n" + termsMarker);

const searchMarker = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];";
if (!next.includes(searchMarker)) throw new Error('MKUU: entertainment search insertion point not found.');
const injected = "const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];\n// MKUU_ENTERTAINMENT_LIVE_SEARCH_V2\nif(isEntertainmentQuery(query)){\n  searches.push(runTavilySearch(`${query} latest celebrity entertainment news worldwide today current`,'news'));\n  searches.push(runTavilySearch(`${query} latest Tanzania entertainment celebrity news current`,'news',['mwanaspoti.co.tz','thecitizen.co.tz','wasafimedia.co.tz','globalpublishers.co.tz']));\n  searches.push(runTavilySearch(`${query} official Instagram latest post`,'general',['instagram.com']));\n  searches.push(runTavilySearch(`${query} latest TikTok post video`,'general',['tiktok.com']));\n  searches.push(runTavilySearch(`${query} latest YouTube official channel video`,'general',['youtube.com']));\n  searches.push(runTavilySearch(`${query} latest Facebook official page post`,'general',['facebook.com']));\n  searches.push(runTavilySearch(`${query} latest X Twitter official post`,'general',['x.com','twitter.com']));\n  searches.push(runTavilySearch(`${query} latest baby pregnancy birth child relationship marriage breakup award album concert`,'news'));\n  searches.push(runTavilySearch(`${query} latest confirmed report source date 2026`,'general'));\n} else {\n  searches.push(runTavilySearch(`${query} latest current updated worldwide news`,'news'));\n}";
next = next.replace(searchMarker, injected);

const rulesMarker = "return formatResults(results);";
if (!next.includes(rulesMarker)) throw new Error('MKUU: entertainment output insertion point not found.');
next = next.replace(rulesMarker, "return formatResults(results) + '\\n\\n[GLOBAL ENTERTAINMENT LIVE-SEARCH RULES]\\n- Search worldwide web/news plus major social networks for artists and celebrities.\\n- Check Instagram, TikTok, YouTube, Facebook and X/Twitter when relevant.\\n- Treat a direct post from the person or verified official account as primary evidence when available.\\n- Do not dismiss a claim merely because it first appears on social media; corroborate with recent reporting when possible.\\n- Prefer the newest dated evidence and distinguish publication date from event date.\\n- If reports conflict, investigate further and clearly state the conflict instead of declaring the information false without evidence.\\n- Never invent names, dates, locations or other details that the retrieved evidence does not support.\\n';");

fs.writeFileSync(file, next, 'utf8');
console.log('MKUU: Global entertainment/celebrity web + social live search enabled worldwide.');
