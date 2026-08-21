const fs = require('node:fs');

function patch(filePath, label, transform) {
  if (!fs.existsSync(filePath)) throw new Error(`MKUU: missing ${filePath}`);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`MKUU: ${label} already applied.`);
  else { fs.writeFileSync(filePath, after, 'utf8'); console.log(`MKUU: ${label} applied.`); }
}

patch('server/tavilySearch.ts', 'request-scoped Tavily sources', (source) => {
  if (!source.includes('tavilySourcesByQuery')) {
    source = source.replace(
      `let lastTavilySources: TavilySource[] = [];
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }`,
      `let lastTavilySources: TavilySource[] = [];
const tavilySourcesByQuery = new Map<string, TavilySource[]>();
function sourceKey(query: string): string { return String(query || '').trim(); }
export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }
export function getTavilySourcesForQuery(query: string): TavilySource[] {
  return [...(tavilySourcesByQuery.get(sourceKey(query)) || [])];
}`
    );
  }

  const governmentNeedle = `   lastTavilySources=[
     {title:'Ikulu — Baraza la Mawaziri (primary)',url:'https://www.ikulu.go.tz/index.php/cabinet'},`;
  if (!source.includes('tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources])')) {
    const governmentReplacement = `${governmentNeedle}
     ...secondary.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,8),
   ];
   tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);`;
    source = source.replace(
      `${governmentNeedle}
     ...secondary.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,8),
   ];`,
      governmentReplacement
    );

    source = source.replace(
      ` lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);
 return formatResults(results);`,
      ` lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);
 tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);
 return formatResults(results);`
    );
  }
  return source;
});

patch('server/geminiService.ts', 'request-scoped source propagation', (source) => {
  source = source.replace(
    `import { searchWithTavily } from './tavilySearch.js';`,
    `import { searchWithTavily, getTavilySourcesForQuery } from './tavilySearch.js';`
  );

  source = source.replace(
    `        const tavilyResults = await searchWithTavily(\`${message}\\nCurrent date/time in Tanzania: \${getCurrentTanzaniaTimeContext().formattedString}\`);`,
    `        const searchEvidenceQuery = \`${message}\\nCurrent date/time in Tanzania: \${getCurrentTanzaniaTimeContext().formattedString}\`;
        const tavilyResults = await searchWithTavily(searchEvidenceQuery);`
  );

  if (!source.includes('requestWebSources')) {
    source = source.replace(
      `    let aiReplyText = '';`,
      `    let aiReplyText = '';
    let requestWebSources: Array<{ title: string; url: string }> = [];`
    );
    source = source.replace(
      `        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');`,
      `        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');
        requestWebSources = getTavilySourcesForQuery(searchEvidenceQuery);`
    );
    source = source.replace(
      `      generatedFiles: generatedFilesList,
      aiProvider: AI_PROVIDER,`,
      `      generatedFiles: generatedFilesList,
      webSources: requestWebSources,
      aiProvider: AI_PROVIDER,`
    );
    source = source.replace(
      `  generatedFiles: GeneratedFileSummary[];
  aiProvider:`,
      `  generatedFiles: GeneratedFileSummary[];
  webSources: Array<{ title: string; url: string }>;
  aiProvider:`
    );
  }
  return source;
});

console.log('MKUU: source state is request-scoped; stale sources cannot leak across searches.');
