const fs = require('node:fs');

function patch(file, label, fn) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`MKUU: ${label} applied.`);
  } else {
    console.log(`MKUU: ${label} already applied.`);
  }
}

patch('server.ts', 'final request-scoped source ownership', (source) => {
  source = source.replace(
    'webSources:getLastTavilySources(),aiProvider:result.aiProvider',
    'webSources:result.webSources || [],aiProvider:result.aiProvider'
  );
  source = source.replace(
    "{type:'done',...result,webSources:getLastTavilySources()}",
    "{type:'done',...result,webSources:result.webSources || []}"
  );
  return source;
});

patch('server/tavilySearch.ts', 'clear stale sources when a request does not search', (source) => {
  if (!source.includes('export function clearLastTavilySources')) {
    source = source.replace(
      'export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }',
      'export function getLastTavilySources(): TavilySource[] { return [...lastTavilySources]; }\nexport function clearLastTavilySources(): void { lastTavilySources = []; }'
    );
  }
  return source;
});

patch('server/geminiService.ts', 'capture sources per search response', (source) => {
  source = source.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily, getLastTavilySources } from './tavilySearch.js';"
  );

  if (!source.includes('const tavilySourcesForResponse = getLastTavilySources();')) {
    source = source.replace(
      'const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);',
      'const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);\n        const tavilySourcesForResponse = getLastTavilySources();'
    );
  }

  if (!source.includes('webSources: isSearchQuery ? tavilySourcesForResponse : []')) {
    source = source.replace(
      'generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,',
      'generatedFiles: generatedFilesList,\n      webSources: isSearchQuery ? (typeof tavilySourcesForResponse !== \'undefined\' ? tavilySourcesForResponse : []) : [],\n      aiProvider: AI_PROVIDER,'
    );
  }

  if (!source.includes('webSources: [] as Array<{ title: string; url: string }>,')) {
    source = source.replace(
      'generatedFiles: GeneratedFileSummary[];\n  aiProvider:',
      'generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:'
    );
  }
  return source;
});

console.log('MKUU: Sources are isolated per response; memory remains persistent; searched responses keep only their own sources.');
