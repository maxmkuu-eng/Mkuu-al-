import { GoogleGenAI } from '@google/genai';

export interface ExaCitation { title?: string; url: string; publishedDate?: string; author?: string; }
export interface ExaSearchResult { answer: string; citations: Array<{ title: string; url: string }>; }

function resolveExaApiKey(): string {
  const env = process.env as Record<string, string | undefined>;
  const normalized = Object.entries(env).find(([name, value]) => name.trim().replace(/^['"`]+|['"`]+$/g, '').toUpperCase() === 'EXA_API_KEY' && typeof value === 'string' && value.trim())?.[1];
  if (!normalized) throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  return normalized.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
}

function tanzaniaDateContext() {
  const now = new Date(); const timeZone = 'Africa/Dar_es_Salaam';
  const df = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
  const ff = new Intl.DateTimeFormat('sw-TZ', { timeZone, weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const fmt=(d:Date)=>df.format(d);
  return { today:fmt(now), yesterday:fmt(new Date(now.getTime()-86400000)), twoDaysAgo:fmt(new Date(now.getTime()-172800000)), formatted:`${ff.format(now)} (Africa/Dar_es_Salaam, UTC+3)` };
}
function isFreshOrRelativeQuery(q:string){return /\b(jana|juzi|leo|today|yesterday|latest|newest|current|sasa|wa sasa|hivi punde|habari mpya|habari za leo|wiki hii|this week|matokeo ya|mechi ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda|amejifungua|amefariki|ameoa|ameolewa|amepata mtoto|kujifungua|tukio|taarifa rasmi|imethibitishwa|confirmed|uvumi|rumour|rumor|habari za)\b/i.test(q);}
function isNewsQuery(q:string){return /\b(habari|news|taarifa|msanii|celebrity|zuchu|diamond|harmonize|alikiba|rayvanny|mwanamuziki|amejifungua|kujifungua|amefariki|ameoa|ameolewa|amepata mtoto|uvumi|rumour|rumor|imebainika|imethibitishwa|confirmed)\b/i.test(q);}
function isSocialQuery(q:string){return /\b(instagram|facebook|tiktok|youtube|twitter|x\.com|social media|post ya|tweet|reel|story|official post|profile)\b/i.test(q);}
function isSportsQuery(q:string){return /\b(simba|yanga|young africans|azam|coastal union|singida|geita gold|jkt tanzania|namungo|mashujaa|dodoma jiji|kagera sugar|tabora united|mechi|mchezo|matokeo|score|full time|ft|win|won|lost|draw|ushindi|amecheza|ilicheza|amefungwa|imeshinda|kashinda|mshindi|mpinzani|opponent|fixture|standings|ligi|premier league|champions league|caf|anacheza|tutacheza|kuikabili|itaikabili)\b/i.test(q);}
function isFinalResultQuery(q:string){return /\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final)\b/i.test(q)&&!/\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|leo|today)\b/i.test(q);}
function isOpponentQuestion(q:string){return /\b(amecheza na nani|amecheza dhidi ya nani|alicheza na nani|ilicheza na nani|anacheza na nani|anacheza dhidi ya nani|atachukua nani|nani (?:wanacheza|anacheza) naye|who does .* play|who did .* play|who is .* playing|opponent)\b/i.test(q);}
function resultStrength(item:any){const t=`${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`.toLowerCase();let s=0;if(/\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|beat|victory|1\s*[-–]\s*0|0\s*[-–]\s*1|2\s*[-–]\s*1|1\s*[-–]\s*2)\b/i.test(t))s+=8;if(/\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\b/i.test(t))s-=8;if(/\b(2026)\b/i.test(t))s+=2;return s;}
function evidenceText(item:any){return `${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`.replace(/\s+/g,' ').trim();}
function newsEvidenceStrength(item:any){const t=evidenceText(item);let s=0;if(/\b(confirmed|official|confirmed by family|family confirmed|rasmi|imethibitishwa|statement|announced|amejifungua|gave birth|welcomed|born|baby girl|baby boy|mtoto wa kike|mtoto wa kiume)\b/i.test(t))s+=8;if(/\b(2026|august|agosti)\b/i.test(t))s+=3;if(item?.publishedDate)s+=2;if(/\b(rumou?r|uvumi|unconfirmed|alleged|allegedly|claim|claims)\b/i.test(t))s-=7;return s;}
function isNewsFactQuestion(q:string){return /\b(amejifungua|amepata mtoto|mtoto gani|mtoto wa kike|mtoto wa kiume|amefariki|ameolewa|ameoa|ujauzito|mimba|imejifungua|imefariki|nani|lini|wapi|gani|je)\b/i.test(q)&&isNewsQuery(q);}
function extractNewsFactAnswer(query:string,results:any[]){const ranked=[...results].sort((a,b)=>newsEvidenceStrength(b)-newsEvidenceStrength(a));const strong=ranked.filter(x=>newsEvidenceStrength(x)>=7);if(!strong.length)return null;return strong.slice(0,4).map(evidenceText).filter(Boolean).join('\n\n');}

function extractOpponentAnswer(query:string,results:any[]){
  const q=String(query); const teamMatch=q.match(/\b(simba(?: sc)?|yanga(?: sc)?|young africans|azam(?: fc)?|coastal union(?: fc)?)\b/i); const team=teamMatch?.[1]; if(!team)return null;
  const aliases:Record<string,string>={yanga:'young africans','yanga sc':'young africans','young africans':'young africans',simba:'simba','simba sc':'simba',azam:'azam','azam fc':'azam','coastal union':'coastal union','coastal union fc':'coastal union'}; const canonical=aliases[team.toLowerCase()]||team; const tr=canonical.replace(/\s+/g,'\\s+');
  const a=new RegExp(tr+'\\s*(?:sc|fc)?\\s*(?:vs\\.?|v\\.?|versus|[-–—])\\s*([^|\\-–—,]+)','i'); const b=new RegExp('([^|\\-–—,]+)\\s*(?:vs\\.?|v\\.?|versus|[-–—])\\s*'+tr+'\\s*(?:sc|fc)?','i'); const future=/\b(kesho|tomorrow|will play|will face|anacheza|tutacheza|itaikabili|leo|today)\b/i.test(q);
  for(const item of results){const h=evidenceText(item);const m=h.match(a)||h.match(b);let opp=(m?.[1]||'').replace(/\s*(live score|live result|result|score|today|leo|tonight|scheduled|kick[- ]?off).*$/i,'').trim();if(!opp){const title=String(item?.title||'');const direct=title.match(/(?:Young Africans|Yanga(?: SC)?)\s+(?:vs\.?|v\.?|versus)\s+(.+)/i);if(direct)opp=direct[1].replace(/\s*(?:[-|:].*)$/,'').trim();}if(opp&&opp.length<80){const day=/\b(jana|yesterday)\b/i.test(q)?'Jana':/\b(juzi)\b/i.test(q)?'Juzi':/\b(kesho|tomorrow)\b/i.test(q)?'Kesho':'Leo';return day+' '+team.replace(/\b\w/g,c=>c.toUpperCase())+' '+(future?'anacheza':'alicheza')+' na '+opp+'.';}}return null;
}

export async function searchWithExa(query:string):Promise<ExaSearchResult>{
  const apiKey=resolveExaApiKey(), dates=tanzaniaDateContext(), fresh=isFreshOrRelativeQuery(query), social=isSocialQuery(query), sports=isSportsQuery(query), news=isNewsQuery(query), finalResult=isFinalResultQuery(query), opponent=isOpponentQuestion(query), newsFact=isNewsFactQuestion(query);
  const requestedDate=/\b(jana|yesterday)\b/i.test(query)?dates.yesterday:/\b(juzi)\b/i.test(query)?dates.twoDaysAgo:dates.today;
  const q=fresh?`${query}\nTANZANIA TIME: ${dates.formatted}. Current date=${dates.today}. Requested event date=${requestedDate}. ${sports?(finalResult?'FINAL SPORTS RESULT: find the completed match on the requested date, final/full-time score and opponent. Ignore previews and scheduled fixtures.':'SPORTS FIXTURE: find the match scheduled for the requested date, opponent, venue and kick-off. For questions asking who a team plays today/leo, prioritize an actual fixture scheduled on the requested date; do not answer from previous results or generic news.'):news?'CURRENT NEWS/EVENT: find the concrete fact asked by the user from credible reporting. Do not say “hakuna taarifa” when credible evidence confirms the event. Prefer explicit confirmation and named details over generic summaries.':'Use the requested event date and newest credible evidence.'}`:`${query}\nCURRENT TANZANIA TIME: ${dates.formatted}`;
  const body:any={query:sports&&finalResult?`${q}\nFINAL RESULT ONLY: ${requestedDate}`:q,type:fresh?'fast':'auto',numResults:sports?12:(fresh?12:8),contents:{highlights:true,text:true}};
  if(fresh){if(sports)body.startPublishedDate=finalResult?new Date(`${requestedDate}T00:00:00+03:00`).toISOString():new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).toISOString();else if(news)body.startPublishedDate=new Date(Date.now()-60*86400000).toISOString();else body.startPublishedDate=new Date(Date.now()-7*86400000).toISOString();body.endPublishedDate=new Date(Date.now()+86400000).toISOString();body.maxAgeHours=0;}
  const response=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const eb=await response.text().catch(()=> '');throw new Error('EXA_SEARCH_FAILED: HTTP '+response.status+(eb?' - '+eb.slice(0,500):''));}
  const data=await response.json() as any;const raw=Array.isArray(data?.results)?data.results:[];const ranked=sports&&finalResult?[...raw].sort((a:any,b:any)=>resultStrength(b)-resultStrength(a)):news?[...raw].sort((a:any,b:any)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):raw;const results=ranked.slice(0,sports?10:(news?10:8));const citations=results.filter((x:any)=>x?.url).map((x:any)=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()}));
  let answer='';if(sports&&opponent)answer=extractOpponentAnswer(query,results)||'';else if(sports&&finalResult)answer=results.filter((x:any)=>resultStrength(x)>=6).slice(0,3).map((x:any)=>evidenceText(x).slice(0,1200)).filter(Boolean).join('\n\n');else if(newsFact)answer=extractNewsFactAnswer(query,results)||'';else answer=String(data?.output?.content||'').trim()||results.slice(0,social?3:(news?5:2)).map((x:any)=>evidenceText(x).slice(0,1000)).filter(Boolean).join('\n\n').trim();
  if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');return {answer,citations};
}
