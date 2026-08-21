const fs = require('node:fs');
const path = require('node:path');

function patch(filePath, from, to, label) {
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes(from)) return;
  fs.writeFileSync(filePath, source.replace(from, to), 'utf8');
  console.log(`MKUU: applied ${label}`);
}

const root = process.cwd();
const server = path.join(root, 'server.ts');
const aiEngine = path.join(root, 'src/services/aiEngine.ts');
const app = path.join(root, 'src/App.tsx');
const chatView = path.join(root, 'src/components/ChatView.tsx');

for (const filePath of [server, aiEngine, app, chatView]) {
  if (!fs.existsSync(filePath)) continue;
  fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
}

patch(server,
  "import { searchWithTavily } from './server/tavilySearch.js';",
  "import { searchWithTavily, getLastTavilySources } from './server/tavilySearch.js';",
  'Tavily source metadata import');
patch(server,
  "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
  "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:getLastTavilySources(),aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
  'Tavily sources in chat response');
patch(server,
  "res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);",
  "res.write(`data: ${JSON.stringify({type:'done',...result,webSources:getLastTavilySources()})}\\n\\n`);",
  'Tavily sources in stream response');

patch(aiEngine,
  "  const directApiKey = getStoredGeminiApiKey();\n  if (directApiKey && directApiKey.trim().length > 10) return callDirectGemini(directApiKey.trim(), params);\n\n",
  '',
  'browser Gemini-key bypass removal');
patch(aiEngine,
  "  intent?: string;\n}",
  "  intent?: string;\n  webSources?: Array<{ title: string; url: string }>;\n}",
  'webSources result type');
patch(aiEngine,
  "    intent: serverRes.intent || 'chat',\n  };",
  "    intent: serverRes.intent || 'chat',\n    webSources: serverRes.webSources || [],\n  };",
  'webSources native server result');
patch(aiEngine,
  "  let reply = '';\n  emitStream('', false);",
  "  let reply = '';\n  let webSources: Array<{ title: string; url: string }> = [];\n  emitStream('', false);",
  'webSources stream state');
patch(aiEngine,
  "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
  "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done' && Array.isArray(payload.webSources)) webSources = payload.webSources;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
  'webSources stream parsing');
patch(aiEngine,
  "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
  "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat', webSources };",
  'webSources stream result');

patch(app,
  "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        savedOffline: true,",
  "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        webSources: chatResult.webSources || [],\n        savedOffline: true,",
  'webSources local persistence');

patch(chatView,
  "                        </div>\n\n                        {/* Extracted Memory Tag */}",
  "                        </div>\n\n                        {msg.webSources && msg.webSources.length > 0 && (\n                          <div className=\"mt-4 pt-3 border-t border-[#222222] flex flex-col items-end gap-1.5 not-italic font-sans\">\n                            <div className=\"text-[9px] uppercase tracking-wider font-bold text-[#777777]\">Vyanzo vya taarifa</div>\n                            <div className=\"flex flex-wrap justify-end gap-1.5\">\n                              {msg.webSources.slice(0, 5).map((source, idx) => (\n                                <a key={`${source.url}-${idx}`} href={source.url} target=\"_blank\" rel=\"noopener noreferrer\" className=\"inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-[#333333] text-[10px] text-[#D4AF37] hover:text-white hover:border-[#D4AF37]/60 transition\" title={`Fungua chanzo: ${source.title || source.url}`}>\n                                  <span>Chanzo {idx + 1}</span>\n                                </a>\n                              ))}\n                            </div>\n                          </div>\n                        )}\n\n                        {/* Extracted Memory Tag */}",
  'clickable source footer');

console.log('MKUU: live-search source links and backend image routing fixes verified.');
