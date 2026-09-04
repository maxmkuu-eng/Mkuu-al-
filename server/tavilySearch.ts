import { searchWithExa } from './exaSearch.js';

// Compatibility bridge for the existing GeminiService import.
// Live search is provided by Exa; Gemini runtime remains unchanged.
export async function searchWithTavily(query: string): Promise<string> {
  const result = await searchWithExa(query);
  const sources = result.citations.map((c) => `${c.title}: ${c.url}`).join('\n');
  return `${result.answer}${sources ? `\n\nSOURCES:\n${sources}` : ''}`;
}
