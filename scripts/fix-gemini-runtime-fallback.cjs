const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) {
  console.log('[GEMINI-RUNTIME] server/geminiService.ts not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');

// MKUU uses one Gemini model only: the current Personal Chat model.
// Remove the old multi-model fallback/search model configuration before bundling.
source = source.replace(/export const PERSONAL_CHAT_MODEL = 'gemini-[^']+';/, "export const PERSONAL_CHAT_MODEL = 'gemini-3.8-flash';");
source = source.replace(/export const LIVE_SEARCH_MODEL = 'gemini-[^']+';/, "export const LIVE_SEARCH_MODEL = PERSONAL_CHAT_MODEL;");
source = source.replace(/export const CHAT_MODEL_FALLBACKS = \[[\s\S]*?\];/, "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

// Permanently remove the server-side @google/genai execution dependency from the
// generated backend. REST is used instead so SDK/runtime bundling cannot produce
// opaque ReferenceErrors such as \"i is not defined\".
source = source.replace(/^import \{ GoogleGenAI \} from '@google\/genai';\n/m, '');
source = source.replace(/\n  private aiClient: GoogleGenAI \| null = null;\n/, '\n');

const clientStart = source.indexOf('  private getClient(): GoogleGenAI {');
if (clientStart >= 0) {
  const clientEnd = source.indexOf('  public async getHealthStatus(', clientStart);
  if (clientEnd > clientStart) source = source.slice(0, clientStart) + source.slice(clientEnd);
}

const healthStart = source.indexOf('  public async getHealthStatus(');
const processStart = source.indexOf('  public async processChat(', healthStart);
if (healthStart >= 0 && processStart > healthStart) {
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
}

const methodStart = source.indexOf('  private async executeGeminiCallWithFallback(');
const methodEnd = source.indexOf('  private buildSystemPrompt(', methodStart);

if (methodStart < 0 || methodEnd < 0) {
  console.log('[GEMINI-RUNTIME] Gemini call method boundaries not found; skipping safely.');
  process.exit(0);
}

const newMethod = `  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');

    const model = PERSONAL_CHAT_MODEL;
    const endpoint = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`;
    const cfg = params.config || {};
    const body = { contents: params.contents };

    if (cfg.systemInstruction) {
      body.systemInstruction = typeof cfg.systemInstruction === 'string'
        ? { parts: [{ text: cfg.systemInstruction }] }
        : cfg.systemInstruction;
    }

    const generationConfig = {};
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
      let data = {};
      try { data = JSON.parse(raw); } catch {}

      if (!restResponse.ok) {
        const message = data?.error?.message || raw || \`Gemini REST HTTP \${restResponse.status}\`;
        throw new Error(\`Gemini REST HTTP \${restResponse.status}: \${message}\`);
      }

      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || '')
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
fs.writeFileSync(target, source, 'utf8');
console.log('[GEMINI-RUNTIME] Single Gemini 3.8 Flash REST path installed; all fallbacks removed.');
