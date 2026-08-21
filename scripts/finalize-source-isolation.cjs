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

console.log('MKUU: Sources are isolated per response; memory remains persistent.');
