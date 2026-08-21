export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }
export interface TavilySource { title: string; url: string; }
let lastTavilySources: TavilySource[] = [];
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }

const SPORTS_TERMS = ['yanga','young africans','simba sc','simba','azam fc','coastal union','polisi tanzania','jkt tanzania','namungo','mashujaa','geita gold','tabora united','mbeya city','mechi','mchezo','matokeo','score','kikosi','ratiba','magoli','mshindi','football','soccer','match','premier league','champions league','caf','tff','ligi kuu'];
const STANDINGS_TERMS = ['msimamo','standings','table','league table','pointi','points','nafasi','position','pld','played','goal difference','tofauti ya magoli'];
const GOVERNMENT_TERMS = ['waziri','waziri mkuu','naibu waziri','rais wa','makamu wa rais','serikali ya sasa','waziri mwenye dhamana','baraza la mawaziri','mkuu wa mkoa','mkuu wa wilaya','meya wa','kiongozi wa sasa','katibu mkuu','current minister','prime minister','president of tanzania','current government','current cabinet','who is the minister','who is the prime minister'];

function isSportsQuery(query: string): boolean { const lower=query.toLowerCase(); return SPORTS_TERMS.some(t=>lower.includes(t)); }
function isStandingsQuery(query: string): boolean { const lower=query.toLowerCase(); return STANDINGS_TERMS.some(t=>lower.includes(t)) && (lower.includes('ligi')||lower.includes('league')||lower.includes('tanzania')||lower.includes('yanga')||lower.includes('simba')||lower.includes('azam')); }
function isGovernmentQuery(query: string): boolean { const lower=String(query||'').toLowerCase(); return GOVERNMENT_TERMS.some(t=>lower.includes(t)) || (lower.includes('habari')&&(lower.includes('wizara')||lower.includes('serikali'))); }
function getTanzaniaDate(offsetDays=0): string { const now=new Date(); const date=new Date(now.getTime()+offsetDays*86400000); return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function containsRelativeDay(query:string,day:'jana'|'leo'|'kesho'):boolean{return query.toLowerCase().includes(day);}

async function runTavilySearch(query:string,topic:'general'|'news',includeDomains?:string[]):Promise<TavilySearchResult[]> {
 const apiKey=process.env.TAVILY_API_KEY?.trim(); if(!apiKey) throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');
 const response=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(includeDomains?.length?{include_domains:includeDomains}:{})})});
 if(!response.ok){const body=await response.text().catch(()=> '');throw new Error(`Tavily Search HTTP ${response.status}${body?`: ${body.slice(0,500)}`:''}`);}
 const data=await response.json() as {results?:TavilySearchResult[]}; return Array.isArray(data.results)?data.results:[];
}

/**
 * Fetch the live Cabinet page directly from the official Ikulu site.
 * This is intentionally independent of search ranking so an old article can
 * never outrank the current Cabinet page for a current-office question.
 */
