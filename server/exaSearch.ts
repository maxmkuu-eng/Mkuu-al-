export interface ExaCitation {
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string;
}

export interface ExaSearchResult {
  answer: string;
  citations: Array<{ title: string; url: string }>;
}

function resolveExaApiKey(): string {
  const env = process.env as Record<string, string | undefined>;
  const normalized = Object.entries(env).find(([name, value]) => {
    const normalizedName = name.trim().replace(/^['"`]+|['"`]+$/g, '').toUpperCase();
    return normalizedName === 'EXA_API_KEY' && typeof value === 'string' && value.trim();
  })?.[1];
  if (!normalized) throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  return normalized.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
}

function tanzaniaDateContext(): { today: string; yesterday: string; twoDaysAgo: string; formatted: string } {
  const now = new Date();
  const timeZone = 'Africa/Dar_es_Salaam';
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fullFormatter = new Intl.DateTimeFormat('sw-TZ', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (date: Date) => dateFormatter.format(date);
  return { today: formatDate(now), yesterday: formatDate(new Date(now.getTime() - 86400000)), twoDaysAgo: formatDate(new Date(now.getTime() - 172800000)), formatted: `${fullFormatter.format(now)} (Africa/Dar_es_Salaam, UTC+3)` };
}

function isFreshOrRelativeQuery(query: string): boolean { return /\b(jana|juzi|leo|today|yesterday|latest|newest|current|sasa|wa sasa|hivi punde|habari mpya|habari za leo|wiki hii|this week|matokeo ya|mechi ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda)\b/i.test(query); }
function isSocialQuery(query: string): boolean { return /\b(instagram|facebook|tiktok|youtube|twitter|x\.com|social media|post ya|tweet|reel|story|official post|profile)\b/i.test(query); }
function isSportsQuery(query: string): boolean { return /\b(simba|yanga|young africans|azam|coastal union|singida|geita gold|jkt tanzania|namungo|mashujaa|dodoma jiji|kagera sugar|tabora united|mechi|mchezo|matokeo|score|full time|ft|win|won|lost|draw|ushindi|amecheza|ilicheza|amefungwa|imeshinda|kashinda|mshindi|mpinzani|opponent|fixture|standings|ligi|premier league|champions league|caf|anacheza|tutacheza|kuikabili|itaikabili)\b/i.test(query); }
function isFinalResultQuery(query: string): boolean { return /\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final)\b/i.test(query) && !/\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho)\b/i.test(query); }
function isOpponentQuestion(query: string): boolean { return /\b(amecheza na nani|amecheza dhidi ya nani|alicheza na nani|ilicheza na nani|anacheza na nani|anacheza dhidi ya nani|atachukua nani|who does .* play|who did .* play|opponent)\b/i.test(query); }
function resultStrength(item: any): number { const text=`${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`.toLowerCase(); let score=0; if(/\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|beat|victory|1\s*[-–]\s*0|0\s*[-–]\s*1|2\s*[-–]\s*1|1\s*[-–]\s*2)\b/i.test(text))score+=8; if(/\b(pre-match|preview|scheduled|kick[- ]?off|itaikabili|inatarajiwa)\b/i.test(text))score-=8; if(/\b(2026|august|september|january|february|march|april|may|june|july|october|november|december)\b/i.test(text))score+=2; return score; }
function extractOpponentAnswer(query: string, results: any[], requestedDate: string): string | null { const team=String(query).match(/\b(simba(?: sc)?|yanga(?: sc)?|young africans|azam(?: fc)?|coastal union(?: fc)?)\b/i)?.[1]; if(!team)return null; const teamRegex=team.replace(/\s+/g,'\\s+').replace(/(?:\\s+sc|\\s+fc)$/i,'(?:\\s+(?:SC|FC))?'); const vsPattern=new RegExp(`${teamRegex}\\s*(?:vs\\.?|v\\.?|versus)\\s*([^|\\-–—,]+)`,'i'); const vsReversePattern=new RegExp(`([^|\\-–—,]+)\\s*(?:vs\\.?|v\\.?|versus)\\s*${teamRegex}`,'i'); const future=/\b(kesho|tomorrow|will play|will face|anacheza|tutacheza|itaikabili)\b/i.test(query); for(const item of results){const haystack=`${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`;const direct=haystack.match(vsPattern);const reverse=haystack.match(vsReversePattern);const opponent=(direct?.[1]||reverse?.[1]||'').replace(/\s*(live score|live result|result|score).*$/i,'').trim();if(opponent){const dayWord=/\b(jana|yesterday)\b/i.test(query)?'Jana':/\b(juzi)\b/i.test(query)?'Juzi':/\b(kesho|tomorrow)\b/i.test(query)?'Kesho':'Leo';return `${dayWord} ${team.replace(/\b\w/g,c=>c.toUpperCase())} ${future?'anacheza':'alicheza'} na ${opponent}.`;}}return null; }

