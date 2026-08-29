const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) {
  console.warn('[GEMINI] server/geminiService.ts not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

// Gemini 3.x should not be forced with legacy low-temperature sampling.
// Use the supported thinking configuration instead; LOW keeps MKUU responsive.
source = source.replace(/,\s*temperature:\s*0\.7/g, '');
source = source.replace(/,\s*temperature:\s*0\.2/g, '');
source = source.replace(/temperature:\s*0\.7,\s*/g, '');
source = source.replace(/temperature:\s*0\.2,\s*/g, '');

source = source.replace(
  /const generationConfig: any = \{\s*systemInstruction: systemPrompt\s*\};/,
  "const generationConfig: any = { systemInstruction: systemPrompt, thinkingConfig: { thinkingLevel: 'low' } };"
);
source = source.replace(
  /config: \{ systemInstruction: groundedSystemPrompt\s*\}/,
  "config: { systemInstruction: groundedSystemPrompt, thinkingConfig: { thinkingLevel: 'low' } }"
);

// Keep Gemini 3.7 as the preferred model, but provide stable fallbacks so a
// temporary model-access/availability problem does not take MKUU offline.
source = source.replace(
  /export const CHAT_MODEL_FALLBACKS = \[[\s\S]*?\];/,
  "export const CHAT_MODEL_FALLBACKS = [\n  'gemini-3.7-flash',\n  'gemini-3.6-flash',\n  'gemini-3.5-flash',\n  'gemini-3.1-flash-lite',\n  'gemini-2.5-flash',\n];"
);

// Health must report the real Gemini state. Never claim "connected" when the
// API key, model, quota, or upstream request is actually failing.
source = source.replace(
  /return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \} catch \(err: any\) \{\n      return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \}/,
  "return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };\n    } catch (err: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: String(err?.message || err || 'Gemini unavailable') };\n    }"
);

if (source !== original) {
  fs.writeFileSync(target, source);
  console.log('[GEMINI] Runtime config hardened: Gemini 3.x sampling removed, low-latency thinking enabled, resilient model fallback enabled, and health reporting corrected.');
} else {
  console.log('[GEMINI] Runtime config already hardened; no changes needed.');
}
