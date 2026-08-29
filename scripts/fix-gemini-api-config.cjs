const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) {
  console.warn('[GEMINI] server/geminiService.ts not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

// Gemini 3.x no longer accepts legacy sampling parameters such as temperature.
// Remove them from every server-side generateContent config so Gemini 3.7 Flash
// does not reject otherwise valid chat requests with HTTP 400.
source = source.replace(/,\s*temperature:\s*0\.7/g, '');
source = source.replace(/,\s*temperature:\s*0\.2/g, '');
source = source.replace(/temperature:\s*0\.7,\s*/g, '');
source = source.replace(/temperature:\s*0\.2,\s*/g, '');

// Health must report the real Gemini state. The previous catch path returned
// "connected" even when the API key/model/request was failing, masking the
// production problem.
source = source.replace(
  /return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \} catch \(err: any\) \{\n      return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \}/,
  "return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };\n    } catch (err: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: String(err?.message || err || 'Gemini unavailable') };\n    }"
);

if (source !== original) {
  fs.writeFileSync(target, source);
  console.log('[GEMINI] Gemini 3.x API config fixed: legacy temperature removed and health reporting corrected.');
} else {
  console.log('[GEMINI] API config already fixed; no changes needed.');
}
