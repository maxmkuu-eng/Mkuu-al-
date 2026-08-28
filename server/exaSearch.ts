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

export async function searchWithExa(query: string): Promise<ExaSearchResult> {
  const apiKey = resolveExaApiKey();
  const dates = tanzaniaDateContext();
  const fresh = isFreshOrRelativeQuery(query);
  const queryWithAbsoluteDates = fresh
    ? `${query}\nIMPORTANT DATE CONTEXT: Current date in Tanzania is ${dates.today}. If the user says "jana/yesterday", that means ${dates.yesterday}. If the user says "juzi", that means ${dates.twoDaysAgo}. Use the event date asked for, not an older event with a similar name.`
    : query;

  const body: Record<string, unknown> = {
    query: queryWithAbsoluteDates,
    type: fresh ? 'fast' : 'auto',
    numResults: fresh ? 10 : 8,
    contents: { highlights: true, text: true },
  };

  // For fresh/news-style questions, constrain publication dates so yesterday's
  // questions do not silently fall back to old indexed pages. The query itself
  // also contains the absolute date because event date != publication date.
  if (fresh) {
    body.startPublishedDate = new Date(new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).getTime()).toISOString();
    body.endPublishedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    body.category = 'news';
    body.systemPrompt = `Return only information supported by the freshest search results. Treat relative dates using Tanzania time: today=${dates.today}, yesterday=${dates.yesterday}, twoDaysAgo=${dates.twoDaysAgo}. For sports or match questions, identify the exact event date and opponent/result; never substitute an older match with a similar title. If there is no reliable result for the requested date, explicitly say that rather than guessing.`;
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
  const results = Array.isArray(data?.results) ? data.results : [];
  const citations = results
    .filter((item: any) => item?.url)
    .slice(0, 8)
    .map((item: any) => ({ title: String(item.title || item.url).trim(), url: String(item.url).trim() }));

  let answer = String(data?.output?.content || '').trim();
  if (!answer) {
    answer = results
      .slice(0, 8)
      .map((item: any, index: number) => `${index + 1}. ${item.title || item.url}${item.publishedDate ? ` (${item.publishedDate})` : ''}\n${item.highlights?.[0] || item.summary || item.text || ''}`)
      .join('\n\n')
      .trim();
  }

  if (!answer) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return { answer, citations };
}
