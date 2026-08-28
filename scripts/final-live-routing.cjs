const fs = require('fs');
const path = require('path');

const root = process.cwd();

// FINAL CLIENT GUARD: this runs after every other build-time patch, so a later
// script cannot re-enable direct Gemini for a live/current query.
const aiPath = path.join(root, 'src/services/aiEngine.ts');
let ai = fs.readFileSync(aiPath, 'utf8');
const guard = "if(needsLiveSearch(params.message)) return callNativeServerChat(params);";
const direct = 'const directApiKey=getStoredGeminiApiKey();';
if (!ai.includes(guard)) {
  if (!ai.includes(direct)) throw new Error('[MKUU] FINAL LIVE ROUTING: direct Gemini anchor not found');
  ai = ai.replace(direct, `${guard}\n${direct}`);
}
const directFn = 'async function callDirectGemini(apiKey:string,params:ChatEngineParams):Promise<ChatEngineResult>{';
if (!ai.includes('if(liveSearchRequired)return callNativeServerChat(params);')) {
  if (!ai.includes(directFn)) throw new Error('[MKUU] FINAL LIVE ROUTING: callDirectGemini anchor not found');
  ai = ai.replace(directFn, `${directFn}if(needsLiveSearch(params.message))return callNativeServerChat(params);`);
}
fs.writeFileSync(aiPath, ai);

// FINAL BACKEND GUARD: /api/chat uses Exa directly for live/current/sports/news.
// Gemini remains available for normal non-live chat only.
const serverPath = path.join(root, 'server.ts');
let server = fs.readFileSync(serverPath, 'utf8');
const exaImport = "import { processExaLiveSearch } from './server/exaLiveSearch.js';";
if (!server.includes(exaImport)) {
  const anchor = "import { universalAgent } from './server/agentEngine.js';";
  if (!server.includes(anchor)) throw new Error('[MKUU] FINAL LIVE ROUTING: server import anchor not found');
  server = server.replace(anchor, `${anchor}\n${exaImport}`);
}
const oldResult = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
const newResult = "const result=currentFactQuery ? await processExaLiveSearch(message) : await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
if (server.includes(oldResult)) server = server.replace(oldResult, newResult);
const oldRegex = "const currentFactQuery = /\\b(waziri mkuu|rais wa|makamu wa rais|kiongozi wa sasa|mkuu wa nchi|meya wa|mkuu wa|mkurugenzi wa|mwanasiasa|current|latest|sasa|wa sasa|leo|hivi punde|habari mpya|habari za leo|bei ya|thamani ya|exchange rate|rate ya|matokeo ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda)\\b/i.test(lowerMessage);";
const newRegex = "const currentFactQuery = /\\b(waziri mkuu|rais wa|makamu wa rais|kiongozi wa sasa|mkuu wa nchi|meya wa|mkuu wa|mkurugenzi wa|mwanasiasa|current|latest|sasa|wa sasa|leo|jana|juzi|kesho|today|yesterday|tomorrow|hivi punde|habari mpya|habari za leo|breaking|bei ya|thamani ya|exchange rate|rate ya|matokeo ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda|mechi|mchezo|anacheza|amecheza|mpinzani|opponent|fixture|score|live score|sports|soka|football|yanga|simba|azam|pamba jiji|coastal union|jkt tanzania|namungo|mashujaa|kagera sugar|champions league|caf|news)\\b/i.test(lowerMessage);";
if (server.includes(oldRegex)) server = server.replace(oldRegex, newRegex);
fs.writeFileSync(serverPath, server);
console.log('[MKUU] FINAL: Live/Web Search = EXA ONLY. Gemini remains normal-chat only.');