async function getOfficialCabinetSnapshot(): Promise<string> {
 const response = await fetch('https://www.ikulu.go.tz/index.php/cabinet', { headers: { Accept: 'text/html', 'User-Agent': 'MKUU-AI/1.0 current-government-verifier' }, cache: 'no-store' } as any);
 if (!response.ok) throw new Error(`Ikulu Cabinet HTTP ${response.status}`);
 const html = await response.text();
 const text = html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 if (!text.includes('Baraza la Mawaziri')) throw new Error('Ikulu Cabinet page did not contain Cabinet data.');
 const targets = [
   'Waziri wa Habari, Utamaduni, Sanaa na Michezo',
   'Waziri Mkuu wa Jamhuri ya Muungano wa Tanzania',
   'Waziri wa Mawasiliano na Teknolojia ya Habari',
 ];
 const extracted:string[]=[];
 for(const target of targets){
   const idx=text.toLowerCase().indexOf(target.toLowerCase());
   if(idx<0) continue;
   const before=text.slice(Math.max(0,idx-350),idx);
   const nameMatches=[...before.matchAll(/MHE\.\s+([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý .'-]{4,})/g)];
   const name=nameMatches.length?nameMatches[nameMatches.length-1][1].trim():'';
   extracted.push(`${target}: ${name || 'Jina halikupatikana moja kwa moja kwenye ukurasa rasmi'}`);
 }
 if(!extracted.length) throw new Error('Ikulu Cabinet page did not expose a recognized current office holder.');
 return `[LIVE OFFICIAL IKULU CABINET SNAPSHOT — FETCHED ${new Date().toISOString()}]\nSource: https://www.ikulu.go.tz/index.php/cabinet\n${extracted.join('\n')}`;
}

export async function searchWithTavily(query:string):Promise<string>{
 lastTavilySources=[]; const sports=isSportsQuery(query); const standings=isStandingsQuery(query); const government=isGovernmentQuery(query);
 const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];
 let officialSnapshot='';
 if(government){
   const currentDate=getTanzaniaDate(0);
   searches.push(runTavilySearch(`Tanzania Baraza la Mawaziri current minister current cabinet ${query} ${currentDate}`,'general',['ikulu.go.tz']));
   searches.push(runTavilySearch(`Tanzania ${query} uteuzi waziri current ${currentDate}`,'news',['ikulu.go.tz']));
   try { officialSnapshot=await getOfficialCabinetSnapshot(); } catch (err) { console.warn('[MKUU-BACKEND] Official Ikulu direct snapshot failed:', err); }
 }
 if(sports){
   searches.push(runTavilySearch(`${query} final score FT full time result completed match`,'news'));
   if(containsRelativeDay(query,'jana')){const yesterday=getTanzaniaDate(-1);searches.push(runTavilySearch(`${query} Tanzania ${yesterday} FT final score result completed`,'news'));}
   if(containsRelativeDay(query,'leo')){const today=getTanzaniaDate(0);searches.push(runTavilySearch(`${query} Tanzania ${today} FT final score result completed`,'news'));}
   if(containsRelativeDay(query,'kesho')){const tomorrow=getTanzaniaDate(1);searches.push(runTavilySearch(`${query} Tanzania ${tomorrow} fixture schedule`,'news'));}
 }
 if(standings){const today=getTanzaniaDate(0);searches.push(runTavilySearch(`Tanzania NBC Premier League 2026/2027 current standings table ${today} P W D L GF GA GD points latest updated`,'general'));searches.push(runTavilySearch(`Tanzania NBC Premier League 2026/2027 latest completed results FT final scores updated ${today} Azam TRA Yanga Coastal Union`,'news'));}
 const settled=await Promise.allSettled(searches); const merged=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]); const unique=new Map<string,TavilySearchResult>();
 for(const result of merged){const url=String(result?.url||'').trim();if(!url)continue;const previous=unique.get(url);if(!previous||Number(result.score||0)>Number(previous.score||0))unique.set(url,result);}
 const allResults=Array.from(unique.values());
 const official=government?allResults.filter(r=>{try{return /(^|\.)ikulu\.go\.tz$/i.test(new URL(String(r.url)).hostname);}catch{return false;}}):[];
 if(government&&official.length===0&&!officialSnapshot) throw new Error('AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE: Ikulu Tanzania returned no official current result. Refusing to answer from potentially stale generic results.');
 const results=(government?[...official,...allResults.filter(r=>!official.includes(r))]:allResults).sort((a,b)=>{const ao=government&&/(^|\.)ikulu\.go\.tz$/i.test(new URL(String(a.url)).hostname)?1:0;const bo=government&&/(^|\.)ikulu\.go\.tz$/i.test(new URL(String(b.url)).hostname)?1:0;if(ao!==bo)return bo-ao;return Number(b.score||0)-Number(a.score||0);}).slice(0,20);
 if(!results.length&&!officialSnapshot)throw new Error('Tavily Search returned no results.');
 lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);
 const evidence=results.map((r,i)=>`[CHANZO ${i+1}]\nKichwa: ${String(r?.title||'').trim()}\nURL: ${String(r?.url||'').trim()}\nTaarifa: ${String(r?.content||'').trim()}`).join('\n\n');
 const governmentRules=government?`\n\n[GOVERNMENT CURRENT-OFFICE VERIFICATION RULE]\n- The LIVE OFFICIAL IKULU CABINET SNAPSHOT is the highest-priority evidence and is fetched directly from Ikulu on this request.\n- If the snapshot identifies an office holder, that name MUST be used as the current office holder. Do not replace it with a name from model memory, an old article, or a generic search result.\n- Official Ikulu evidence overrides older articles, old ministry pages, cached snippets and conflicting stale search results.\n- Do not merge old and new cabinets.\n- If Ikulu shows that portfolios were combined or renamed, use the current combined ministry structure.\n- Never report a former minister as current when the official Ikulu evidence identifies another current office holder.\n- If official evidence cannot establish the current office holder, say it could not be verified instead of guessing.`:'';
 const dateRules=sports?`\n\n[SPORTS VERIFICATION RULE]\n- For jana use ${getTanzaniaDate(-1)}; for leo use ${getTanzaniaDate(0)}.\n- Completed FT results on the requested date are stronger evidence than previews, predictions, scheduled fixtures or old H2H results.\n- Never answer hakuna mechi merely because one source is a preview; compare all evidence.`:'';
 const standingsRules=standings?`\n\n[STANDINGS VERIFICATION RULE]\n- Prefer the newest explicit current standings table.\n- Count only completed FT results; do not count future fixtures, previews or predictions.\n- If evidence conflicts, use the newest credible evidence or state that verification failed rather than inventing numbers.\n- Final table columns: # | Timu | P | W | D | L | GF | GA | GD | Pts.`:'';
 return [officialSnapshot,evidence,governmentRules,dateRules,standingsRules].filter(Boolean).join('\n\n');
}
