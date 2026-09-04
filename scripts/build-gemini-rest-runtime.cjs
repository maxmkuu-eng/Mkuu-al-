const fs=require('fs');
const path=require('path');
const target=path.join(process.cwd(),'server','geminiService.ts');
if(!fs.existsSync(target)) throw new Error('[GEMINI-REST] server/geminiService.ts not found.');
let s=fs.readFileSync(target,'utf8');

// This build step must be safe to run repeatedly. The source has been through
// several idempotent live-search patches, so do not depend on one exact layout.
s=s.replace(/import\s*\{\s*GoogleGenAI\s*\}\s*from\s*['"]@google\/genai['"];?\s*/g,'');
s=s.replace(/import\s*\{\s*searchWithTavily\s*\}\s*from\s*['"]\.\/tavilySearch\.js['"];?\s*/g,'');
s=s.replace(/private\s+aiClient\s*:\s*GoogleGenAI\s*\|\s*null\s*=\s*null;?\s*/g,'');

// Remove any legacy GoogleGenAI client getter regardless of whitespace/minification.
s=s.replace(/\s*private\s+getClient\(\)\s*:\s*GoogleGenAI\s*\{[\s\S]*?\}\s*(?=public\s+async\s+getHealthStatus)/m,'\n');

s=s.replace(/export const PERSONAL_CHAT_MODEL\s*=\s*['"]gemini-[^'"]+['"];?/,"export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s=s.replace(/export const LIVE_SEARCH_MODEL\s*=\s*['"][^'"]+['"];?/,"export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
s=s.replace(/export const CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\];/,"export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

// Replace health check with direct Gemini REST.
const hs=s.indexOf('  public async getHealthStatus('),ps=s.indexOf('  public async processChat(',hs);
if(hs<0||ps<=hs)throw new Error('[GEMINI-REST] Health/process boundaries not found.');
const health=`  public async getHealthStatus(): Promise<{ aiProvider: string; chatModel: string; backend: string; status: 'connected' | 'unavailable'; latencyMs?: number; error?: string }> {\n    const started=Date.now(); const key=process.env.GEMINI_API_KEY;\n    if(!key)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:'GEMINI_API_KEY is not configured on MKUU Backend.'};\n    try{const r=await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${PERSONAL_CHAT_MODEL}:generateContent\`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Ping status check'}]}]})});const raw=await r.text();if(!r.ok){let m=raw;try{m=JSON.parse(raw)?.error?.message||raw;}catch{}return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:m};}return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected',latencyMs:Date.now()-started};}catch(e:any){return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:String(e?.message||e)};}\n  }\n\n`;
s=s.slice(0,hs)+health+s.slice(ps);

// Replace the old SDK fallback executor with one direct REST implementation.
const ms=s.indexOf('  private async executeGeminiCallWithFallback('),me=s.indexOf('  private buildSystemPrompt(',ms);
if(ms<0||me<=ms)throw new Error('[GEMINI-REST] Gemini method boundaries not found.');
const method=`  private async executeGeminiCallWithFallback(params:{contents:any;config?:any;preferredModel?:string}):Promise<string>{\n    const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');\n    const model=PERSONAL_CHAT_MODEL,cfg:any=params.config||{},body:any={contents:params.contents};\n    if(cfg.systemInstruction)body.systemInstruction=typeof cfg.systemInstruction==='string'?{parts:[{text:cfg.systemInstruction}]}:cfg.systemInstruction;\n    const gc:any={};for(const k of ['temperature','topP','topK','maxOutputTokens','candidateCount','stopSequences'])if(cfg[k]!==undefined)gc[k]=cfg[k];\n    if(cfg.thinkingConfig)gc.thinkingConfig=cfg.thinkingConfig;if(Object.keys(gc).length)body.generationConfig=gc;\n    console.log(\`[MKUU-BACKEND] [GEMINI_REST_REQUEST] model="\${model}"\`);\n    const r=await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});\n    const raw=await r.text();let data:any={};try{data=JSON.parse(raw);}catch{}\n    if(!r.ok)throw new Error(\`Gemini REST HTTP \${r.status}: \${data?.error?.message||raw||'Unknown Gemini error'}\`);\n    const parts=data?.candidates?.[0]?.content?.parts;const text=Array.isArray(parts)?parts.map((p:any)=>p?.text||'').join(''):'';\n    if(!text.trim())throw new Error('Gemini REST returned an empty response.');\n    console.log(\`[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model="\${model}"\`);return text;\n  }\n\n`;
s=s.slice(0,ms)+method+s.slice(me);

// Legacy live/Tavily code is no longer allowed in the backend. Later Exa
// patches own the live branch; remove the old Tavily branch if it is still present.
const liveStart=s.indexOf('    if(isSearchQuery){');
const fileIntentAfterLive=s.indexOf('    if(fileIntent){',Math.max(0,liveStart));
if(liveStart>=0&&fileIntentAfterLive>liveStart){
  const liveReplacement=`    if(isSearchQuery){\n      throw new Error('EXA_LIVE_PIPELINE_NOT_INSTALLED');\n    } else {\n      try{aiReplyText=await this.executeGeminiCallWithFallback({contents,config:generationConfig,preferredModel:PERSONAL_CHAT_MODEL});}catch(err:any){const errMsg=String(err?.message||err);console.error(\`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="\${errMsg}" latency=\${Date.now()-startTime}ms\`);const isRateLimit=errMsg.includes('429')||errMsg.includes('RESOURCE_EXHAUSTED')||errMsg.includes('quota')||errMsg.includes('Rate limit')||errMsg.includes('exceeded your current quota');if(isRateLimit)aiReplyText='Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';else throw new Error(\`Google Gemini API (\${PERSONAL_CHAT_MODEL}) Error: \${err?.message||'Huduma haikupatikana kwa sasa'}\`);}}\n    }\n`;
  s=s.slice(0,liveStart)+liveReplacement+s.slice(fileIntentAfterLive);
}

const bad=['@google/genai','GoogleGenAI','.models.generateContent','private getClient():','searchWithTavily'];
const left=bad.filter(x=>s.includes(x));
if(left.length)throw new Error('[GEMINI-REST] Forbidden references remain: '+left.join(', '));
if(!s.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';"))throw new Error('[GEMINI-REST] Gemini 3.7 Flash missing.');
fs.writeFileSync(target,s,'utf8');
console.log('[GEMINI-REST] OK: clean Gemini 3.7 Flash REST runtime installed.');
