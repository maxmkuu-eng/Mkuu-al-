export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }
export interface TavilySource { title: string; url: string; }
let lastTavilySources: TavilySource[] = [];
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }

const SPORTS_TERMS = ['yanga','young africans','simba sc','simba','azam fc','coastal union','polisi tanzania','jkt tanzania','namungo','mashujaa','geita gold','tabora united','mbeya city','mechi','mchezo','matokeo','score','kikosi','ratiba','magoli','mshindi','football','soccer','match','premier league','champions league','caf','tff','ligi kuu'];
const STANDINGS_TERMS = ['msimamo','standings','table','league table','pointi','points','nafasi','position','pld','played','goal difference','tofauti ya magoli'];
const GOVERNMENT_TERMS = ['waziri','wizara','waziri mkuu','naibu waziri','rais wa','makamu wa rais','serikali ya sasa','waziri mwenye dhamana','baraza la mawaziri','mkuu wa mkoa','mkuu wa wilaya','meya wa','kiongozi wa sasa','katibu mkuu','current minister','prime minister','president of tanzania','current government','current cabinet','who is the minister','who is the prime minister'];
function isSportsQuery(query: string): boolean { const lower=query.toLowerCase(); return SPORTS_TERMS.some(t=>lower.includes(t)); }
function isStandingsQuery(query: string): boolean { const lower=query.toLowerCase(); return STANDINGS_TERMS.some(t=>lower.includes(t)) && (lower.includes('ligi')||lower.includes('league')||lower.includes('tanzania')||lower.includes('yanga')||lower.includes('simba')||lower.includes('azam')); }
function isGovernmentQuery(query: string): boolean { const lower=String(query||'').toLowerCase(); return GOVERNMENT_TERMS.some(t=>lower.includes(t)); }
function getTanzaniaDate(offsetDays=0): string { const now=new Date(); const date=new Date(now.getTime()+offsetDays*86400000); return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function containsRelativeDay(query:string,day:'jana'|'leo'|'kesho'):boolean{return query.toLowerCase().includes(day);}

async function runTavilySearch(query:string,topic:'general'|'news',includeDomains?:string[]):Promise<TavilySearchResult[]> {
 const apiKey=process.env.TAVILY_API_KEY?.trim(); if(!apiKey) throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');
 const response=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false,...(includeDomains?.length?{include_domains:includeDomains}:{})})});
 if(!response.ok){const body=await response.text().catch(()=> '');throw new Error(`Tavily Search HTTP ${response.status}${body?`: ${body.slice(0,500)}`:''}`);}
 const data=await response.json() as {results?:TavilySearchResult[]}; return Array.isArray(data.results)?data.results:[];
}

/** Direct authoritative current-cabinet fetch. Generic web results are NEVER mixed into this path. */
async function getOfficialCabinetSnapshot(): Promise<string> {
 const response = await fetch('https://www.ikulu.go.tz/index.php/cabinet', { headers: { Accept: 'text/html', 'User-Agent': 'MKUU-AI/1.0 current-government-verifier' }, cache: 'no-store' } as any);
 if (!response.ok) throw new Error(`Ikulu Cabinet HTTP ${response.status}`);
 const html = await response.text();
 const text = html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 if (!/Baraza la Mawaziri/i.test(text)) throw new Error('Ikulu Cabinet page did not contain Cabinet data.');
 const wanted: Array<[string,string]> = [
   ['Waziri wa Habari, Utamaduni, Sanaa na Michezo','Waziri wa Habari, Utamaduni, Sanaa na Michezo'],
   ['Waziri wa Mawasiliano na Teknolojia ya Habari','Waziri wa Mawasiliano na Teknolojia ya Habari'],
   ['Waziri Mkuu wa Jamhuri ya Muungano wa Tanzania','Waziri Mkuu wa Jamhuri ya Muungano wa Tanzania'],
 ];
 const extracted:string[]=[];
 for(const [label,title] of wanted){
   const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const match=text.match(new RegExp('MHE\\.\\s+([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý .\\'-]{3,120}?)\\s+'+escaped,'i'));
   if(match?.[1]) extracted.push(`${label}: MHE. ${match[1].trim()}`);
 }
 if(!extracted.length) throw new Error('Ikulu Cabinet page did not expose a recognized current office holder.');
 return `[LIVE OFFICIAL IKULU CABINET SNAPSHOT — FETCHED ${new Date().toISOString()}]\nSource: https://www.ikulu.go.tz/index.php/cabinet\n${extracted.join('\n')}\nIMPORTANT: This snapshot is authoritative current-government evidence. Ignore all older cabinet information.`;
}

export async function searchWithTavily(query:string):Promise<string>{
 lastTavilySources=[]; const sports=isSportsQuery(query); const standings=isStandingsQuery(query); const government=isGovernmentQuery(query);
 if(government){
   // HARD STOP against stale answers: current-government questions are allowed
   // to use ONLY the live official Ikulu Cabinet page. No Tavily generic results,
   // old articles, cache, conversation memory or Gemini memory can override it.
   let snapshot:string;
   try { snapshot=await getOfficialCabinetSnapshot(); }
   catch (err) { console.error('[MKUU-BACKEND] [OFFICIAL_GOVERNMENT_SOURCE_FAILED]', err); throw new Error('AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE: Ikulu current Cabinet could not be verified; refusing to answer from stale information.'); }
   lastTavilySources=[{title:'Ikulu — Baraza la Mawaziri',url:'https://www.ikulu.go.tz/index.php/cabinet'}];
   return snapshot+'\n\n[GOVERNMENT HARD RULES]\n- Use ONLY the live official Ikulu snapshot above for current cabinet/minister questions.\n- Never use model memory, old news, cached snippets, previous conversation claims, or generic search results to override it.\n- If the requested office is not present in the verified snapshot, say it could not be verified instead of guessing.\n- If the official page shows a changed or combined ministry, use exactly the current structure shown there.\n- Never merge an old cabinet with the current cabinet.';
 }
 const searches:Promise<TavilySearchResult[]>[]=[runTavilySearch(query,'general')];
 if(sports){
   searches.push(runTavilySearch(`${query} final score FT full time result completed match`,'news'));
   if(containsRelativeDay(query,'jana'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(-1)} FT final score result completed`,'news'));
   if(containsRelativeDay(query,'leo'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(0)} FT final score result completed`,'news'));
   if(containsRelativeDay(query,'kesho'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(1)} fixture schedule`,'news'));
 }
 if(standings){const today=getTanzaniaDate(0);searches.push(runTavilySearch(`Tanzania NBC Premier League 2026/2027 current standings table ${today} P W D L GF GA GD points latest updated`,'general'));searches.push(runTavilySearch(`Tanzania NBC Premier League 2026/2027 latest completed results FT final scores updated ${today} Azam TRA Yanga Coastal Union`,'news'));}
 const settled=await Promise.allSettled(searches); const merged=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]); const unique=new Map<string,TavilySearchResult>();
 for(const result of merged){const url=String(result?.url||'').trim();if(!url)continue;const previous=unique.get(url);if(!previous||Number(result.score||0)>Number(previous.score||0))unique.set(url,result);}
 const results=Array.from(unique.values()).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,20);
 if(!results.length)throw new Error('Tavily Search returned no results.');
 lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);
 return results.map((r,i)=>`[CHANZO ${i+1}]\nKichwa: ${String(r?.title||'').trim()}\nURL: ${String(r?.url||'').trim()}\nTaarifa: ${String(r?.content||'').trim()}`).join('\n\n');
}
