export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilySource {
  title: string;
  url: string;
}

let lastTavilySources: TavilySource[] = [];

export function getLastTavilySources(): TavilySource[] {
  return [...lastTavilySources];
}

const SPORTS_TERMS = [
  'yanga', 'young africans', 'simba sc', 'simba', 'azam fc', 'coastal union',
  'polisi tanzania', 'jkt tanzania', 'namungo', 'mashujaa', 'geita gold',
  'tabora united', 'mbeya city', 'mechi', 'mchezo', 'matokeo', 'score',
  'kikosi', 'ratiba', 'magoli', 'mshindi', 'football', 'soccer', 'match',
  'premier league', 'champions league', 'caf', 'tff', 'ligi kuu',
];

const STANDINGS_TERMS = [
  'msimamo', 'standings', 'table', 'league table', 'pointi', 'points',
  'nafasi', 'position', 'pld', 'played', 'goal difference', 'tofauti ya magoli',
];

function isSportsQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SPORTS_TERMS.some((term) => lower.includes(term));
}

function isStandingsQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return STANDINGS_TERMS.some((term) => lower.includes(term)) &&
    (lower.includes('ligi') || lower.includes('league') || lower.includes('tanzania') || lower.includes('yanga') || lower.includes('simba') || lower.includes('azam'));
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
  const standings = isStandingsQuery(query);
  const searches: Promise<TavilySearchResult[]>[] = [runTavilySearch(query, 'general')];

  if (sports) {
    searches.push(runTavilySearch(`${query} final score FT full time result completed match`, 'news'));

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

  // Dedicated standings layer: search for an actual current table separately
  // from fixtures/results. This prevents Gemini from building a table by mixing
  // old previews, future fixtures and partial snippets from ordinary search.
  if (standings) {
    const today = getTanzaniaDate(0);
    searches.push(runTavilySearch(
      `Tanzania NBC Premier League 2026/2027 current standings table ${today} P W D L GF GA GD points latest updated`,
      'general',
    ));
    searches.push(runTavilySearch(
      `Tanzania NBC Premier League 2026/2027 latest completed results FT final scores updated ${today} Azam TRA Yanga Coastal Union`,
      'news',
    ));
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
    .slice(0, 20);

  if (results.length === 0) throw new Error('Tavily Search returned no results.');

  lastTavilySources = results
    .map((result) => ({ title: String(result?.title || '').trim(), url: String(result?.url || '').trim() }))
    .filter((source) => source.url)
    .slice(0, 6);

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

  const standingsRules = standings
    ? `\n\n[STANDINGS VERIFICATION RULE]\n- This is a league-standings question. Do NOT invent or reconstruct the table from prose snippets alone.\n- Prefer a source that explicitly provides the newest current standings table for Tanzania NBC Premier League 2026/2027.\n- Use only completed FT results when checking whether a team's P/W/D/L/GF/GA/GD/Pts should have changed. Future fixtures, previews, predictions and scheduled matches MUST NOT be counted.\n- A fixture listed without an FT/full-time score is NOT a completed match and must not be described as already played. Conversely, a credible source showing an FT score MUST be treated as completed even if another stale source still labels the same match as upcoming.\n- Before answering, cross-check the explicit standings table against the latest completed results in the supplied evidence, especially the teams mentioned in those results.\n- If Azam FC has an FT result in the evidence for the current round, never say "Azam FC vs TRA United" is still upcoming and never include it among today's fixtures.\n- For a standings question, DO NOT append a generic list of today's fixtures. Only report the standings and, at most, a short note about verified completed results.\n- Never write that today's matches will change the standings unless the user explicitly asks for today's fixtures and the evidence proves those matches are still future at the current Tanzania time.\n- The final table MUST use these columns in this exact order: # | Timu | P | W | D | L | GF | GA | GD | Pts.\n- Keep the table clean and aligned; do not put raw search-source text inside the table.\n- Do not claim a team has played fewer/more matches than the verified FT results support.\n- If the evidence is genuinely contradictory and cannot be resolved, clearly state that the standings could not be verified instead of fabricating numbers.`
    : '';

  return evidence + dateRules + standingsRules;
}
