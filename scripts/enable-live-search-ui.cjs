const fs = require('node:fs');
const path = require('node:path');

function patch(filePath, replacements) {
  const fullPath = path.join(process.cwd(), filePath);
  let source = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) {
      throw new Error(`MKUU patch target not found in ${filePath}: ${from.slice(0, 120)}`);
    }
    source = source.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(fullPath, source);
}

patch('server.ts', [
  [
    "import { searchWithTavily } from './server/tavilySearch.js';",
    "import { searchWithTavily, getLastTavilySources } from './server/tavilySearch.js';",
  ],
  [
    "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});",
    "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments}); const webSources=currentFactQuery?getLastTavilySources():[];",
  ],
  [
    "const a={id:`msg_${Date.now()}_a`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)};",
    "const a={id:`msg_${Date.now()}_a`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,webSources,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)};",
  ],
  [
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
  ],
]);

patch('src/services/aiEngine.ts', [
  [
    "import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';",
    "import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile, WebSource } from '../types';",
  ],
  [
    "  generatedFiles?: GeneratedFileSummary[];\n  engineUsed:",
    "  generatedFiles?: GeneratedFileSummary[];\n  webSources?: WebSource[];\n  engineUsed:",
  ],
  [
    "    generatedFiles: serverRes.generatedFiles,\n    engineUsed: 'server',",
    "    generatedFiles: serverRes.generatedFiles,\n    webSources: serverRes.webSources,\n    engineUsed: 'server',",
  ],
  [
    "  let reply = '';\n  emitStream('', false);",
    "  let reply = '';\n  let webSources: WebSource[] = [];\n  emitStream('', false);",
  ],
  [
    "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
    "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done' && Array.isArray(payload.webSources)) webSources = payload.webSources;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
  ],
  [
    "  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
    "  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), webSources, engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
  ],
]);

patch('src/components/ChatView.tsx', [
  [
    "                      {/* Footer Controls for AI Message */}",
    `                      {msg.webSources && msg.webSources.length > 0 && (\n                        <div className="mt-3 pt-2.5 border-t border-[#222222] w-full flex flex-col items-end not-italic font-sans">\n                          <div className="text-[10px] uppercase tracking-wider text-[#777777] mb-1.5">Vyanzo vya taarifa</div>\n                          <div className="flex flex-wrap justify-end gap-1.5 max-w-full">\n                            {msg.webSources.map((source, idx) => (\n                              <a\n                                key={idx}\n                                href={source.url}\n                                target="_blank"\n                                rel="noopener noreferrer"\n                                className="inline-flex max-w-[260px] items-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-2 py-1 text-[10px] font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/15 hover:text-[#F5F2ED] transition"\n                                title={source.url}\n                              >\n                                <span className="truncate">{source.title || source.url}</span>\n                              </a>\n                            ))}\n                          </div>\n                        </div>\n                      )}\n\n                      {/* Footer Controls for AI Message */}`,
  ],
]);

console.log('MKUU: live-search source footer + standings safeguards enabled.');
