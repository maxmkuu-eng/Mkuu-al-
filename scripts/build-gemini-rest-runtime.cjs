const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-REST] server/geminiService.ts not found.');

let s = fs.readFileSync(target, 'utf8');

// This is a final build normalization step. Earlier scripts intentionally patch the
// same service, so this script must tolerate every already-patched layout.
s = s.replace(/import\s*\{\s*GoogleGenAI\s*\}\s*from\s*['"]@google\/genai['"];?\s*/g, '');
s = s.replace(/import\s*\{\s*searchWithTavily\s*\}\s*from\s*['"]\.\/tavilySearch\.js['"];?\s*/g, '');
s = s.replace(/\s*private\s+aiClient\s*:\s*GoogleGenAI\s*\|\s*null\s*=\s*null;?\s*/g, '\n');
s = s.replace(/\s*private\s+getClient\s*\(\s*\)\s*:\s*GoogleGenAI\s*\{[\s\S]*?\}\s*(?=public\s+(?:async\s+)?(?:getHealthStatus|processChat)\b)/m, '\n');

// Normalize the model constants without depending on their previous values.
s = s.replace(/export\s+const\s+PERSONAL_CHAT_MODEL\s*=\s*['"][^'"]+['"]\s*;?/, "export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s = s.replace(/export\s+const\s+LIVE_SEARCH_MODEL\s*=\s*['"][^'"]+['"]\s*;?/, "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
s = s.replace(/export\s+const\s+CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\]\s*;?/, "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

const healthMethod = `  public async getHealthStatus(): Promise<{ aiProvider: string; chatModel: string; backend: string; status: 'connected' | 'unavailable'; latencyMs?: number; error?: string }> {\n    const started = Date.now();\n    const key = process.env.GEMINI_API_KEY;\n    if (!key) return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - started, error: 'GEMINI_API_KEY is not configured on MKUU Backend.' };\n    try {\n      const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${PERSONAL_CHAT_MODEL}:generateContent\`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Ping status check' }] }] }) });\n      const raw = await response.text();\n      if (!response.ok) { let message = raw; try { message = JSON.parse(raw)?.error?.message || raw; } catch {} return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - started, error: message }; }\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - started };\n    } catch (error: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - started, error: String(error?.message || error) };\n    }\n  }\n\n`;

// Install/replace the health method using a structural class boundary. If an earlier
// patch already removed it, inject a clean copy immediately before processChat.
const healthRe = /\s{2}public\s+async\s+getHealthStatus\s*\([^)]*\)\s*:\s*Promise<\{[\s\S]*?\n\s{2}\}\s*\n(?=\s{2}public\s+async\s+processChat\b)/m;
if (healthRe.test(s)) {
  s = s.replace(healthRe, '\n' + healthMethod);
} else {
  const processMatch = s.match(/\n\s{2}public\s+async\s+processChat\b/);
  if (!processMatch || processMatch.index == null) throw new Error('[GEMINI-REST] processChat method not found; refusing unsafe build.');
  s = s.slice(0, processMatch.index) + '\n' + healthMethod + s.slice(processMatch.index);
}

const restMethod = `  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {\n    const key = process.env.GEMINI_API_KEY;\n    if (!key) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');\n    const model = PERSONAL_CHAT_MODEL;\n    const cfg: any = params.config || {};\n    const body: any = { contents: params.contents };\n    if (cfg.systemInstruction) body.systemInstruction = typeof cfg.systemInstruction === 'string' ? { parts: [{ text: cfg.systemInstruction }] } : cfg.systemInstruction;\n    const generationConfig: any = {};\n    for (const name of ['temperature', 'topP', 'topK', 'maxOutputTokens', 'candidateCount', 'stopSequences']) if (cfg[name] !== undefined) generationConfig[name] = cfg[name];\n    if (cfg.thinkingConfig) generationConfig.thinkingConfig = cfg.thinkingConfig;\n    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;\n    console.log(\`[MKUU-BACKEND] [GEMINI_REST_REQUEST] model="\${model}"\`);\n    const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });\n    const raw = await response.text();\n    let data: any = {};\n    try { data = JSON.parse(raw); } catch {}\n    if (!response.ok) throw new Error(\`Gemini REST HTTP \${response.status}: \${data?.error?.message || raw || 'Unknown Gemini error'}\`);\n    const parts = data?.candidates?.[0]?.content?.parts;\n    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';\n    if (!text.trim()) throw new Error('Gemini REST returned an empty response.');\n    console.log(\`[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model="\${model}"\`);\n    return text;\n  }\n\n`;

// Replace the old SDK executor if it exists. If an earlier patch already installed
// REST, leave that implementation alone; otherwise inject the REST executor before
// buildSystemPrompt.
const execRe = /\n\s{2}private\s+async\s+executeGeminiCallWithFallback\s*\([\s\S]*?\n\s{2}\}\s*\n(?=\s{2}private\s+buildSystemPrompt\b)/m;
if (execRe.test(s)) {
  s = s.replace(execRe, '\n' + restMethod);
} else if (!s.includes('[GEMINI_REST_REQUEST]')) {
  const promptMatch = s.match(/\n\s{2}private\s+buildSystemPrompt\b/);
  if (!promptMatch || promptMatch.index == null) throw new Error('[GEMINI-REST] buildSystemPrompt method not found; refusing unsafe build.');
  s = s.slice(0, promptMatch.index) + '\n' + restMethod + s.slice(promptMatch.index);
}

// Only remove the legacy Tavily branch when its actual call is still present. Do not
// touch an already-installed Exa branch merely because it also uses isSearchQuery.
if (s.includes('searchWithTavily(')) {
  const liveStart = s.indexOf('    if (isSearchQuery)');
  const liveStartCompact = s.indexOf('    if(isSearchQuery)');
  const start = liveStart >= 0 ? liveStart : liveStartCompact;
  const fileIntent = start >= 0 ? s.indexOf('    if(fileIntent){', start) : -1;
  if (start >= 0 && fileIntent > start) {
    const replacement = `    if(isSearchQuery){\n      throw new Error('EXA_LIVE_PIPELINE_NOT_INSTALLED');\n    } else {\n      try{aiReplyText=await this.executeGeminiCallWithFallback({contents,config:generationConfig,preferredModel:PERSONAL_CHAT_MODEL});}catch(err:any){const errMsg=String(err?.message||err);console.error(\`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="\${errMsg}" latency=\${Date.now()-startTime}ms\`);throw new Error(\`Google Gemini API (\${PERSONAL_CHAT_MODEL}) Error: \${err?.message||'Huduma haikupatikana kwa sasa'}\`);}}\n    }\n`;
    s = s.slice(0, start) + replacement + s.slice(fileIntent);
  } else {
    throw new Error('[GEMINI-REST] Legacy Tavily call found but its branch boundary could not be identified.');
  }
}

// The final source must not depend on the Google SDK or Tavily at runtime.
const forbidden = ['@google/genai', 'GoogleGenAI', '.models.generateContent', 'private getClient():', 'searchWithTavily('];
const remaining = forbidden.filter(token => s.includes(token));
if (remaining.length) throw new Error('[GEMINI-REST] Forbidden references remain: ' + remaining.join(', '));
if (!s.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';")) throw new Error('[GEMINI-REST] Gemini 3.7 Flash missing.');
if (!s.includes('[GEMINI_REST_REQUEST]')) throw new Error('[GEMINI-REST] Direct REST executor missing.');

fs.writeFileSync(target, s, 'utf8');
console.log('[GEMINI-REST] OK: clean Gemini 3.7 Flash REST runtime installed.');
