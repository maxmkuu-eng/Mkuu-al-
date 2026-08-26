export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
}

export async function searchWithExa(query: string): Promise<string> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured on MKUU Backend.');

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      type: 'fast',
      numResults: 8,
      contents: { text: { maxCharacters: 4000 } },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`EXA_SEARCH_FAILED: HTTP ${response.status}${body ? ` - ${body.slice(0, 300)}` : ''}`);
  }

  const data = await response.json() as { results?: ExaSearchResult[] };
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) throw new Error('EXA_SEARCH_EMPTY: Exa returned no search results.');

  return results.map((item, index) => {
    const title = (item.title || 'Untitled').trim();
    const url = (item.url || '').trim();
    const published = item.publishedDate ? `\nPublished: ${item.publishedDate}` : '';
    const author = item.author ? `\nAuthor: ${item.author}` : '';
    const text = (item.text || '').trim();
    return `[${index + 1}] ${title}\nURL: ${url}${published}${author}\n${text.slice(0, 4000)}`;
  }).join('\n\n');
}
