const fs = require('node:fs');

function patch(filePath, label, transform) {
  if (!fs.existsSync(filePath)) throw new Error(`MKUU: missing ${filePath}`);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`MKUU: ${label} already applied.`);
  else { fs.writeFileSync(filePath, after, 'utf8'); console.log(`MKUU: ${label} applied.`); }
}

patch('server/tavilySearch.ts', 'request-scoped Tavily sources', (source) => {
  if (!source.includes('const tavilySourcesByQuery = new Map<string, TavilySource[]>();')) {
    source = source.replace(
      'let lastTavilySources: TavilySource[] = [];\nexport function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }',
      `let lastTavilySources: TavilySource[] = [];
const tavilySourcesByQuery = new Map<string, TavilySource[]>();
function sourceKey(query: string): string { return String(query || '').trim(); }
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }
export function getTavilySourcesForQuery(query: string): TavilySource[] {
  return [...(tavilySourcesByQuery.get(sourceKey(query)) || [])];
}`
    );
  }

  // Store the source list under the exact search query as well as the legacy last list.
  const oldGovernment = 'lastTavilySources=[\n     {title:\'Ikulu — Baraza la Mawaziri (primary)\',url:\'https://www.ikulu.go.tz/index.php/cabinet\'},';
  if (!source.includes('tavilySourcesByQuery.set(sourceKey(query), lastTavilySources);')) {
    source = source.replace(
      'lastTavilySources=[\n     {title:\'Ikulu — Baraza la Mawaziri (primary)\',url:\'https://www.ikulu.go.tz/index.php/cabinet\'},\n     ...secondary',
      'lastTavilySources=[\n     {title:\'Ikulu — Baraza la Mawaziri (primary)\',url:\'https://www.ikulu.go.tz/index.php/cabinet\'},\n     ...secondary'
    );
    source = source.replace(
      '  return snapshot+\'\\n\\n\'+sourceBlock+',',
      '  tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);\n   return snapshot+\'\\n\\n\'+sourceBlock+'
'
    );
  }

  // The generic path also needs its own query-scoped source list.
  if (!source.includes('tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);\n return formatResults(results);')) {
    source = source.replace(
      ' lastTavilySources=results.map(r=>({title:String(r?.title||\'\').trim(),url:String(r?.url||\'\').trim()})).filter(s=>s.url).slice(0,6);\n return formatResults(results);',
      ' lastTavilySources=results.map(r=>({title:String(r?.title||\'\').trim(),url:String(r?.url||\'\').trim()})).filter(s=>s.url).slice(0,6);\n tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);\n return formatResults(results);'
    );
  }

  return source;
});

patch('server/geminiService.ts', 'request-scoped source propagation', (source) => {
  source = source.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily, getTavilySourcesForQuery } from './tavilySearch.js';"
  );

  if (!source.includes('const searchEvidenceQuery = `${message}\\nCurrent date/time in Tanzania:')) {
    source = source.replace(
      "        const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);",
      "        const searchEvidenceQuery = `${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`;\n        const tavilyResults = await searchWithTavily(searchEvidenceQuery);"
    );
  }

  if (!source.includes('let requestWebSources: Array<{ title: string; url: string }> = [];')) {
    source = source.replace(
      '    let aiReplyText = \'\';',
      "    let aiReplyText = '';\n    let requestWebSources: Array<{ title: string; url: string }> = [];"
    );
  }

  if (!source.includes('requestWebSources = getTavilySourcesForQuery(searchEvidenceQuery);')) {
    source = source.replace(
      "        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');",
      "        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');\n        requestWebSources = getTavilySourcesForQuery(searchEvidenceQuery);"
    );
  }

  if (!source.includes('webSources: requestWebSources,')) {
    source = source.replace(
      '      generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,',
      '      generatedFiles: generatedFilesList,\n      webSources: requestWebSources,\n      aiProvider: AI_PROVIDER,'
    );
  }

  if (!source.includes('webSources: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      '  generatedFiles: GeneratedFileSummary[];\n  aiProvider:',
      '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:'
    );
  }

  return source;
});

console.log('MKUU: source state is now request-scoped; stale sources cannot leak across concurrent searches.');
