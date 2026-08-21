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

// ---------------------------------------------------------------------------
// 1) Keep Tavily sources owned by the response that produced them.
// ---------------------------------------------------------------------------
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

  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      'generatedFiles?: any[];\n}',
      'generatedFiles?: any[];\n  webSources?: Array<{ title: string; url: string }>;\n}'
    );
  }

  if (!source.includes('webSources: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      'generatedFiles: GeneratedFileSummary[];\n  aiProvider:',
      'generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:'
    );
  }

  if (!source.includes('let responseWebSources: Array<{ title: string; url: string }> = [];')) {
    source = source.replace(
      "let aiReplyText = '';",
      "let aiReplyText = '';\n    let responseWebSources: Array<{ title: string; url: string }> = [];"
    );
  }

  if (!source.includes('responseWebSources = getLastTavilySources();')) {
    source = source.replace(
      'const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);',
      'const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);\n        responseWebSources = getLastTavilySources();'
    );
  }

  if (!source.includes('webSources: responseWebSources')) {
    source = source.replace(
      'generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,',
      'generatedFiles: generatedFilesList,\n      webSources: responseWebSources,\n      aiProvider: AI_PROVIDER,'
    );
  }
  return source;
});

// ---------------------------------------------------------------------------
// 2) Persist webSources with the assistant message and expose them through
//    /api/chat. This makes historical source attribution possible.
// ---------------------------------------------------------------------------
patch('server.ts', 'persist response-owned web sources', (source) => {
  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      "generatedFiles?: any[];\n  }",
      "generatedFiles?: any[];\n      webSources?: Array<{ title: string; url: string }>;\n    }"
    );
  }

  if (!source.includes('webSources:result.webSources || []')) {
    source = source.replace(
      'generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)}',
      'generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name),webSources:result.webSources || []}'
    );
  }

  source = source.replace(
    'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};',
    'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources || [],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};'
  );

  // Historical source questions must use the sources attached to the previous
  // assistant response. They must never trigger a fresh web search.
  if (!source.includes('MKUU_HISTORICAL_SOURCE_ANSWER')) {
    const marker = "    const searchMessage = currentFactQuery && !/\\b(tafuta google|search google|tafuta mtandaoni|search online)\\b/i.test(lowerMessage)\n      ? `Tafuta Google na uthibitishe taarifa za sasa kabla ya kujibu. Swali la mtumiaji: ${message}`\n      : message;\n\n";
    const replacement = marker + `    const sourceQuestion = /\\b(source|chanzo|ulipata wapi|umepata wapi|umeitoa wapi|imetoka wapi|where did you get|what is the source)\\b/i.test(lowerMessage);\n    const historicalSourceMessage = [...effectiveHistory].reverse().find((item:any) => item?.role === 'assistant' && Array.isArray(item?.webSources) && item.webSources.length > 0);\n    const historicalSources = historicalSourceMessage?.webSources || [];\n    if (sourceQuestion && historicalSources.length > 0) {\n      const sourceLines = historicalSources.map((s:any, i:number) => `${i + 1}. ${s.title || 'Chanzo'}\\n   ${s.url}`).join('\\n');\n      const reply = `Taarifa hiyo ilitokana na vyanzo vilivyotumika kwenye jibu langu la awali. Sikutafanya utafutaji mpya kwa swali hili.\\n\\n${sourceLines}`;\n      return { reply, cleanSpeechText: reply, memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], webSources: historicalSources, aiProvider: 'Google Gemini', chatModel: 'historical-source-reference', latencyMs: 0, __MKUU_HISTORICAL_SOURCE_ANSWER: true };\n    }\n\n`;
    source = source.replace(marker, replacement);
  }

  return source;
});

// ---------------------------------------------------------------------------
// 3) Save the backend-provided sources in the browser's ChatMessage too.
// ---------------------------------------------------------------------------
patch('src/App.tsx', 'persist web sources in client chat messages', (source) => {
  if (!source.includes('webSources: chatResult.webSources || []')) {
    source = source.replace(
      'personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        savedOffline: true,',
      'personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        webSources: chatResult.webSources || [],\n        savedOffline: true,'
    );
  }
  return source;
});

patch('src/services/aiEngine.ts', 'carry web sources through chat engine', (source) => {
  if (!source.includes('webSources?: Array<{ title: string; url: string }>')) {
    source = source.replace(
      'generatedFiles?: GeneratedFileSummary[];\n  engineUsed:',
      'generatedFiles?: GeneratedFileSummary[];\n  webSources?: Array<{ title: string; url: string }>;\n  engineUsed:'
    );
  }
  if (!source.includes('webSources: serverRes.webSources')) {
    source = source.replace(
      'generatedFiles: serverRes.generatedFiles,\n    engineUsed:',
      'generatedFiles: serverRes.generatedFiles,\n    webSources: serverRes.webSources || [],\n    engineUsed:'
    );
  }
  return source;
});

console.log('MKUU: Historical source attribution is isolated: searched responses retain their own sources; source follow-ups reuse the referenced response sources without a new search.');
