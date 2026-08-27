const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
const patch = (p, fn) => { const f = path.join(root, p); if (!fs.existsSync(f)) return; const before = fs.readFileSync(f, 'utf8'); const after = fn(before); if (after !== before) fs.writeFileSync(f, after); };

// 1) Never render message times in UTC. Tanzania is UTC+3.
patch('src/components/ChatView.tsx', (s) => s.replace(
  /new Date\(msg\.timestamp\)\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\)/g,
  "new Date(msg.timestamp).toLocaleTimeString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', minute: '2-digit' })"
));

// 2) Ensure the full MKUU logo is used without cropping in the mobile header/home header.
patch('src/components/Navigation.tsx', (s) => {
  if (!s.includes("import mkuuLogo from '../assets/mkuu-ai-logo.jpg';")) {
    s = s.replace("import { ActiveTab, UserProfile } from '../types';", "import { ActiveTab, UserProfile } from '../types';\nimport mkuuLogo from '../assets/mkuu-ai-logo.jpg';");
  }
  s = s.replace(
    /<div className="w-8 h-8 rounded-lg bg-\[#D4AF37\] flex items-center justify-center text-black font-bold"><Crown className="w-4 h-4"\/><\/div>/,
    '<img src={mkuuLogo} alt="MKUU AI" className="w-10 h-10 rounded-xl object-contain bg-black border border-[#D4AF37]/40 shadow-lg flex-shrink-0" />'
  );
  s = s.replace(/object-cover border border-\[#D4AF37\]\/40/g, 'object-contain bg-black border border-[#D4AF37]/40');
  return s;
});

// 3) Carry Exa citations as structured webSources instead of embedding "[1][2]..." in the answer.
patch('server/exaSearch.ts', (s) => {
  s = s.replace('export async function searchWithExa(query: string): Promise<string> {', 'export async function searchWithExa(query: string): Promise<{ answer: string; citations: Array<{ title: string; url: string }> }> {');
  const old = /\n  const citations = Array\.isArray\(data\.citations\)[\s\S]*?\n  return sources \? `\$\{answer\}\\n\\n### Sources\\n\$\{sources\}` : answer;\n/;
  const replacement = `\n  const citations = Array.isArray(data.citations) ? data.citations : [];\n  const structuredSources = citations\n    .filter((item) => item?.url)\n    .slice(0, 8)\n    .map((item) => ({ title: (item.title || item.url).trim(), url: item.url.trim() }));\n\n  return { answer, citations: structuredSources };\n`;
  if (old.test(s)) s = s.replace(old, replacement);
  return s;
});

// 4) Patch the Exa-generated Gemini service with a real webSources field and deterministic Tanzania time/date answers.
patch('server/geminiService.ts', (s) => {
  if (!s.includes('webSources: Array<{ title: string; url: string }>')) {
    s = s.replace('  generatedFiles: GeneratedFileSummary[];\n  aiProvider:', '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:');
  }
  if (!s.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
    s = s.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];");
  }
  s = s.replace('aiReplyText = await searchWithExa(searchQuery);', 'const exaResult = await searchWithExa(searchQuery);\n        aiReplyText = exaResult.answer;\n        webSources = exaResult.citations;');
  if (!s.includes('webSources,\n      aiProvider:')) {
    s = s.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
  }

  // Deterministic clock/date path: never let the model convert UTC to the wrong local hour.
  const marker = '    const generatedFilesList: GeneratedFileSummary[] = [];';
  if (s.includes(marker) && !s.includes('[TIME_GUARD]')) {
    const guard = `    const isTimeOrDateQuestion = /\\b(saa ngapi|saa gani|time now|current time|what time is it|leo tarehe ngapi|tarehe ya leo|date today|today's date|today date)\\b/i.test(String(message || ''));\n    if (isTimeOrDateQuestion) {\n      const t = getCurrentTanzaniaTimeContext();\n      const [hh, mm] = t.timeString.split(':').map(Number);\n      const hour12 = ((hh % 12) || 12);\n      const period = hh >= 22 || hh < 5 ? 'usiku' : hh >= 16 ? 'jioni' : hh >= 12 ? 'mchana' : 'asubuhi';\n      const reply = /\\b(saa ngapi|saa gani|time now|current time|what time is it)\\b/i.test(String(message || ''))\n        ? \\`Kwa sasa ni saa \\${hour12}:\\${String(mm).padStart(2, '0')} \\${period}, kwa saa za Tanzania (UTC+3).\\`\n        : \\`Leo ni \\${t.dayOfWeek}, \\${t.dateString}, kwa saa za Tanzania.\\`;\n      return { reply, cleanSpeechText: reply, memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [], peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [], generatedFiles: [], webSources: [], aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, latencyMs: Date.now() - startTime };\n    }\n    // [TIME_GUARD]\n`;
    s = s.replace(marker, marker + '\n' + guard);
  }

  // Strong prompt rule for all non-deterministic time/date answers.
  const oldRule = 'Kamwe usiseme kwamba huwezi kuona';
  if (s.includes(oldRule) && !s.includes('USITUMIE UTC KAMA MUDA WA MTUMIAJI')) {
    s = s.replace(oldRule, 'USITUMIE UTC KAMA MUDA WA MTUMIAJI. Muda wa mtumiaji ni Africa/Dar_es_Salaam (UTC+3). Usibadilishe saa ya Tanzania kwenda saa za UTC. ' + oldRule);
  }
  return s;
});

// 5) Pass structured sources through the backend API.
patch('server.ts', (s) => s.replace(
  'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};',
  'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};'
));

// 6) Preserve webSources in the client message model, including the SSE done event.
patch('src/services/aiEngine.ts', (s) => {
  if (!s.includes('WebSource')) s = s.replace("import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';", "import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile, WebSource } from '../types';");
  s = s.replace("generatedFiles?:GeneratedFileSummary[]; engineUsed", "generatedFiles?:GeneratedFileSummary[]; webSources?:WebSource[]; engineUsed");
  s = s.replace("generatedFiles:serverRes.generatedFiles,engineUsed:'server'", "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server'");
  s = s.replace("let buffer='';let reply='';emitStream", "let buffer='';let reply='';let webSources:any[]=[];let streamProvider='Google Gemini';let streamModel='gemini-3.7-flash';emitStream");
  s = s.replace("if(payload.type==='error')throw new Error(payload.message||'Streaming error');", "if(payload.type==='done'){webSources=Array.isArray(payload.webSources)?payload.webSources:[];streamProvider=payload.aiProvider||streamProvider;streamModel=payload.chatModel||streamModel;}if(payload.type==='error')throw new Error(payload.message||'Streaming error');");
  s = s.replace("aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'", "webSources,aiProvider:streamProvider,chatModel:streamModel,intent:'chat'");
  return s;
});

// 7) Persist the sources on the assistant message so fix-web-sources-ui can render them separately.
patch('src/App.tsx', (s) => s.replace(
  'generatedFiles: processedFiles,\n        memoryExtracted:',
  'generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:'
));

// 8) Make the existing branding images use contain, never cover, so the full logo remains visible.
patch('scripts/fix-branding.cjs', (s) => s.replace(/object-cover/g, 'object-contain'));

console.log('[MKUU] Tanzania time guard, structured Exa sources, separated source UI data, and full-logo contain mode applied.');
