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

function tanzaniaDateContext(): { today: string; yesterday: string; twoDaysAgo: string } {
  const now = new Date();
  const format = (date: Date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return {
    today: format(now),
    yesterday: format(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    twoDaysAgo: format(new Date(now.getTime() - 48 * 60 * 60 * 1000)),
  };
}

function isFreshOrRelativeQuery(query: string): boolean {
  return /\b(jana|juzi|leo|today|yesterday|latest|newest|current|sasa|wa sasa|hivi punde|habari mpya|habari za leo|wiki hii|this week|matokeo ya|mechi ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda)\b/i.test(query);
}

function isSportsResultQuery(query: string): boolean {
  return /\b(simba|yanga|young africans|azam|coastal union|singida|geita gold|jkt tanzania|namungo|mashujaa|dodoma jiji|kagera sugar|tabora united|mechi|mchezo|matokeo|score|full time|ft|win|won|lost|draw|ushindi|amecheza|ilicheza|amefungwa|imeshinda|kashinda|mshindi|mpinzani|opponent|fixture|standings|ligi|premier league|champions league|caf)\b/i.test(query);
}

function resultStrength(item: any): number {
  const text = `${item?.title || ''} ${item?.highlights?.join?.(' ') || ''} ${item?.summary || ''} ${item?.text || ''}`.toLowerCase();
  let score = 0;
  if (/\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|beat|victory|1\s*[-–]\s*0|0\s*[-–]\s*1|2\s*[-–]\s*1|1\s*[-–]\s*2)\b/i.test(text)) score += 8;
  if (/\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\b/i.test(text)) score -= 8;
  if (/\b(august|september|january|february|march|april|may|june|july|october|november|december|2026)\b/i.test(text)) score += 2;
  return score;
}

export async function searchWithExa(query: string): Promise<ExaSearchResult> {
  const apiKey = resolveExaApiKey();
  const dates = tanzaniaDateContext();
  const fresh = isFreshOrRelativeQuery(query);
  const sportsResult = isSportsResultQuery(query);
  const requestedDate = /\b(jana|yesterday)\b/i.test(query)
    ? dates.yesterday
    : /\b(juzi)\b/i.test(query)
      ? dates.twoDaysAgo
      : dates.today;

  const queryWithAbsoluteDates = fresh
    ? `${query}\nIMPORTANT DATE CONTEXT: Current date in Tanzania is ${dates.today}. Requested event date is ${requestedDate}. If the user says "jana/yesterday", that means ${dates.yesterday}; if "juzi", that means ${dates.twoDaysAgo}. ${sportsResult ? 'SPORTS RESULT REQUIREMENT: find the completed match on the requested date. Search specifically for final/full-time result, opponent and score. Ignore pre-match previews, fixtures, scheduled kick-off pages and articles saying the teams WILL play.' : 'Use the requested event date, not an older event with a similar name.'}`
    : query;

  const body: Record<string, unknown> = {
    query: sportsResult
      ? `${queryWithAbsoluteDates}\nFINAL RESULT ONLY: ${requestedDate} full time final score opponent result after the match`
      : queryWithAbsoluteDates,
    type: fresh ? 'fast' : 'auto',
    numResults: sportsResult ? 12 : (fresh ? 10 : 8),
    contents: { highlights: true, text: true },
  };

  if (fresh) {
    const requestedStart = new Date(`${requestedDate}T00:00:00+03:00`).toISOString();
    body.startPublishedDate = sportsResult ? requestedStart : new Date(new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).getTime()).toISOString();
    body.endPublishedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    body.category = 'news';
    body.systemPrompt = `Return only information supported by the freshest search results. Current Tanzania date=${dates.today}; requested event date=${requestedDate}. ${sportsResult ? 'For sports questions, the requested event must be completed. Prefer pages explicitly showing FT/full-time/final result or a completed match score. Reject pre-match previews, fixture pages without a result, scheduled kick-off pages, and text saying the teams will play. Do not use an older head-to-head result. If no completed result is supported, say that no verified final result was found instead of guessing.' : 'For relative dates, use the requested event date and do not substitute an older event with a similar title.'}`;
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`EXA_SEARCH_FAILED: HTTP ${response.status}${errorBody ? ` - ${errorBody.slice(0, 500)}` : ''}`);
  }

  const data = await response.json() as any;
  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const rankedResults = sportsResult
    ? [...rawResults].sort((a: any, b: any) => resultStrength(b) - resultStrength(a))
    : rawResults;
  const results = rankedResults.slice(0, sportsResult ? 10 : 8);
  const citations = results
    .filter((item: any) => item?.url)
    .map((item: any) => ({ title: String(item.title || item.url).trim(), url: String(item.url).trim() }));

  // Exa's synthesized answer can sometimes promote a same-day pre-match story.
  // For sports result questions, build the evidence passed to MKUU from the
  // highest-confidence result pages instead of trusting that synthesis blindly.
  let answer = '';
  if (sportsResult) {
    const strong = results.filter((item: any) => resultStrength(item) >= 6).slice(0, 5);
    answer = strong
      .map((item: any, index: number) => {
        const title = String(item.title || item.url || '').trim();
        const published = item.publishedDate ? ` | published ${item.publishedDate}` : '';
        const evidence = String(item.highlights?.[0] || item.summary || item.text || '').trim().slice(0, 1800);
        return `${index + 1}. ${title}${published}\n${evidence}`;
      })
      .join('\n\n');
    if (!answer) {
      throw new Error(`EXA_SEARCH_NO_VERIFIED_SPORTS_RESULT: No completed final result found for ${requestedDate}.`);
    }
  } else {
    answer = String(data?.output?.content || '').trim();
    if (!answer) {
      answer = results
        .map((item: any, index: number) => `${index + 1}. ${item.title || item.url}${item.publishedDate ? ` (${item.publishedDate})` : ''}\n${item.highlights?.[0] || item.summary || item.text || ''}`)
        .join('\n\n')
        .trim();
    }
  }

  if (!answer) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return { answer, citations };
}
