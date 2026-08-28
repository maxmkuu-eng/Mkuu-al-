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
  return {
    today: formatDate(now),
    yesterday: formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    twoDaysAgo: formatDate(new Date(now.getTime() - 48 * 60 * 60 * 1000)),
    formatted: `${fullFormatter.format(now)} (Africa/Dar_es_Salaam, UTC+3)`,
  };
}

function isFreshOrRelativeQuery(query: string): boolean {
  return /\b(jana|juzi|leo|today|yesterday|latest|newest|current|sasa|wa sasa|hivi punde|habari mpya|habari za leo|wiki hii|this week|matokeo ya|mechi ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda)\b/i.test(query);
}

function isSocialQuery(query: string): boolean {
  return /\b(instagram|facebook|tiktok|youtube|twitter|x\.com|social media|post ya|tweet|reel|story|official post|profile)\b/i.test(query);
}

function isSportsQuery(query: string): boolean {
  return /\b(simba|yanga|young africans|azam|coastal union|singida|geita gold|jkt tanzania|namungo|mashujaa|dodoma jiji|kagera sugar|tabora united|mechi|mchezo|matokeo|score|full time|ft|win|won|lost|draw|ushindi|amecheza|ilicheza|amefungwa|imeshinda|kashinda|mshindi|mpinzani|opponent|fixture|standings|ligi|premier league|champions league|caf|anacheza|tutacheza|kuikabili|itaikabili)\b/i.test(query);
}

function isFinalResultQuery(query: string): boolean {
  return /\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final)\b/i.test(query) && !/\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho)\b/i.test(query);
}

function isOpponentQuestion(query: string): boolean {
  return /\b(amecheza na nani|amecheza dhidi ya nani|alicheza na nani|ilicheza na nani|anacheza na nani|anacheza dhidi ya nani|atachukua nani|who does .* play|who did .* play|opponent)\b/i.test(query);
}

function resultStrength(item: any): number {
  const text = `${item?.title || ''} ${item?.highlights?.join?.(' ') || ''} ${item?.summary || ''} ${item?.text || ''}`.toLowerCase();
  let score = 0;
  if (/\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|beat|victory|1\s*[-–]\s*0|0\s*[-–]\s*1|2\s*[-–]\s*1|1\s*[-–]\s*2)\b/i.test(text)) score += 8;
  if (/\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\b/i.test(text)) score -= 8;
  if (/\b(august|september|january|february|march|april|may|june|july|october|november|december|2026)\b/i.test(text)) score += 2;
  return score;
}

function extractOpponentAnswer(query: string, results: any[], requestedDate: string): string | null {
  const team = String(query).match(/\b(simba(?: sc)?|yanga(?: sc)?|young africans|azam(?: fc)?|coastal union(?: fc)?)\b/i)?.[1];
  if (!team) return null;
  const teamRegex = team.replace(/\s+/g, '\\s+').replace(/(?:\\s+sc|\\s+fc)$/i, '(?:\\s+(?:SC|FC))?');
  const vsPattern = new RegExp(`${teamRegex}\\s*(?:vs\\.?|v\\.?|versus)\\s*([^|\\-–—,]+)`, 'i');
  const vsReversePattern = new RegExp(`([^|\\-–—,]+)\\s*(?:vs\\.?|v\\.?|versus)\\s*${teamRegex}`, 'i');
  const tomorrowOrFuture = /\b(kesho|tomorrow|will play|will face|anacheza|tutacheza|itaikabili)\b/i.test(query);
  for (const item of results) {
    const haystack = `${item?.title || ''} ${item?.highlights?.join?.(' ') || ''} ${item?.summary || ''}`;
    const direct = haystack.match(vsPattern);
    const reverse = haystack.match(vsReversePattern);
    const opponent = (direct?.[1] || reverse?.[1] || '').replace(/\s*(live score|live result|result|score).*$/i, '').trim();
    if (opponent) {
      const dayWord = /\b(jana|yesterday)\b/i.test(query) ? 'Jana' : /\b(juzi)\b/i.test(query) ? 'Juzi' : /\b(kesho|tomorrow)\b/i.test(query) ? 'Kesho' : 'Leo';
      const verb = tomorrowOrFuture ? 'anacheza' : 'alicheza';
      return `${dayWord} ${team.replace(/\b\w/g, (c) => c.toUpperCase())} ${verb} na ${opponent}.`;
    }
  }
  return null;
}

