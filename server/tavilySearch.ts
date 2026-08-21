export interface TavilySearchResult { title: string; url: string; content: string; score?: number; }
export interface TavilySource { title: string; url: string; }
let lastTavilySources: TavilySource[] = [];
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }
export function clearLastTavilySources(): void { lastTavilySources = []; }

const SPORTS_TERMS=['yanga','young africans','simba sc','simba','azam fc','coastal union','polisi tanzania','jkt tanzania','namungo','mashujaa','geita gold','tabora united','mbeya city','mechi','mchezo','matokeo','score','kikosi','ratiba','magoli','mshindi','football','soccer','match','premier league','champions league','caf','tff','ligi kuu'];
const STANDINGS_TERMS=['msimamo','standings','table','league table','pointi','points','nafasi','position','pld','played','goal difference','tofauti ya magoli'];
const GOVERNMENT_TERMS=['waziri','wizara','waziri mkuu','naibu waziri','rais wa','makamu wa rais','serikali ya sasa','waziri mwenye dhamana','baraza la mawaziri','mkuu wa mkoa','mkuu wa wilaya','meya wa','kiongozi wa sasa','katibu mkuu','current minister','prime minister','president of tanzania','current government','current cabinet','who is the minister','who is the prime minister'];
const SOCIAL_DOMAINS=['instagram.com','facebook.com','tiktok.com','youtube.com','x.com','twitter.com'];
const SOCIAL_TERMS=['instagram','facebook','tiktok','youtube','twitter','x.com','social media','post','posted','tweet','video','reel','story','official statement'];
function isSportsQuery(q:string){const l=q.toLowerCase();return SPORTS_TERMS.some(t=>l.includes(t));}
function isStandingsQuery(q:string){const l=q.toLowerCase();return STANDINGS_TERMS.some(t=>l.includes(t))&&(l.includes('ligi')||l.includes('league')||l.includes('tanzania')||l.includes('yanga')||l.includes('simba')||l.includes('azam'));}
function isGovernmentQuery(q:string){const l=String(q||'').toLowerCase();return GOVERNMENT_TERMS.some(t=>l.includes(t));}
function isSocialQuery(q:string){const l=String(q||'').toLowerCase();return SOCIAL_TERMS.some(t=>l.includes(t));}
function getTanzaniaDate(offsetDays=0){const now=new Date();const d=new Date(now.getTime()+offsetDays*86400000);return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function containsRelativeDay(q:string,d:'jana'|'leo'|'kesho'){return q.toLowerCase().includes(d);}

async function runTavilySearch(query:string,topic:'general'|'news',includeDomains?:string[]):Promise<TavilySearchResult[]>{
 const apiKey=process.env.TAVILY_API_KEY?.trim();if(!apiKey)throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');
 const body:any={api_key:apiKey,query,search_depth:'advanced',topic,max_results:8,include_answer:false,include_raw_content:false};
 if(includeDomains?.length)body.include_domains=includeDomains;
 const response=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok){const text=await response.text().catch(()=> '');throw new Error(`Tavily Search HTTP ${response.status}${text?`: ${text.slice(0,500)}`:''}`);}
 const data=await response.json() as {results?:TavilySearchResult[]};return Array.isArray(data.results)?data.results:[];
}

