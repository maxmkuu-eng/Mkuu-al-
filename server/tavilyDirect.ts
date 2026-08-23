export interface TavilyDirectSource {
  title: string;
  url: string;
  content?: string;
  published_date?: string;
}

export interface TavilyDirectResult {
  answer: string;
  sources: TavilyDirectSource[];
}

/**
 * Direct Tavily answer path.
 * This endpoint is intentionally independent of Gemini: Tavily performs the
 * live retrieval + answer generation and MKUU returns that answer verbatim.
 */
export async function answerDirectlyWithTavily(query: string): Promise<TavilyDirectResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');

  const now = new Date();
  const tz = 'Africa/Dar_es_Salaam';
  const time = new Intl.DateTimeFormat('sw-TZ', {
    timeZone: tz,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now);

  // Tavily does not expose a minute-level freshness filter. We therefore use
  // today's index plus an explicit Tanzania timestamp so newly indexed events
  // (including events from ~30 minutes ago) are prioritized by the search engine.
  const prompt = `${query}\n\nCurrent Tanzania time: ${time} (Africa/Dar_es_Salaam, UTC+3).\nFind the newest information available right now. If this happened within the last 30 minutes, prefer that newest report. Do not rely on old information when a newer source exists.`;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: prompt,
      search_depth: 'advanced',
      topic: /mechi|mchezo|score|matokeo|football|soccer|match|breaking|news|leo|sasa|hivi sasa|latest|current/i.test(query) ? 'news' : 'general',
      max_results: 10,
      include_answer: 'advanced',
      include_raw_content: false,
      time_range: 'day',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Tavily Direct HTTP ${response.status}${text ? `: ${text.slice(0, 500)}` : ''}`);
  }

  const data = await response.json() as {
    answer?: string;
    results?: Array<TavilyDirectSource & { score?: number }>;
  };

  const sources = Array.isArray(data.results)
    ? data.results
        .filter((r) => r?.url)
        .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
        .slice(0, 8)
        .map((r) => ({ title: String(r.title || '').trim(), url: String(r.url).trim(), content: r.content, published_date: r.published_date }))
    : [];

  const answer = String(data.answer || '').trim();
  if (!answer) throw new Error('Tavily Direct returned no answer.');

  return { answer, sources };
}
