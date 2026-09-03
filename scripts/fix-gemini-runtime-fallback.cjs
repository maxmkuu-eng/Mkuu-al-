const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) {
  console.log('[GEMINI-RUNTIME] server/geminiService.ts not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
const methodStart = source.indexOf('  private async executeGeminiCallWithFallback(');
const methodEnd = source.indexOf('  private buildSystemPrompt(', methodStart);

if (methodStart < 0 || methodEnd < 0) {
  console.log('[GEMINI-RUNTIME] Gemini call method boundaries not found; skipping safely.');
  process.exit(0);
}

const newMethod = `  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {
    const preferred = params.preferredModel || PERSONAL_CHAT_MODEL;
    const modelsToTry = params.config?.tools ? [preferred] : [PERSONAL_CHAT_MODEL];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
    }

    let lastError: any = null;

    // IMPORTANT: Use Google's documented REST generateContent endpoint directly.
    // This intentionally bypasses @google/genai so SDK runtime errors such as
    // "i is not defined" can never break normal MKUU chat.
    for (const model of modelsToTry) {
      try {
        const endpoint = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`;
        const cfg = params.config || {};
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
        const restResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
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

        if (text.trim()) {
          console.log(\`[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model="\${model}"\`);
          return text;
        }

        throw new Error('Gemini REST returned an empty response.');
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.error(\`[MKUU-BACKEND] [GEMINI_REST_ERROR] model="\${model}" error="\${errMsg}"\`);
        if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg)) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    throw lastError || new Error('All Gemini REST model candidates are temporarily unavailable.');
  }

`;

source = source.slice(0, methodStart) + newMethod + source.slice(methodEnd);
fs.writeFileSync(target, source, 'utf8');
console.log('[GEMINI-RUNTIME] Gemini REST direct-call patch installed.');
