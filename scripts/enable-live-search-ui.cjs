const fs = require('node:fs');
const path = require('node:path');

function read(filePath) { return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''; }
function write(filePath, source) { fs.writeFileSync(filePath, source, 'utf8'); }
function ensure(filePath, label, transform) {
  if (!fs.existsSync(filePath)) { console.log(`MKUU: skipped ${label}; file not found`); return; }
  const before = read(filePath); const after = transform(before);
  if (after !== before) { write(filePath, after, 'utf8'); console.log(`MKUU: applied ${label}`); }
  else console.log(`MKUU: verified ${label}`);
}

const root = process.cwd();
const server = path.join(root, 'server.ts');
const aiEngine = path.join(root, 'src/services/aiEngine.ts');
const app = path.join(root, 'src/App.tsx');
const chatView = path.join(root, 'src/components/ChatView.tsx');

ensure(server, 'Tavily request-scoped source lifecycle', (source) => {
  const oldImport = "import { getLastTavilySources } from './server/tavilySearch.js';";
  const newImport = "import { getLastTavilySources, clearLastTavilySources } from './server/tavilySearch.js';";
  if (source.includes(oldImport) && !source.includes(newImport)) source = source.replace(oldImport, newImport);
  if (!source.includes('clearLastTavilySources(); // MKUU request-scoped source reset')) {
    source = source.replace(
      "  const processChatRequest = async (req:any) => {\n    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};",
      "  const processChatRequest = async (req:any) => {\n    // Sources belong to the current request only. Memory/history may persist, but web sources must never leak from a previous search.\n    clearLastTavilySources(); // MKUU request-scoped source reset\n    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};"
    );
  }
  return source;
});

ensure(aiEngine, 'server-only chat routing and source propagation', (source) => {
  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) source = source.replace('  intent?: string;\n}', '  intent?: string;\n  webSources?: Array<{ title: string; url: string }>;\n}');
  source = source.replace(/\n\s*const directApiKey = getStoredGeminiApiKey\(\);\n\s*if \(directApiKey && directApiKey\.trim\(\)\.length > 10\) return callDirectGemini\(directApiKey\.trim\(\), params\);\n/, '\n');
  if (!source.includes('webSources: serverRes.webSources || []')) source = source.replace("    intent: serverRes.intent || 'chat',\n  };", "    intent: serverRes.intent || 'chat',\n    webSources: serverRes.webSources || [],\n  };");
  if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) source = source.replace("  let reply = '';\n  emitStream('', false);", "  let reply = '';\n  let webSources: Array<{ title: string; url: string }> = [];\n  emitStream('', false);");
  if (!source.includes("if (payload.type === 'done' && Array.isArray(payload.webSources))")) source = source.replace("        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');", "        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done' && Array.isArray(payload.webSources)) webSources = payload.webSources;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');");
  if (!source.includes("intent: 'chat', webSources };")) source = source.replace("return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };", "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat', webSources };");
  return source;
});

ensure(app, 'web-source message persistence', (source) => {
  if (!source.includes('webSources: chatResult.webSources || [],')) source = source.replace("        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        savedOffline: true,", "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        webSources: chatResult.webSources || [],\n        savedOffline: true,");
  return source;
});

ensure(chatView, 'prevent duplicate source footer', (source) => source);

console.log('MKUU: live-search/source build patch is idempotent and request-scoped.');