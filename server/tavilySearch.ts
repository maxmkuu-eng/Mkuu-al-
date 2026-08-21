export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export async function searchWithTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured on MKUU Backend.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      topic: 'general',
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Tavily Search HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ''}`);
  }

  const data = (await response.json()) as { results?: TavilySearchResult[] };
  const results = Array.isArray(data.results) ? data.results : [];

  if (results.length === 0) {
    throw new Error('Tavily Search returned no results.');
  }

  return results
    .map((result, index) => {
      const title = String(result?.title || '').trim();
      const url = String(result?.url || '').trim();
      const content = String(result?.content || '').trim();
      return `[CHANZO ${index + 1}]\nKichwa: ${title}\nURL: ${url}\nTaarifa: ${content}`;
    })
    .join('\n\n');
}
