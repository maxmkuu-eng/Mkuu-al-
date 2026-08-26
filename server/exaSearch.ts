export interface ExaCitation {
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string;
}

export interface ExaAnswerResponse {
  answer?: string;
  citations?: ExaCitation[];
}

/**
 * Exclusive live-search provider for MKUU.
 * Exa /answer performs the web retrieval and answer synthesis itself.
 * Gemini and Tavily are deliberately NOT called on this path.
 */
function resolveExaApiKey(): string {
  // Faable has shown EXA_API_KEY in deployment environment listings with
  // surrounding backticks. Resolve the canonical name plus safely-normalized
  // variants without ever logging the secret value.
  const env = process.env as Record<string, string | undefined>;
  const direct = [
    env.EXA_API_KEY,
    env['`EXA_API_KEY`'],
    env['EXA_API_KEY '],
    env[' EXA_API_KEY'],
    env['"EXA_API_KEY"'],
    env["'EXA_API_KEY'"],
  ];

  const normalized = Object.entries(env).find(([name, value]) => {
    const normalizedName = name.trim().replace(/^['"`]+|['"`]+$/g, '').toUpperCase();
    return normalizedName === 'EXA_API_KEY' && typeof value === 'string' && value.trim();
  })?.[1];

  const value = [...direct, normalized].find((item) => typeof item === 'string' && item.trim());
  if (!value) return '';

  // Also tolerate accidental quoting around the value when entered in a
  // deployment dashboard. Never print this value to logs.
  return value.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
}

export async function searchWithExa(query: string): Promise<string> {
  const apiKey = resolveExaApiKey();

  if (!apiKey) {
    throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  }

  const response = await fetch('https://api.exa.ai/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      text: true,
      model: 'exa',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`EXA_SEARCH_FAILED: HTTP ${response.status}${body ? ` - ${body.slice(0, 300)}` : ''}`);
  }

  const data = await response.json() as ExaAnswerResponse;
  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  if (!answer) throw new Error('EXA_SEARCH_EMPTY: Exa returned no answer.');

  const citations = Array.isArray(data.citations) ? data.citations : [];
  const sources = citations
    .filter((item) => item?.url)
    .slice(0, 8)
    .map((item, index) => {
      const title = (item.title || item.url).trim();
      const date = item.publishedDate ? ` — ${item.publishedDate.slice(0, 10)}` : '';
      return `[${index + 1}] ${title}${date}\n${item.url}`;
    })
    .join('\n\n');

  return sources ? `${answer}\n\n### Sources\n${sources}` : answer;
}
