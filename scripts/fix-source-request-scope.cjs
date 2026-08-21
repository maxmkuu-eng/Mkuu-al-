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

  if (!source.includes('tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources])')) {
    const govNeedle = `   lastTavilySources=[
     {title:'Ikulu — Baraza la Mawaziri (primary)',url:'https://www.ikulu.go.tz/index.php/cabinet'},
     ...secondary.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,8),
   ];`;
    source = source.replace(govNeedle, govNeedle + `\n   tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);`);
    const genericNeedle = ` lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);\n return formatResults(results);`;
    source = source.replace(genericNeedle, ` lastTavilySources=results.map(r=>({title:String(r?.title||'').trim(),url:String(r?.url||'').trim()})).filter(s=>s.url).slice(0,6);\n tavilySourcesByQuery.set(sourceKey(query), [...lastTavilySources]);\n return formatResults(results);`);
  }
  return source;
});

patch('server/geminiService.ts', 'request-scoped source propagation', (source) => {
  source = source.replace(
    `import { searchWithTavily } from './tavilySearch.js';`,
    `import { searchWithTavily, getTavilySourcesForQuery } from './tavilySearch.js';`
  );
  const oldSearch = "        const tavilyResults = await searchWithTavily(`" + '${message}' + "\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);";
  const newSearch = "        const searchEvidenceQuery = `" + '${message}' + "\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`;\n        const tavilyResults = await searchWithTavily(searchEvidenceQuery);";
  source = source.replace(oldSearch, newSearch);
  if (!source.includes('requestWebSources')) {
    source = source.replace(`    let aiReplyText = '';`, `    let aiReplyText = '';\n    let requestWebSources: Array<{ title: string; url: string }> = [];`);
    source = source.replace(
      `        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');`,
      `        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');\n        requestWebSources = getTavilySourcesForQuery(searchEvidenceQuery);`
    );
    source = source.replace(
      `      generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,`,
      `      generatedFiles: generatedFilesList,\n      webSources: requestWebSources,\n      aiProvider: AI_PROVIDER,`
    );
    source = source.replace(
      `  generatedFiles: GeneratedFileSummary[];\n  aiProvider:`,
      `  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:`
    );
  }
  return source;
});

patch('server.ts', 'API response-owned sources', (source) => {
  const oldImport = `import { getLastTavilySources } from './server/tavilySearch.js';`;
  const newImport = `import { getLastTavilySources, clearLastTavilySources } from './server/tavilySearch.js';`;
  if (source.includes(oldImport)) source = source.replace(oldImport, newImport);
  else if (!source.includes('clearLastTavilySources')) {
    source = source.replace(`import { universalAgent } from './server/agentEngine.js';`, `import { universalAgent } from './server/agentEngine.js';\nimport { clearLastTavilySources } from './server/tavilySearch.js';`);
  }
  if (!source.includes('clearLastTavilySources(); // MKUU request-scoped source reset')) {
    source = source.replace(
      `  const processChatRequest = async (req:any) => {\n    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};`,
      `  const processChatRequest = async (req:any) => {\n    // Web sources belong only to this request; memory/history remains persistent.\n    clearLastTavilySources(); // MKUU request-scoped source reset\n    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};`
    );
  }
  source = source.replace(
    `const a={id:\`msg_\${Date.now()}_a\`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)};`,
    `const a={id:\`msg_\${Date.now()}_a\`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name),webSources:result.webSources||[]};`
  );
  source = source.replace(
    `return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};`,
    `return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};`
  );
  source = source.replace(
    `res.write(\`data: \${JSON.stringify({type:'done',...result})}\\n\\n\`);`,
    `res.write(\`data: \${JSON.stringify({type:'done',...result,webSources:result.webSources||[]})}\\n\\n\`);`
  );
  return source;
});

console.log('MKUU: source state is request-scoped; stale sources cannot leak across searches.');