export async function searchWithExa(query: string): Promise<ExaSearchResult> {
  const apiKey=resolveExaApiKey(); const dates=tanzaniaDateContext(); const fresh=isFreshOrRelativeQuery(query); const social=isSocialQuery(query); const sports=isSportsQuery(query); const finalResult=isFinalResultQuery(query); const opponentQuestion=isOpponentQuestion(query); const requestedDate=/\b(jana|yesterday)\b/i.test(query)?dates.yesterday:/\b(juzi)\b/i.test(query)?dates.twoDaysAgo:dates.today;
  const queryWithAbsoluteDates=fresh?`${query}\nMKUU LIVE SEARCH CONTRACT: Current Tanzania date/time is ${dates.formatted}. today=${dates.today}; yesterday=${dates.yesterday}; requested event date=${requestedDate}. Resolve the user's question against the requested date. For current office holders, use the latest official/current evidence even if the page was published earlier. For sports, distinguish completed results from scheduled fixtures and verify the requested date. Ignore stale pages that contradict newer evidence.`:`${query}\nCURRENT TANZANIA LOCAL TIME: ${dates.formatted}`;
  const body:Record<string,unknown>={query:sports&&finalResult?`${queryWithAbsoluteDates}\nFINAL RESULT ONLY: completed match on ${requestedDate}; final score, opponent and result.`:sports?`${queryWithAbsoluteDates}\nFIXTURE ONLY: match scheduled on ${requestedDate}; opponent, venue and kick-off time. Do not require a final score.`:queryWithAbsoluteDates,type:'fast',numResults:sports?20:(fresh?15:10),contents:{highlights:true,text:true}};
  const response=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const errorBody=await response.text().catch(()=> '');throw new Error(`EXA_SEARCH_FAILED: HTTP ${response.status}${errorBody?` - ${errorBody.slice(0,500)}`:''}`);}
  const data=await response.json() as any; const rawResults=Array.isArray(data?.results)?data.results:[]; const rankedResults=sports&&finalResult?[...rawResults].sort((a:any,b:any)=>resultStrength(b)-resultStrength(a)):rawResults; const results=rankedResults.slice(0,sports?12:(fresh?10:8)); const citations=results.filter((item:any)=>item?.url).map((item:any)=>({title:String(item.title||item.url).trim(),url:String(item.url).trim()}));
  let answer='';
  if(sports&&opponentQuestion)answer=extractOpponentAnswer(query,results,requestedDate)||'';
  else if(sports&&finalResult){const strong=results.filter((item:any)=>resultStrength(item)>=6).slice(0,5);answer=strong.map((item:any)=>String(item.highlights?.[0]||item.summary||item.text||'').trim().slice(0,1400)).filter(Boolean).join('\n\n');}
  else answer=String(data?.output?.content||'').trim()||results.slice(0,social?4:5).map((item:any)=>{const title=String(item.title||'').trim();const snippet=String(item.highlights?.[0]||item.summary||item.text||'').trim();return title?`${title}: ${snippet}`:snippet;}).filter(Boolean).join('\n\n').trim();
  if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return {answer,citations};
}