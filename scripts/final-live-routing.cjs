const fs = require('fs');
const path = require('path');

const root = process.cwd();

// SOURCE-OF-TRUTH ROUTING: live/current queries MUST bypass any stored Gemini key.
// This runs last in the build so no earlier compatibility patch can undo it.
const aiPath = path.join(root, 'src/services/aiEngine.ts');
let ai = fs.readFileSync(aiPath, 'utf8');

// Harden the direct Gemini function itself: even if another caller reaches it,
// a live query is never allowed to use Gemini.
const directStart = ai.indexOf('async function callDirectGemini(');
if (directStart >= 0) {
  const bodyStart = ai.indexOf('{', directStart);
  const guardText = "if(needsLiveSearch(params.message))return callNativeServerChat(params);";
  if (bodyStart >= 0 && !ai.slice(bodyStart, bodyStart + 500).includes(guardText)) {
    ai = ai.slice(0, bodyStart + 1) + guardText + ai.slice(bodyStart + 1);
  }
}

// Most important fix: route live requests BEFORE reading/using the local Gemini key.
// This is what makes EXA-only routing real in the Android APK, not just a prompt rule.
const execStart = ai.indexOf('export async function executeMkuuChat(');
if (execStart < 0) throw new Error('[MKUU] FINAL LIVE ROUTING: executeMkuuChat not found');
const execBrace = ai.indexOf('{', execStart);
if (execBrace < 0) throw new Error('[MKUU] FINAL LIVE ROUTING: executeMkuuChat body not found');
let depth = 0, end = -1;
for (let i = execBrace; i < ai.length; i++) {
  if (ai[i] === '{') depth++;
  else if (ai[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('[MKUU] FINAL LIVE ROUTING: executeMkuuChat boundary not found');
const executeFn = `export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{const smsCommand=await handleDirectSmsCommand(params);if(smsCommand)return smsCommand;if(needsImageRoute(params))return callImageStudio(params);if(needsLiveSearch(params.message))return callNativeServerChat(params);const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);if(needsArtifactRoute(params)){const serverRes=await apiFetch<any>('/api/agent',{method:'POST',signal:params.signal,body:JSON.stringify({conversationId:params.conversationId,message:params.message,isVoice:params.isVoice,attachments:params.attachments,conversationHistory:(params.conversationHistory||[]).slice(-10),people:params.people||[]})});if(serverRes&&(serverRes.reply||serverRes.success))return{reply:serverRes.reply||'',cleanSpeechText:serverRes.cleanSpeechText||serverRes.reply||'',memoriesExtracted:serverRes.memoriesExtracted,peopleRecognized:serverRes.peopleRecognized,generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:serverRes.aiProvider||'Google Gemini',chatModel:serverRes.chatModel||'gemini-3.7-flash',intent:serverRes.intent};throw new MkuuApiError({code:'BACKEND_UNREACHABLE',userMessage:'SEVA YA MKUU HAIPATIKANI\\nTafadhali jaribu tena.',technicalDetails:'Empty Universal Agent response payload',targetUrl:'/api/agent'});}return streamServerChat(params);}`;
ai = ai.slice(0, execStart) + executeFn + ai.slice(end);
fs.writeFileSync(aiPath, ai);

// Backend: live/current/sports/news queries go directly to Exa. Gemini remains
// available only for ordinary non-live chat.
const serverPath = path.join(root, 'server.ts');
let server = fs.readFileSync(serverPath, 'utf8');
const exaImport = "import { processExaLiveSearch } from './server/exaLiveSearch.js';";
if (!server.includes(exaImport)) {
  const anchor = "import { universalAgent } from './server/agentEngine.js';";
  if (!server.includes(anchor)) throw new Error('[MKUU] FINAL LIVE ROUTING: server import anchor not found');
  server = server.replace(anchor, `${anchor}\n${exaImport}`);
}

// Replace the old Gemini call in the /api/chat handler with Exa-only routing.
const oldResult = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
const exaResult = "const result=currentFactQuery ? await processExaLiveSearch(message) : await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
if (server.includes(oldResult)) server = server.replace(oldResult, exaResult);

// Expand live intent detection, including relative dates and common sports terms.
const regexLine = /const currentFactQuery = .*?\.test\(lowerMessage\);/s;
if (regexLine.test(server)) {
  server = server.replace(regexLine, "const currentFactQuery = /\\b(waziri mkuu|rais wa|makamu wa rais|kiongozi wa sasa|mkuu wa nchi|meya wa|mkuu wa|mkurugenzi wa|mwanasiasa|current|latest|sasa|wa sasa|leo|jana|juzi|kesho|today|yesterday|tomorrow|hivi punde|habari mpya|habari za leo|breaking|bei ya|thamani ya|exchange rate|rate ya|matokeo ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda|mechi|mchezo|anacheza|amecheza|mpinzani|opponent|fixture|score|live score|sports|soka|football|yanga|simba|azam|pamba jiji|coastal union|jkt tanzania|namungo|mashujaa|kagera sugar|champions league|caf|news)\\b/i.test(lowerMessage);");
}
fs.writeFileSync(serverPath, server);

console.log('[MKUU] HARD FINAL ROUTING: LIVE/WEB/CURRENT/SPORTS/NEWS = EXA ONLY; Gemini = NORMAL CHAT ONLY.');
