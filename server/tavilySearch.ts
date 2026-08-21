export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

const SPORTS_TERMS = [
  'yanga', 'young africans', 'simba sc', 'simba', 'azam fc', 'coastal union',
  'polisi tanzania', 'jkt tanzania', 'namungo', 'mashujaa', 'geita gold',
  'tabora united', 'mbeya city', 'mechi', 'mchezo', 'matokeo', 'score',
  'kikosi', 'ratiba', 'magoli', 'mshindi', 'football', 'soccer', 'match',
  'premier league', 'champions league', 'caf', 'tff', 'ligi kuu',
];

function isSportsQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SPORTS_TERMS.some((term) => lower.includes(term));
}

async function runTavilySearch(query: string, topic: 'general' | 'news'): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      topic,
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Tavily Search HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ''}`);
  }

  const data = (await response.json()) as { results?: TavilySearchResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

export async function searchWithTavily(query: string): Promise<string> {
  const sports = isSportsQuery(query);
  const searches = sports
    ? await Promise.all([
        runTavilySearch(query, 'general'),
        runTavilySearch(`${query} final score FT full time result completed match`, 'news'),
      ])
    : [await runTavilySearch(query, 'general')];

  const merged = searches.flat();
  const unique = new Map<string, TavilySearchResult>();
  for (const result of merged) {
    const url = String(result?.url || '').trim();
    if (!url) continue;
    const previous = unique.get(url);
    if (!previous || Number(result.score || 0) > Number(previous.score || 0)) unique.set(url, result);
  }

  const results = Array.from(unique.values())
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 12);

  if (results.length === 0) throw new Error('Tavily Search returned no results.');

  return results
    .map((result, index) => {
      const title = String(result?.title || '').trim();
      const url = String(result?.url || '').trim();
      const content = String(result?.content || '').trim();
      return `[CHANZO ${index + 1}]\nKichwa: ${title}\nURL: ${url}\nTaarifa: ${content}`;
    })
    .join('\n\n');
}
