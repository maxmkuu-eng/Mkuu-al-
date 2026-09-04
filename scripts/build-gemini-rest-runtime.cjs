const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-REST] server/geminiService.ts not found.');
let s = fs.readFileSync(target, 'utf8');

// Deterministic/idempotent normalization. Remove legacy members structurally.
s = s.replace(/import\s*\{\s*GoogleGenAI\s*\}\s*from\s*['"]@google\/genai['"];?\s*/g, '');
s = s.replace(/import\s*\{\s*searchWithTavily\s*\}\s*from\s*['"]\.\/tavilySearch\.js['"];?\s*/g, '');
s = s.replace(/\s*private\s+aiClient\s*:\s*GoogleGenAI\s*\|\s*null\s*=\s*null;?/g, '');

// Remove a class method by balancing its parameter list, TypeScript generic
// return type, and method body. This deliberately does NOT use "first {" because
// Promise<{...}> contains a brace before the actual method body.
function removeMethods(source, methodName) {
  const nameRe = new RegExp('(?:^|\\n)\\s*(?:public|private|protected)?\\s*(?:static\\s+)?(?:async\\s+)?' + methodName + '\\s*\\(', 'm');
  let out = source;
  while (true) {
    const m = nameRe.exec(out);
    if (!m) return out;

    const start = m.index;
    let i = m.index + m[0].length;
    let paren = 1;
    for (; i < out.length && paren > 0; i++) {
      if (out[i] === '(') paren++;
      else if (out[i] === ')') paren--;
    }
    if (paren !== 0) throw new Error('[GEMINI-REST] Could not close parameters for ' + methodName + '.');

    let angle = 0;
    let bodyStart = -1;
    for (; i < out.length; i++) {
      const ch = out[i];
      if (ch === '<') angle++;
      else if (ch === '>' && angle > 0) angle--;
      else if (ch === '{' && angle === 0) { bodyStart = i; break; }
      else if (ch === ';' && angle === 0) return out.slice(0, start) + out.slice(i + 1);
    }
    if (bodyStart < 0) throw new Error('[GEMINI-REST] Could not find body for ' + methodName + '.');

    let depth = 0;
    let bodyEnd = -1;
    let quote = null;
    for (i = bodyStart; i < out.length; i++) {
      const ch = out[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '`' || ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { bodyEnd = i + 1; break; }
    }
    if (bodyEnd < 0) throw new Error('[GEMINI-REST] Could not close body for ' + methodName + '.');
    out = out.slice(0, start) + '\n' + out.slice(bodyEnd);
  }
}

// Remove every previous generated/legacy member before installing exactly one.
s = removeMethods(s, 'getClient');
s = removeMethods(s, 'getHealthStatus');
s = removeMethods(s, 'executeGeminiCallWithFallback');

s = s.replace(/export\s+const\s+PERSONAL_CHAT_MODEL\s*=\s*['"][^'"]+['"]\s*;?/,
  "export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s = s.replace(/export\s+const\s+LIVE_SEARCH_MODEL\s*=\s*['"][^'"]+['"]\s*;?/,
  "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
s = s.replace(/export\s+const\s+CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\]\s*;?/,
  "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

const healthMethod = [
  "  public async getHealthStatus(): Promise<{ aiProvider:string; chatModel:string; backend:string; status:'connected'|'unavailable'; latencyMs?:number; error?:string }> {",
  '    const started=Date.now(); const key=process.env.GEMINI_API_KEY;',
  "    if(!key)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:'GEMINI_API_KEY is not configured on MKUU Backend.'};",
  '    try{',
  "      const url='https://generativelanguage.googleapis.com/v1beta/models/'+PERSONAL_CHAT_MODEL+':generateContent';",
  "      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Ping status check'}]}]})});",
  "      const raw=await r.text(); let m=raw; try{m=JSON.parse(raw)?.error?.message||raw;}catch{}",
  "      if(!r.ok)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:m};",
  "      return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected',latencyMs:Date.now()-started};",
  "    }catch(e){return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:String(e?.message||e)}}",
  '  }',
  ''
].join('\n');

const processPos = s.search(/\n\s{2}public\s+async\s+processChat\b/);
if (processPos < 0) throw new Error('[GEMINI-REST] processChat method not found; refusing unsafe build.');
s = s.slice(0, processPos) + '\n' + healthMethod + s.slice(processPos);

const restMethod = [
  '  private async executeGeminiCallWithFallback(params:{contents:any;config?:any;preferredModel?:string}):Promise<string>{',
  '    const key=process.env.GEMINI_API_KEY;',
  "    if(!key)throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');",
  '    const model=PERSONAL_CHAT_MODEL; const cfg:any=params.config||{}; const body:any={contents:params.contents};',
  "    if(cfg.systemInstruction)body.systemInstruction=typeof cfg.systemInstruction==='string'?{parts:[{text:cfg.systemInstruction}]}:cfg.systemInstruction;",
  "    const generationConfig:any={}; for(const k of ['temperature','topP','topK','maxOutputTokens','candidateCount','stopSequences'])if(cfg[k]!==undefined)generationConfig[k]=cfg[k];",
  "    if(cfg.thinkingConfig)generationConfig.thinkingConfig=cfg.thinkingConfig; if(Object.keys(generationConfig).length)body.generationConfig=generationConfig;",
  "    console.log('[MKUU-BACKEND] [GEMINI_REST_REQUEST] model=\"'+model+'\"');",
  "    const url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent';",
  "    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});",
  "    const raw=await r.text(); let data:any={}; try{data=JSON.parse(raw)}catch{}",
  "    if(!r.ok)throw new Error('Gemini REST HTTP '+r.status+': '+(data?.error?.message||raw||'Unknown Gemini error'));",
  "    const parts=data?.candidates?.[0]?.content?.parts; const text=Array.isArray(parts)?parts.map((p:any)=>p?.text||'').join(''):'';",
  "    if(!text.trim())throw new Error('Gemini REST returned an empty response.');",
  "    console.log('[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model=\"'+model+'\"'); return text;",
  '  }',
  ''
].join('\n');

const buildPos = s.search(/\n\s{2}private\s+buildSystemPrompt\b/);
if (buildPos < 0) throw new Error('[GEMINI-REST] buildSystemPrompt boundary not found; refusing unsafe build.');
s = s.slice(0, buildPos) + '\n' + restMethod + s.slice(buildPos);

// Previous live-search scripts own the live branch. Only normalize stale names
// if they are still present; never inject an undefined provider here.
s = s.replace(/\bsearchWithTavily\s*\(/g, 'searchWithExa(');
s = s.replace(/\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/g, 'this.executeGeminiCallWithFallback({contents: params.contents, config: params.config, preferredModel: PERSONAL_CHAT_MODEL})');

const forbidden = [
  /import\s*\{[^}]*GoogleGenAI[^}]*\}\s*from\s*['"]@google\/genai['"]/, 
  /from\s*['"]@google\/genai['"]/, 
  /\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/,
  /\bsearchWithTavily\s*\(/,
  /\b(?:public|private|protected)?\s*getClient\s*\([^)]*\)\s*:\s*GoogleGenAI\s*\{/ 
];
const labels = ['Gemini SDK import','Gemini SDK module import','Gemini SDK call','Tavily runtime','Gemini SDK client helper'];
const remaining=[];
for(let i=0;i<forbidden.length;i++) if(forbidden[i].test(s)) remaining.push(labels[i]);
if(remaining.length) throw new Error('[GEMINI-REST] Forbidden executable references remain: '+remaining.join(', '));
if(!s.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';")) throw new Error('[GEMINI-REST] Gemini 3.7 Flash missing.');

fs.writeFileSync(target,s,'utf8');
console.log('[GEMINI-REST] OK: Gemini 3.7 Flash REST + Exa direct live runtime installed.');
