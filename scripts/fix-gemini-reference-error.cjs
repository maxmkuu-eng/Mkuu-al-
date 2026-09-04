const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-REF] server.ts not found.');

let source = fs.readFileSync(target, 'utf8');
const marker = '// [MKUU-GEMINI-REF-FALLBACK]';
if (source.includes(marker)) {
  console.log('[GEMINI-REF] Fallback already installed.');
  process.exit(0);
}

const helper = `${marker}\nasync function directGeminiReferenceFallback(req:any): Promise<any> {\n  const key = process.env.GEMINI_API_KEY;\n  if (!key) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');\n  const body = req.body || {};\n  const history = Array.isArray(body.conversationHistory) ? body.conversationHistory.slice(-12) : [];\n  const contents = history.filter((h:any) => h && h.content).map((h:any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: String(h.content) }] }));\n  contents.push({ role: 'user', parts: [{ text: String(body.message || '') }] });\n  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },\n    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2048 } }),\n  });\n  const raw = await r.text();\n  let data:any = {}; try { data = JSON.parse(raw); } catch {}\n  if (!r.ok) throw new Error('Gemini REST HTTP ' + r.status + ': ' + (data?.error?.message || raw || 'Unknown Gemini error'));\n  const text = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts.map((p:any) => p?.text || '').join('') : '';\n  if (!text.trim()) throw new Error('Gemini REST returned an empty response.');\n  return { reply: text, cleanSpeechText: text.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', latencyMs: 0 };\n}\n`;

const anchor = '  const processChatRequest = async (req:any) => {';
if (!source.includes(anchor)) throw new Error('[GEMINI-REF] processChatRequest anchor not found.');
source = source.replace(anchor, helper + '\n' + anchor);

const old = "catch(error:any){const raw=String(error?.message||error||'Google Gemini API Error');const m=raw.match(/(?:HTTP|status|code)[\\s:=]+(400|401|403|404|409|429|500|502|503|504)\\b/i);const code=m?Number(m[1]):0;const isExa=/LIVE_SEARCH_UNAVAILABLE|EXA_SEARCH_/i.test(raw);const type=isExa?'EXA_UNAVAILABLE':code===401||/authentication|api key|invalid.*key|unauthorized/i.test(raw)?'GEMINI_AUTHENTICATION_ERROR':code===403||/permission|forbidden|access denied/i.test(raw)?'GEMINI_PERMISSION_ERROR':code===404||/model.*not found|not found/i.test(raw)?'GEMINI_MODEL_ERROR':code===429||/RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(raw)?'GEMINI_RATE_LIMIT_ERROR':code>=500?'GEMINI_SERVER_ERROR':'GEMINI_REQUEST_ERROR';console.error(`[MKUU-BACKEND] [${type}] ${raw}`);res.status(code>=400&&code<600?code:503).json({error:type,message:raw,detail:raw,aiProvider:isExa?'Exa Live Search':AI_PROVIDER,chatModel:isExa?'Exa':PERSONAL_CHAT_MODEL,timestamp:new Date().toISOString()});}"
const replacement = "catch(error:any){const raw=String(error?.message||error||'Google Gemini API Error');console.error('[MKUU-BACKEND] Chat API Error:',raw,error?.stack||'');if(/(?:ReferenceError|is not defined)/i.test(raw)){try{const fallback=await directGeminiReferenceFallback(req);return res.status(200).json(fallback);}catch(fallbackError:any){console.error('[MKUU-BACKEND] Reference fallback failed:',fallbackError?.stack||fallbackError);}}const m=raw.match(/(?:HTTP|status|code)[\\s:=]+(400|401|403|404|409|429|500|502|503|504)\\b/i);const code=m?Number(m[1]):0;const isExa=/LIVE_SEARCH_UNAVAILABLE|EXA_SEARCH_/i.test(raw);const type=isExa?'EXA_UNAVAILABLE':code===401||/authentication|api key|invalid.*key|unauthorized/i.test(raw)?'GEMINI_AUTHENTICATION_ERROR':code===403||/permission|forbidden|access denied/i.test(raw)?'GEMINI_PERMISSION_ERROR':code===404||/model.*not found|not found/i.test(raw)?'GEMINI_MODEL_ERROR':code===429||/RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(raw)?'GEMINI_RATE_LIMIT_ERROR':code>=500?'GEMINI_SERVER_ERROR':'GEMINI_REQUEST_ERROR';res.status(code>=400&&code<600?code:503).json({error:type,message:raw,detail:raw,aiProvider:isExa?'Exa Live Search':AI_PROVIDER,chatModel:isExa?'Exa':PERSONAL_CHAT_MODEL,timestamp:new Date().toISOString()});}"
if (!source.includes(old)) throw new Error('[GEMINI-REF] Expected chat error handler not found.');
source = source.replace(old, replacement);
fs.writeFileSync(target, source, 'utf8');
console.log('[GEMINI-REF] Installed defensive direct Gemini 3.7 REST fallback for ReferenceError runtime failures.');
