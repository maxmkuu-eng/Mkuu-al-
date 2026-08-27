const fs = require('fs');
const path = require('path');
const root = process.cwd();
function patch(file, fn) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(p, after);
}

// Tanzania clock: always render message timestamps in Africa/Dar_es_Salaam.
patch('src/components/ChatView.tsx', s => s.replace(
  /new Date\(msg\.timestamp\)\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\)/g,
  "new Date(msg.timestamp).toLocaleTimeString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', minute: '2-digit' })"
));

// Full logo: never crop it in the mobile/header branding.
patch('src/components/Navigation.tsx', s => {
  if (!s.includes("import mkuuLogo from '../assets/mkuu-ai-logo.jpg';")) {
    s = s.replace("import { ActiveTab, UserProfile } from '../types';", "import { ActiveTab, UserProfile } from '../types';\nimport mkuuLogo from '../assets/mkuu-ai-logo.jpg';");
  }
  s = s.replace(
    /<div className="w-8 h-8 rounded-lg bg-\[#D4AF37\] flex items-center justify-center text-black font-bold"><Crown className="w-4 h-4"\/><\/div>/,
    '<img src={mkuuLogo} alt="MKUU AI" className="w-10 h-10 rounded-xl object-contain bg-black border border-[#D4AF37]/40 shadow-lg flex-shrink-0" />'
  );
  return s.replace(/object-cover/g, 'object-contain');
});

// Exa citations are structured data, not part of the answer text.
patch('server/exaSearch.ts', s => {
  s = s.replace('export async function searchWithExa(query: string): Promise<string> {', 'export async function searchWithExa(query: string): Promise<{ answer: string; citations: Array<{ title: string; url: string }> }> {');
  const start = s.indexOf('  const citations = Array.isArray(data.citations) ? data.citations : [];');
  const end = s.indexOf('\n}', start);
  if (start >= 0 && end > start) {
    const block = "  const citations = Array.isArray(data.citations) ? data.citations : [];\n  const structuredSources = citations.filter((item) => item?.url).slice(0, 8).map((item) => ({ title: (item.title || item.url).trim(), url: item.url.trim() }));\n  return { answer, citations: structuredSources };";
    s = s.slice(0, start) + block + s.slice(end);
  }
  return s;
});

// Exa live-search service: expose webSources and enforce Tanzania time/date.
patch('server/geminiService.ts', s => {
  if (!s.includes('webSources: Array<{ title: string; url: string }>')) {
    s = s.replace('  generatedFiles: GeneratedFileSummary[];\n  aiProvider:', '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:');
  }
  if (!s.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
    s = s.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];");
  }
  s = s.replace('aiReplyText = await searchWithExa(searchQuery);', 'const exaResult = await searchWithExa(searchQuery);\n        aiReplyText = exaResult.answer;\n        webSources = exaResult.citations;');
  if (!s.includes('      webSources,\n      aiProvider:')) {
    s = s.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
  }
  const marker = '    const generatedFilesList: GeneratedFileSummary[] = [];';
  if (s.includes(marker) && !s.includes('[TIME_GUARD_V2]')) {
    const guard = [
      "    const isTimeOrDateQuestion = /\\b(saa ngapi|saa gani|time now|current time|what time is it|leo tarehe ngapi|tarehe ya leo|date today|today's date|today date)\\b/i.test(String(message || ''));",
      "    if (isTimeOrDateQuestion) {",
      "      const t = getCurrentTanzaniaTimeContext();",
      "      const [hh, mm] = t.timeString.split(':').map(Number);",
      "      const hour12 = ((hh % 12) || 12);",
      "      const period = hh >= 22 || hh < 5 ? 'usiku' : hh >= 16 ? 'jioni' : hh >= 12 ? 'mchana' : 'asubuhi';",
      "      const isClock = /\\b(saa ngapi|saa gani|time now|current time|what time is it)\\b/i.test(String(message || ''));",
      "      const reply = isClock ? 'Kwa sasa ni saa ' + hour12 + ':' + String(mm).padStart(2, '0') + ' ' + period + ', kwa saa za Tanzania (UTC+3).' : 'Leo ni ' + t.dayOfWeek + ', ' + t.dateString + ', kwa saa za Tanzania.';",
      "      return { reply, cleanSpeechText: reply, memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [], peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [], generatedFiles: [], webSources: [], aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, latencyMs: Date.now() - startTime };",
      "    }",
      "    // [TIME_GUARD_V2]"
    ].join('\n') + '\n';
    s = s.replace(marker, marker + '\n' + guard);
  }
  return s;
});

// API/client transport for structured sources.
patch('server.ts', s => s.replace(
  'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};',
  'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};'
));

patch('src/services/aiEngine.ts', s => {
  if (!s.includes('WebSource')) s = s.replace("import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';", "import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile, WebSource } from '../types';");
  s = s.replace('generatedFiles?:GeneratedFileSummary[]; engineUsed', 'generatedFiles?:GeneratedFileSummary[]; webSources?:WebSource[]; engineUsed');
  s = s.replace("generatedFiles:serverRes.generatedFiles,engineUsed:'server'", "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server'");
  s = s.replace("let buffer='';let reply='';emitStream", "let buffer='';let reply='';let webSources:any[]=[];let streamProvider='Google Gemini';let streamModel='gemini-3.7-flash';emitStream");
  s = s.replace("if(payload.type==='error')throw new Error(payload.message||'Streaming error');", "if(payload.type==='done'){webSources=Array.isArray(payload.webSources)?payload.webSources:[];streamProvider=payload.aiProvider||streamProvider;streamModel=payload.chatModel||streamModel;}if(payload.type==='error')throw new Error(payload.message||'Streaming error');");
  s = s.replace("aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'", "webSources,aiProvider:streamProvider,chatModel:streamModel,intent:'chat'");
  return s;
});

patch('src/App.tsx', s => s.replace(
  'generatedFiles: processedFiles,\n        memoryExtracted:',
  'generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:'
));

console.log('[MKUU] V2 time guard + structured Exa sources + full logo fix applied.');
