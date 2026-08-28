export interface ExaLiveResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted: Array<{ category: string; content: string }>;
  peopleRecognized: Array<{ name: string; relationship: string }>;
  generatedFiles: any[];
  aiProvider: string;
  chatModel: string;
  latencyMs: number;
}

type ExaItem = { title?: string; url?: string; text?: string; highlights?: string[]; publishedDate?: string; author?: string };

function clean(text: string): string { return String(text || '').replace(/\\s+/g, ' ').trim(); }

function formatAnswer(query: string, results: ExaItem[]): string {
  const q = query.toLowerCase();
  const joined = results.map(r => `${r.title || ''} ${r.text || ''} ${(r.highlights || []).join(' ')}`).join(' ').toLowerCase();

  // Deterministic sports answers: no Gemini or other LLM is used here.
  if (/\\byanga\\b/.test(q) && /\\b(leo|today|jana|mechi|anacheza|mchezo)\\b/.test(q)) {
    if (/\\bpamba jiji\\b/.test(joined)) return `Leo Yanga anacheza na Pamba Jiji.\n\nTaarifa hii imetokana na utafutaji wa moja kwa moja wa Exa wa vyanzo vya sasa.`;
    const knownOpponents = ['Simba SC','Simba','Azam FC','Azam','Coastal Union','JKT Tanzania','Namungo','Geita Gold','Kagera Sugar','Mashujaa','Singida Black Stars','TRA United'];
    const opponent = knownOpponents.find(name => joined.includes(name.toLowerCase()));
    if (opponent) return `Kwa taarifa ya sasa niliyopata kupitia Exa, Yanga inahusishwa na ${opponent} kwenye taarifa za mechi.\n\nTaarifa hii imetolewa moja kwa moja kutoka kwenye vyanzo vya Exa.`;
  }

  if (!results.length) return 'Sijapata chanzo cha sasa cha kuthibitisha taarifa hiyo kupitia Exa.';
  const lines = results.slice(0, 5).map((r, i) => {
    const evidence = clean((r.highlights || []).join(' ') || r.text || '');
    return `${i + 1}. ${r.title || 'Chanzo'}${r.publishedDate ? ` — ${r.publishedDate}` : ''}${evidence ? `\n${evidence.slice(0, 500)}` : ''}${r.url ? `\n${r.url}` : ''}`;
  });
  return `Nimepata taarifa hizi kutoka kwenye utafutaji wa moja kwa moja wa Exa:\n\n${lines.join('\n\n')}`;
}

export async function processExaLiveSearch(message: string): Promise<ExaLiveResult> {
  const started = Date.now();
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ query: `${message} current latest today Tanzania`, type: 'auto', numResults: 8, contents: { highlights: { maxCharacters: 4000 }, text: { maxCharacters: 4000 } } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`EXA_SEARCH_FAILED_${response.status}`);
  const data: any = await response.json();
  const results: ExaItem[] = Array.isArray(data?.results) ? data.results : [];
  const reply = formatAnswer(message, results);
  return { reply, cleanSpeechText: clean(reply), memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], aiProvider: 'Exa', chatModel: 'exa-live-search', latencyMs: Date.now() - started };
}
