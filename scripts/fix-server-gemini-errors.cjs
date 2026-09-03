const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server.ts');
if (!fs.existsSync(target)) {
  console.warn('[GEMINI-SERVER] server.ts not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

// Render runs server.ts (not api/index.ts), so production errors must be fixed here.
source = source.replace(
  "app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], async (_req,res)=>{ const health=await geminiService.getHealthStatus(); res.json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs}); });",
  "app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], async (_req,res)=>{ try { const health=await geminiService.getHealthStatus(); const connected=health.status==='connected'; res.status(connected?200:503).json({status:connected?'ok':'degraded',service:'MKUU Backend',gemini:health.status,chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs,...(health.error?{error:health.error}: {})}); } catch(e:any) { console.error('[MKUU-BACKEND] Health check failed:',e); res.status(503).json({status:'degraded',service:'MKUU Backend',gemini:'unavailable',chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,aiProvider:AI_PROVIDER,error:e?.message||String(e)}); } });"
);

source = source.replace(
  "app.post(['/api/chat','/api/chat/'],async(req,res)=>{try{res.json(await processChatRequest(req));}catch(error:any){console.error('[MKUU-BACKEND] Chat API Error:',error);res.status(503).json({error:'GEMINI_UNAVAILABLE',message:error.message||'Google Gemini API Error',aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});",
  "app.post(['/api/chat','/api/chat/'],async(req,res)=>{try{res.json(await processChatRequest(req));}catch(error:any){const raw=String(error?.message||error||'Google Gemini API Error');const m=raw.match(/(?:HTTP|status|code)[\\s:=]+(400|401|403|404|409|429|500|502|503|504)\\b/i);const code=m?Number(m[1]):0;const type=code===401||/authentication|api key|invalid.*key|unauthorized/i.test(raw)?'GEMINI_AUTHENTICATION_ERROR':code===403||/permission|forbidden|access denied/i.test(raw)?'GEMINI_PERMISSION_ERROR':code===404||/model.*not found|not found/i.test(raw)?'GEMINI_MODEL_ERROR':code===429||/RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(raw)?'GEMINI_RATE_LIMIT_ERROR':code>=500?'GEMINI_SERVER_ERROR':'GEMINI_REQUEST_ERROR';console.error(`[MKUU-BACKEND] [${type}] ${raw}`);res.status(code>=400&&code<600?code:503).json({error:type,message:raw,detail:raw,aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,timestamp:new Date().toISOString()});}});"
);

source = source.replace(
  "app.post('/api/agent',async(req,res)=>{try{const {message='',conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};if(!message&&!attachments.length)throw new Error('Ujumbe au kiambatisho kinahitajika');res.json({success:true,...await universalAgent.execute({userId:DEFAULT_USER_ID,message,conversationHistory,isVoice,attachments,people})});}catch(e:any){res.status(503).json({success:false,error:'GEMINI_UNAVAILABLE',message:e.message,aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});",
  "app.post('/api/agent',async(req,res)=>{try{const {message='',conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};if(!message&&!attachments.length)throw new Error('Ujumbe au kiambatisho kinahitajika');res.json({success:true,...await universalAgent.execute({userId:DEFAULT_USER_ID,message,conversationHistory,isVoice,attachments,people})});}catch(e:any){const raw=String(e?.message||e||'Google Gemini API Error');console.error('[MKUU-BACKEND] Agent API Error:',raw);res.status(503).json({success:false,error:'GEMINI_REQUEST_ERROR',message:raw,detail:raw,aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,timestamp:new Date().toISOString()});}});"
);

if (source !== original) {
  fs.writeFileSync(target, source);
  console.log('[GEMINI-SERVER] Production server error handling patched.');
} else {
  console.log('[GEMINI-SERVER] Production server already patched; no changes needed.');
}