async function getOfficialCabinetSnapshot():Promise<string>{
 const response=await fetch('https://www.ikulu.go.tz/index.php/cabinet',{headers:{Accept:'text/html','User-Agent':'MKUU-AI/1.0 current-government-verifier'},cache:'no-store'} as any);
 if(!response.ok)throw new Error(`Ikulu Cabinet HTTP ${response.status}`);
 const html=await response.text();
 const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 if(!/Baraza la Mawaziri/i.test(text))throw new Error('Ikulu Cabinet page did not contain Cabinet data.');
 const wanted=['Waziri wa Habari, Utamaduni, Sanaa na Michezo','Waziri wa Mawasiliano na Teknolojia ya Habari','Waziri Mkuu wa Jamhuri ya Muungano wa Tanzania'];
 const extracted:string[]=[];
 for(const title of wanted){const idx=text.toLowerCase().indexOf(title.toLowerCase());if(idx<0)continue;const before=text.slice(Math.max(0,idx-500),idx);const names=before.match(/MHE\.\s+[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý .'-]{3,120}/gi);const name=names?.at(-1)?.trim();if(name)extracted.push(`${title}: ${name}`);}
 if(!extracted.length)throw new Error('Ikulu Cabinet page did not expose a recognized current office holder.');
 return `[LIVE OFFICIAL IKULU CABINET SNAPSHOT — FETCHED ${new Date().toISOString()}]\nSource: https://www.ikulu.go.tz/index.php/cabinet\n${extracted.join('\n')}\nIMPORTANT: This is the primary authoritative current-government evidence. Older information must not override it.`;
}

function formatResults(results:TavilySearchResult[],offset=1){return results.map((r,i)=>`[CHANZO ${i+offset}]\nKichwa: ${String(r?.title||'').trim()}\nURL: ${String(r?.url||'').trim()}\nTaarifa: ${String(r?.content||'').trim()}`).join('\n\n');}

export async function searchWithTavily(query:string):Promise<string>{
 lastTavilySources=[];
 const sports=isSportsQuery(query),standings=isStandingsQuery(query),government=isGovernmentQuery(query),social=isSocialQuery(query);
 if(government){
  let snapshot:string;try{snapshot=await getOfficialCabinetSnapshot();}catch(err){console.error('[MKUU-BACKEND] [OFFICIAL_GOVERNMENT_SOURCE_FAILED]',err);throw new Error('AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE: Ikulu current Cabinet could not be verified; refusing to answer from stale information.');}
  const searches=await Promise.allSettled([runTavilySearch(`${query} current Tanzania government official`,'general',['tanzania.go.tz']),runTavilySearch(`${query} current cabinet Tanzania`,'general',['ikulu.go.tz']),runTavilySearch(`${query} current Tanzania official`,'general',['parliament.go.tz']),runTavilySearch(`${query} current Tanzania ministry official`,'general',['go.tz']),runTavilySearch(`${query} Tanzania current cabinet`,'general',['cia.gov'])]);
  const secondary=searches.flatMap(r=>r.status==='fulfilled'?r.value:[]);const unique=new Map<string,TavilySearchResult>();for(const r of secondary){const u=String(r?.url||'').trim();if(u&&!unique.has(u))unique.set(u,r);}
  const results=Array.from(unique.values()).slice(0,15);lastTavilySources=[{title:'Ikulu — Baraza la Mawaziri (primary)',url:'https://www.ikulu.go.tz/index.php/cabinet'},...results.map(r=>({title:String(r?.title||''),url:String(r?.url||'')})).filter(s=>s.url).slice(0,8)];
  return snapshot+'\n\n'+(results.length?formatResults(results):'[CHANZO ZAIDI] Hakuna chanzo cha pili kilichopatikana.')+'\n\n[GOVERNMENT SOURCE RULES]\n- Ikulu live snapshot is primary.\n- Prefer newer authoritative evidence.\n- Never revive an older office holder from an old article.\n- If sources conflict and the newer position cannot be established, say so instead of guessing.';
 }
 const searches:Promise<TavilySearchResult[]>[]=[];
 // WORLDWIDE WEB: current/factual questions receive broad web + news evidence.
 searches.push(runTavilySearch(`${query} latest current update 2026`,'general'));
 searches.push(runTavilySearch(`${query} latest current news today 2026`,'news'));
 // SOCIAL MEDIA: explicitly search public social platforms for public-figure/entertainment claims and social-media questions.
 if(social || /zuchu|diamond|wasanii|msanii|celebrity|artist|singer|actor|actress|baby|pregnan|amejifungua|ameoa|ameolewa|relationship|marriage|breakup|ujauzito|mtoto|kujifungua/i.test(query)){
   searches.push(runTavilySearch(`${query} latest official social media post statement 2026`,'general',SOCIAL_DOMAINS));
   searches.push(runTavilySearch(`${query} latest Instagram TikTok YouTube Facebook X post 2026`,'news',SOCIAL_DOMAINS));
 }
 if(sports){
  searches.push(runTavilySearch(`${query} final score FT full time result completed match`,'news'));
  if(containsRelativeDay(query,'jana'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(-1)} final score completed`,'news'));
  if(containsRelativeDay(query,'leo'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(0)} final score completed`,'news'));
  if(containsRelativeDay(query,'kesho'))searches.push(runTavilySearch(`${query} Tanzania ${getTanzaniaDate(1)} fixture kickoff schedule`,'news'));
 }
 if(standings){const today=getTanzaniaDate(0);searches.push(runTavilySearch(`Tanzania NBC Premier League 2026/2027 current standings ${today} points latest`,'general'));}
 const settled=await Promise.allSettled(searches);const merged=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]);const unique=new Map<string,TavilySearchResult>();
 for(const r of merged){const u=String(r?.url||'').trim();if(!u)continue;const old=unique.get(u);if(!old||Number(r.score||0)>Number(old.score||0))unique.set(u,r);}
 const results=Array.from(unique.values()).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,30);
 if(!results.length)throw new Error('Tavily Search returned no results.');
 lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,10);
 return formatResults(results);
}