export async function searchWithExa(query: string): Promise<ExaSearchResult> {
  const apiKey = resolveExaApiKey();
  const dates = tanzaniaDateContext();
  const fresh = isFreshOrRelativeQuery(query);
  const social = isSocialQuery(query);
  const sports = isSportsQuery(query);
  const finalResult = isFinalResultQuery(query);
  const opponentQuestion = isOpponentQuestion(query);
  const requestedDate = /\b(jana|yesterday)\b/i.test(query) ? dates.yesterday : /\b(juzi)\b/i.test(query) ? dates.twoDaysAgo : dates.today;

  const queryWithAbsoluteDates = fresh
    ? `${query}\nIMPORTANT TANZANIA TIME CONTEXT: Current local date/time is ${dates.formatted}. Current date=${dates.today}. Requested event date=${requestedDate}. If the user says "jana/yesterday", that means ${dates.yesterday}; if "juzi", that means ${dates.twoDaysAgo}. ${sports ? (finalResult ? 'SPORTS RESULT REQUIREMENT: find the completed match on the requested date. Search specifically for final/full-time result, opponent and score. Ignore pre-match previews, fixtures and scheduled kick-off pages.' : 'SPORTS FIXTURE REQUIREMENT: find the match scheduled for the requested date. Search for the actual fixture, opponent, venue and kick-off time. Do NOT require a final score and do NOT reject scheduled/pre-match sources.') : 'Use the requested event date, not an older event with a similar name.'}`
    : `${query}\nCURRENT TANZANIA LOCAL TIME: ${dates.formatted}`;

  const body: Record<string, unknown> = {
    query: sports && finalResult ? `${queryWithAbsoluteDates}\nFINAL RESULT ONLY: ${requestedDate} full time final score opponent result after the match` : queryWithAbsoluteDates,
    type: fresh ? 'fast' : 'auto',
    numResults: sports ? 12 : (fresh ? 10 : 8),
    contents: { highlights: true, text: true },
  };

  if (fresh) {
    const requestedStart = new Date(`${requestedDate}T00:00:00+03:00`).toISOString();
    body.startPublishedDate = finalResult ? requestedStart : new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).toISOString();
    body.endPublishedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    body.maxAgeHours = 0;
  }

  const response = await fetch('https://api.exa.ai/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`EXA_SEARCH_FAILED: HTTP ${response.status}${errorBody ? ` - ${errorBody.slice(0, 500)}` : ''}`);
  }

  const data = await response.json() as any;
  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const rankedResults = sports && finalResult ? [...rawResults].sort((a: any, b: any) => resultStrength(b) - resultStrength(a)) : rawResults;
  const results = rankedResults.slice(0, sports ? 10 : 8);
  const citations = results.filter((item: any) => item?.url).map((item: any) => ({ title: String(item.title || item.url).trim(), url: String(item.url).trim() }));

  let answer = '';
  if (sports && opponentQuestion) {
    answer = extractOpponentAnswer(query, results, requestedDate) || '';
    if (!answer) throw new Error(`EXA_SEARCH_NO_VERIFIED_SPORTS_FIXTURE: No verified opponent found for ${requestedDate}.`);
  } else if (sports && finalResult) {
    const strong = results.filter((item: any) => resultStrength(item) >= 6).slice(0, 3);
    answer = strong.map((item: any) => String(item.highlights?.[0] || item.summary || item.text || '').trim().slice(0, 1200)).filter(Boolean).join('\n\n');
    if (!answer) throw new Error(`EXA_SEARCH_NO_VERIFIED_SPORTS_RESULT: No completed final result found for ${requestedDate}.`);
  } else {
    answer = String(data?.output?.content || '').trim();
    if (!answer) answer = results.slice(0, social ? 3 : 2).map((item: any) => String(item.highlights?.[0] || item.summary || item.text || '').trim().slice(0, 1000)).filter(Boolean).join('\n\n').trim();
  }

  if (!answer) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return { answer, citations };
}
