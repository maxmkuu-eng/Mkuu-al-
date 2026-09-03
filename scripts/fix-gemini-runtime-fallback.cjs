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
    let lastError: any = null;

    // Use the Gemini SDK first. If its internal runtime throws an opaque
    // ReferenceError such as "i is not defined", use the same Gemini model
    // through Google's documented REST endpoint instead of returning 503.
    for (const model of modelsToTry) {
      try {
        const response = await this.getClient().models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        const text = typeof response.text === 'string' ? response.text : '';
        if (text.trim()) return text;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.error(\`[MKUU-BACKEND] [GEMINI_SDK_ERROR] model="\${model}" error="\${errMsg}"\`);
        if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg)) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw lastError || new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
    }

    try {
      const model = preferred;
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
      if (text.trim()) return text;
      throw new Error('Gemini REST returned an empty response.');
    } catch (restErr: any) {
      const sdkMsg = String(lastError?.message || lastError || 'unknown SDK error');
      const restMsg = String(restErr?.message || restErr);
      console.error(\`[MKUU-BACKEND] [GEMINI_REST_FALLBACK_FAILED] SDK=\${sdkMsg} REST=\${restMsg}\`);
      throw new Error(\`Gemini SDK failed: \${sdkMsg}; REST fallback failed: \${restMsg}\`);
    }
  }

`;

source = source.slice(0, methodStart) + newMethod + source.slice(methodEnd);
fs.writeFileSync(target, source, 'utf8');
console.log('[GEMINI-RUNTIME] Gemini SDK runtime fallback installed with boundary-based patching.');
