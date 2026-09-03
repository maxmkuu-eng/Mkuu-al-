const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-RUNTIME] server/geminiService.ts not found.');

let source = fs.readFileSync(target, 'utf8');

// MKUU architecture: Gemini handles normal chat; Exa handles live/web search.
// Tavily and Google Search grounding are not part of the live-search path.
source = source.replace(/import \{ searchWithTavily \} from '\.\/tavilySearch\.js';\n?/g, '');
source = source.replace(/export const PERSONAL_CHAT_MODEL = 'gemini-[^']+';/, "export const PERSONAL_CHAT_MODEL = 'gemini-3.8-flash';");
source = source.replace(/export const LIVE_SEARCH_MODEL = '[^']+';/, "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
source = source.replace(/export const CHAT_MODEL_FALLBACKS = \[[\s\S]*?\];/, "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");
source = source.replace(/Gemini 3\.7 Flash/g, 'Gemini 3.8 Flash');

// Remove the SDK execution path completely. The production backend uses the
// Gemini REST endpoint so an SDK internal ReferenceError such as "i is not defined"
// can never reach the chat request handler.
source = source.replace(/^import \{ GoogleGenAI \} from '@google\/genai';\n?/m, '');
source = source.replace(/\n  private aiClient: GoogleGenAI \| null = null;\n/, '\n');

const clientStart = source.indexOf('  private getClient(): GoogleGenAI {');
if (clientStart >= 0) {
  const clientEnd = source.indexOf('  public async getHealthStatus(', clientStart);
  if (clientEnd <= clientStart) throw new Error('[GEMINI-RUNTIME] getClient boundary is invalid.');
  source = source.slice(0, clientStart) + source.slice(clientEnd);
}

const healthStart = source.indexOf('  public async getHealthStatus(');
const processStart = source.indexOf('  public async processChat(', healthStart);
if (healthStart < 0 || processStart <= healthStart) {
  throw new Error('[GEMINI-RUNTIME] Health/process method boundaries not found.');
}

const healthMethod = `  public async getHealthStatus(): Promise<{ aiProvider: string; chatModel: string; backend: string; status: 'connected' | 'unavailable'; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: 'GEMINI_API_KEY is not configured on MKUU Backend.' };
    }
    try {
      const endpoint = \`https://generativelanguage.googleapis.com/v1beta/models/\${PERSONAL_CHAT_MODEL}:generateContent\`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Ping status check' }] }] }),
      });
      if (!response.ok) {
        const raw = await response.text();
        let message = raw;
        try { message = JSON.parse(raw)?.error?.message || raw; } catch {}
        return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: message };
      }
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };
    } catch (err) {
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: String(err?.message || err) };
    }
  }

`;
source = source.slice(0, healthStart) + healthMethod + source.slice(processStart);

const methodStart = source.indexOf('  private async executeGeminiCallWithFallback(');
const methodEnd = source.indexOf('  private buildSystemPrompt(', methodStart);
if (methodStart < 0 || methodEnd <= methodStart) {
  throw new Error('[GEMINI-RUNTIME] Gemini call method boundaries not found.');
}

const newMethod = `  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');

    const model = PERSONAL_CHAT_MODEL;
    const endpoint = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`;
    const cfg: any = params.config || {};
    const body: any = { contents: params.contents };

    if (cfg.systemInstruction) {
      body.systemInstruction = typeof cfg.systemInstruction === 'string'
        ? { parts: [{ text: cfg.systemInstruction }] }
        : cfg.systemInstruction;
    }

    const generationConfig: any = {};
    for (const key of ['temperature', 'topP', 'topK', 'maxOutputTokens', 'candidateCount', 'stopSequences']) {
      if (cfg[key] !== undefined) generationConfig[key] = cfg[key];
    }
    if (cfg.thinkingConfig) generationConfig.thinkingConfig = cfg.thinkingConfig;
    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;
    if (cfg.tools) body.tools = cfg.tools;

    console.log(\`[MKUU-BACKEND] [GEMINI_REST_REQUEST] model="\${model}"\`);
    try {
      const restResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });

      const raw = await restResponse.text();
      let data: any = {};
      try { data = JSON.parse(raw); } catch {}

      if (!restResponse.ok) {
        const message = data?.error?.message || raw || \`Gemini REST HTTP \${restResponse.status}\`;
        throw new Error(\`Gemini REST HTTP \${restResponse.status}: \${message}\`);
      }

      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || '')
        .join('') || '';

      if (!text.trim()) throw new Error('Gemini REST returned an empty response.');
      console.log(\`[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model="\${model}"\`);
      return text;
    } catch (err) {
      const errMsg = String(err?.message || err);
      console.error(\`[MKUU-BACKEND] [GEMINI_REST_ERROR] model="\${model}" error="\${errMsg}"\`);
      throw err;
    }
  }

`;
source = source.slice(0, methodStart) + newMethod + source.slice(methodEnd);

// Never silently ship the old SDK/Tavily execution path.
const forbidden = [
  "@google/genai",
  'GoogleGenAI',
  '.models.generateContent',
  'private getClient():',
  'searchWithTavily',
];
const leftovers = forbidden.filter((token) => source.includes(token));
if (leftovers.length) {
  throw new Error(`[GEMINI-RUNTIME] Forbidden runtime references remain: ${leftovers.join(', ')}`);
}
if (!source.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.8-flash';")) {
  throw new Error('[GEMINI-RUNTIME] Gemini 3.8 Flash model was not installed.');
}
if (!source.includes('[GEMINI_REST_REQUEST]')) {
  throw new Error('[GEMINI-RUNTIME] Direct Gemini REST call was not installed.');
}

fs.writeFileSync(target, source, 'utf8');
console.log('[GEMINI-RUNTIME] OK: Gemini 3.8 Flash REST only; Exa-only live search; Tavily/SDK runtime removed.');
