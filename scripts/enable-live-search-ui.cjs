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

// Pass verified Tavily source metadata through the API response and persist it
// with the assistant message. Only current-information requests get sources.
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

// Carry source metadata through the browser chat engine.
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
]);

// Render source links at the bottom-right of each live-search answer.
patch('src/components/ChatView.tsx', [
  [
    "                      {/* Footer Controls for AI Message */}",
    `                      {msg.webSources && msg.webSources.length > 0 && (\n                        <div className="mt-3 pt-2.5 border-t border-[#222222] w-full flex flex-col items-end not-italic font-sans">\n                          <div className="text-[10px] uppercase tracking-wider text-[#777777] mb-1.5">Vyanzo vya taarifa</div>\n                          <div className="flex flex-wrap justify-end gap-1.5 max-w-full">\n                            {msg.webSources.map((source, idx) => (\n                              <a\n                                key={idx}\n                                href={source.url}\n                                target="_blank"\n                                rel="noopener noreferrer"\n                                className="inline-flex max-w-[260px] items-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-2 py-1 text-[10px] font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/15 hover:text-[#F5F2ED] transition"\n                                title={source.url}\n                              >\n                                <span className="truncate">{source.title || source.url}</span>\n                              </a>\n                            ))}\n                          </div>\n                        </div>\n                      )}\n\n                      {/* Footer Controls for AI Message */}`,
  ],
]);

console.log('MKUU: live-search source footer + standings safeguards enabled.');
