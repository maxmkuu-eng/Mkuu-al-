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

function getTanzaniaDate(offsetDays = 0): string {
  const now = new Date();
  const date = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function containsRelativeDay(query: string, day: 'jana' | 'leo' | 'kesho'): boolean {
  return query.toLowerCase().includes(day);
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
  const searches: Promise<TavilySearchResult[]>[] = [runTavilySearch(query, 'general')];

  if (sports) {
    searches.push(runTavilySearch(`${query} final score FT full time result completed match`, 'news'));

    // Relative dates such as "jana" are resolved on the server, not by Gemini.
    // This prevents search results for a future fixture/preview from replacing
    // an already-completed match from the requested date.
    if (containsRelativeDay(query, 'jana')) {
      const yesterday = getTanzaniaDate(-1);
      searches.push(runTavilySearch(`${query} Tanzania ${yesterday} FT final score result completed`, 'news'));
    }
    if (containsRelativeDay(query, 'leo')) {
      const today = getTanzaniaDate(0);
      searches.push(runTavilySearch(`${query} Tanzania ${today} FT final score result completed`, 'news'));
    }
    if (containsRelativeDay(query, 'kesho')) {
      const tomorrow = getTanzaniaDate(1);
      searches.push(runTavilySearch(`${query} Tanzania ${tomorrow} fixture schedule`, 'news'));
    }
  }

  const merged = (await Promise.all(searches)).flat();
  const unique = new Map<string, TavilySearchResult>();
  for (const result of merged) {
    const url = String(result?.url || '').trim();
    if (!url) continue;
    const previous = unique.get(url);
    if (!previous || Number(result.score || 0) > Number(previous.score || 0)) unique.set(url, result);
  }

  const results = Array.from(unique.values())
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 16);

  if (results.length === 0) throw new Error('Tavily Search returned no results.');

  const evidence = results
    .map((result, index) => {
      const title = String(result?.title || '').trim();
      const url = String(result?.url || '').trim();
      const content = String(result?.content || '').trim();
      return `[CHANZO ${index + 1}]\nKichwa: ${title}\nURL: ${url}\nTaarifa: ${content}`;
    })
    .join('\n\n');

  const dateRules = sports
    ? `\n\n[SPORTS VERIFICATION RULE]\n- For "jana", the requested event date is the server-resolved Tanzania date ${getTanzaniaDate(-1)}.\n- For "leo", the requested event date is the server-resolved Tanzania date ${getTanzaniaDate(0)}.\n- Treat a completed FT result on the requested date as stronger evidence than a preview, prediction, scheduled fixture, or older H2H result.\n- Never answer "hakuna mechi" merely because one source is a preview or says "upcoming"; compare all supplied evidence first.\n- If multiple credible sources show an FT score for the requested date, use that score.`
    : '';

  return evidence + dateRules;
}
