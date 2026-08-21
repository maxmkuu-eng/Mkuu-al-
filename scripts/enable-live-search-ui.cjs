const fs = require('node:fs');
const path = require('node:path');

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function write(filePath, source) {
  fs.writeFileSync(filePath, source, 'utf8');
}

function ensure(filePath, label, transform) {
  if (!fs.existsSync(filePath)) {
    console.log(`MKUU: skipped ${label}; file not found`);
    return;
  }
  const before = read(filePath);
  const after = transform(before);
  if (after !== before) {
    write(filePath, after);
    console.log(`MKUU: applied ${label}`);
  } else {
    console.log(`MKUU: verified ${label}`);
  }
}

const root = process.cwd();
const server = path.join(root, 'server.ts');
const aiEngine = path.join(root, 'src/services/aiEngine.ts');
const app = path.join(root, 'src/App.tsx');
const chatView = path.join(root, 'src/components/ChatView.tsx');

ensure(server, 'Tavily source metadata', (source) => {
  if (!source.includes('getLastTavilySources')) {
    source = source.replace(
      "import { searchWithTavily } from './server/tavilySearch.js';",
      "import { searchWithTavily, getLastTavilySources } from './server/tavilySearch.js';"
    );
  }

  if (!source.includes('webSources:getLastTavilySources()')) {
    source = source.replace(
      'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};',
      'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:getLastTavilySources(),aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};'
    );
  }

  if (!source.includes("webSources:getLastTavilySources()})")) {
    source = source.replace(
      "res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);",
      "res.write(`data: ${JSON.stringify({type:'done',...result,webSources:getLastTavilySources()})}\\n\\n`);"
    );
  }

  return source;
});

ensure(aiEngine, 'server-only chat routing and source propagation', (source) => {
  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      '  intent?: string;\n}',
      '  intent?: string;\n  webSources?: Array<{ title: string; url: string }>;\n}'
    );
  }

  // Browser-side Gemini bypass prevented Tavily evidence/source URLs from reaching the UI.
  source = source.replace(
    /\n\s*const directApiKey = getStoredGeminiApiKey\(\);\n\s*if \(directApiKey && directApiKey\.trim\(\)\.length > 10\) return callDirectGemini\(directApiKey\.trim\(\), params\);\n/,
    '\n'
  );

  if (!source.includes('webSources: serverRes.webSources || []')) {
    source = source.replace(
      "    intent: serverRes.intent || 'chat',\n  };",
      "    intent: serverRes.intent || 'chat',\n    webSources: serverRes.webSources || [],\n  };"
    );
  }

  if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
    source = source.replace(
      "  let reply = '';\n  emitStream('', false);",
      "  let reply = '';\n  let webSources: Array<{ title: string; url: string }> = [];\n  emitStream('', false);"
    );
  }

  if (!source.includes("if (payload.type === 'done' && Array.isArray(payload.webSources))")) {
    source = source.replace(
      "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
      "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done' && Array.isArray(payload.webSources)) webSources = payload.webSources;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');"
    );
  }

  if (!source.includes('intent: \'chat\', webSources };')) {
    source = source.replace(
      "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
      "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat', webSources };"
    );
  }

  return source;
});

ensure(app, 'web-source message persistence', (source) => {
  if (!source.includes('webSources: chatResult.webSources || [],')) {
    source = source.replace(
      "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        savedOffline: true,",
      "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        webSources: chatResult.webSources || [],\n        savedOffline: true,"
    );
  }
  return source;
});

ensure(chatView, 'clickable right-aligned source footer', (source) => {
  if (source.includes('Vyanzo vya taarifa')) return source;

  const marker = '                        {/* Extracted Memory Tag */}';
  const footer = `                        {msg.webSources && msg.webSources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-[#222222] flex flex-col items-end gap-1.5 not-italic font-sans">
                            <div className="text-[9px] uppercase tracking-wider font-bold text-[#777777]">Vyanzo vya taarifa</div>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {msg.webSources.slice(0, 5).map((source, idx) => (
                                <a
                                  key={source.url + '-' + idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-[#333333] text-[10px] text-[#D4AF37] hover:text-white hover:border-[#D4AF37]/60 transition"
                                  title={'Fungua chanzo: ' + (source.title || source.url)}
                                >
                                  <span>{source.title || ('Chanzo ' + (idx + 1))}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

`;

  return source.includes(marker) ? source.replace(marker, footer + marker) : source;
});

console.log('MKUU: live-search/source build patch is idempotent.');
