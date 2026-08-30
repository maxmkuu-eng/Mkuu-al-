export interface ExaCitation { title?: string; url: string; publishedDate?: string; author?: string; }
export interface ExaSearchResult { answer: string; citations: Array<{ title: string; url: string }>; }

function apiKey(): string {
  const env = process.env as Record<string,string|undefined>;
  const key = Object.entries(env).find(([k,v]) => k.trim().toUpperCase()==='EXA_API_KEY' && v?.trim())?.[1];
  if (!key) throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  return key.trim().replace(/^['"`]+|['"`]+$/g,'');
}
function tzDate(offsetDays=0): string {
  const d=new Date(Date.now()+offsetDays*86400000);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function tzNow(): string {
  return new Intl.DateTimeFormat('sw-TZ',{timeZone:'Africa/Dar_es_Salaam',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())+' (Africa/Dar_es_Salaam, UTC+3)';
}
function textOf(x:any): string { return `${x?.title||''} ${x?.highlights?.join?.(' ')||''} ${x?.summary||''} ${x?.text||''}`.replace(/\s+/g,' ').trim(); }
function sports(q:string){return /\b(simba|yanga|young africans|azam|coastal union|singida|geita gold|jkt tanzania|namungo|mashujaa|dodoma jiji|kagera sugar|tabora united|pamba|tra united|mbeya city|fountain gate|polisi tanzania|mechi|mchezo|matokeo|score|full time|ft|ushindi|ameshinda|amecheza|ligi|premier league)\b/i.test(q);}
function finalQ(q:string){return /\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final|zimeisha|imeisha)\b/i.test(q)&&!/\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|leo|today)\b/i.test(q);}
function yesterdayQ(q:string){return /\b(jana|yesterday)\b/i.test(q);}
function opponentQ(q:string){return /\b(amecheza na nani|amecheza dhidi ya nani|alicheza na nani|ilicheza na nani|anacheza na nani|opponent|who did .* play)\b/i.test(q);}
function socialQ(q:string){return /\b(instagram|facebook|tiktok|youtube|twitter|x\.com|social media|post ya|tweet|reel|story|official post|profile)\b/i.test(q);}
function newsQ(q:string){return /\b(habari|news|taarifa|msanii|celebrity|mwanamuziki|amejifungua|amefariki|ameoa|ameolewa|uvumi|rumour|rumor|imethibitishwa|confirmed)\b/i.test(q);}
function resultScore(x:any){const t=textOf(x);let s=0;if(/\b(full time|ft|final score|match result|result|matokeo|won|defeated|beat|victory)\b/i.test(t))s+=8;if(/\b(preview|pre-match|scheduled|will play|today|leo|kick[- ]?off)\b/i.test(t))s-=8;return s;}

const TEAMS=['Singida Black Stars','Polisi Tanzania','JKT Tanzania','TRA United','Dodoma Jiji','Tabora United','Namungo','Young Africans','Yanga','Pamba Jiji','Mbeya City','Fountain Gate','Geita Gold','Azam','Simba','Coastal Union','Mashujaa','Kagera Sugar'].sort((a,b)=>b.length-a.length);
function extractAllLeagueResults(items:any[]): string[] {
  const aliases=TEAMS.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re=new RegExp(`(${aliases})(?:\\s+(?:FC|SC))?\\s+(?:FT\\s*)?(\\d{1,2})\\s*[-–:]\\s*(\\d{1,2})\\s+(${aliases})(?:\\s+(?:FC|SC))?`,'gi');
  const out=new Map<string,string>();
  for(const item of items){const t=textOf(item);let m:RegExpExecArray|null;while((m=re.exec(t))){const h=m[1].trim(),a=m[4].trim();out.set(`${h.toLowerCase()}|${a.toLowerCase()}`,`${h} ${m[2]}-${m[3]} ${a}`);}}
  return [...out.values()];
}
async function exaSearch(query:string):Promise<any[]> {
  const key=apiKey();
  const r=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({query,type:'fast',numResults:20,contents:{highlights:true,text:true}}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`EXA_SEARCH_FAILED: HTTP ${r.status}`);
  const d=await r.json() as any;
  return Array.isArray(d?.results)?d.results:[];
}
export async function searchWithExa(query:string):Promise<ExaSearchResult>{
  const requestedDate=yesterdayQ(query)?tzDate(-1):/\bjuzi\b/i.test(query)?tzDate(-2):tzDate(0);
  const allLeague=sports(query)&&finalQ(query)&&yesterdayQ(query)&&/\b(tanzania|ligi|premier league|ligi kuu|bara|mechi)\b/i.test(query);
  const queries=allLeague?[
    `Tanzania Ligi Kuu Bara all final results ${requestedDate}. Every completed match and final score. Exclude fixtures and previews.`,
    `Tanzania Premier League ${requestedDate} results final score TRA United Dodoma Jiji Singida Black Stars Polisi Tanzania JKT Tanzania Namungo`,
    `${query} Tanzania ${requestedDate} all completed matches final scores`
  ]:[query+`\nCURRENT TANZANIA TIME: ${tzNow()}\nREQUESTED EVENT DATE: ${requestedDate}`];
  const raw=(await Promise.all(queries.map(exaSearch))).flat();
  const ranked=sports(query)&&finalQ(query)?raw.sort((a,b)=>resultScore(b)-resultScore(a)):raw;
  const results=ranked.slice(0,allLeague?40:12);
  const citations=results.filter(x=>x?.url).map(x=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,10);
  if(allLeague){
    const matches=extractAllLeagueResults(results);
    if(matches.length)return {answer:`Matokeo ya Ligi Kuu Tanzania ya jana (${requestedDate}):\n${matches.slice(0,12).map(x=>`- ${x}`).join('\n')}`,citations};
  }
  if(sports(query)&&opponentQ(query)){
    const team=(query.match(/\b(simba|yanga|young africans|azam|coastal union)\b/i)?.[1]||'');
    const teamRe=team?new RegExp(`${team.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*(?:sc|fc)?\\s*(?:vs\\.?|v\\.?|versus|[-–—])\\s*([^|\\-–—,]+)`,'i'):null;
    if(teamRe)for(const item of results){const m=textOf(item).match(teamRe);if(m)return {answer:`Jana ${team} alicheza na ${m[1].trim()}.`,citations};}
  }
  const evidence=results.slice(0,newsQ(query)?5:socialQ(query)?3:3).map(textOf).filter(Boolean);
  if(!evidence.length)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return {answer:evidence.join('\n\n'),citations};
}
