const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'server/geminiService.ts');
let s = fs.readFileSync(file, 'utf8');

// Hard-lock the personal/normal chat route to Gemini 3.7 Flash.
s = s.replace(/export const PERSONAL_CHAT_MODEL\s*=\s*['"][^'"]+['"];/, "export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s = s.replace(/export const CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\];/, "export const CHAT_MODEL_FALLBACKS = ['gemini-3.7-flash'];");
s = s.replace(/const modelsToTry = params\.config\?\.tools \? \[preferred\] : \[[^\]]*\];/, "const modelsToTry = params.config?.tools ? [preferred] : [PERSONAL_CHAT_MODEL];");

// Fast local greeting: no DB work, no Gemini round-trip, no web search.
const marker = "    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;";
if (!s.includes('MKUU_FAST_OWNER_GREETING')) {
  const block = `    // MKUU_FAST_OWNER_GREETING: ordinary greetings must be instant and never become religiously-coded replies.\n    const normalizedMessage = String(message || '').trim().toLowerCase().replace(/[!?.,;:]+$/g, '');\n    if (/^(habari|mambo|vipi|hello|hi|hey|salama|hujambo|za kwako|upo|upoje)$/.test(normalizedMessage)) {\n      const greeting = 'Nzuri sana Mkuu 👑, niko tayari. Nikusaidie nini?';\n      return { reply: greeting, cleanSpeechText: greeting, memoriesExtracted: [], peopleRecognized: [], generatedFiles: [], aiProvider: AI_PROVIDER, chatModel: 'MKUU Fast Greeting', latencyMs: Date.now() - startTime };\n    }\n`;
  if (!s.includes(marker)) throw new Error('FAST_CHAT_PATCH_FAILED: processChat parameter marker not found');
  s = s.replace(marker, marker + '\n' + block);
}

// Keep normal chat on Gemini 3.7 Flash only; avoid model fallback/churn.
s = s.replace(
  "const modelsToTry = params.config?.tools ? [preferred] : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];",
  "const modelsToTry = params.config?.tools ? [preferred] : [PERSONAL_CHAT_MODEL];"
);
s = s.replace(
  "const modelsToTry = params.config?.tools ? [preferred] : [preferred];",
  "const modelsToTry = params.config?.tools ? [preferred] : [PERSONAL_CHAT_MODEL];"
);

// Reduce unnecessary history/token work for ordinary chat while retaining useful context.
s = s.replace('const recentHistory = rawHistory.slice(-20);', 'const recentHistory = rawHistory.slice(-8);');
s = s.replace("const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.7 };", "const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.5, maxOutputTokens: 768 };");

// Explicit owner greeting rule for any greeting that reaches Gemini (e.g. greeting + question).
const promptAnchor = '3. Tumia lugha ya heshima na ya kirafiki';
if (!s.includes('OWNER GREETING — HARD RULE')) {
  const rule = `OWNER GREETING — HARD RULE:\n- Max ndiye Mkuu/Boss na mmiliki wa MKUU AI.\n- Kwa salamu ya kawaida kama "habari", "mambo", "vipi", "hello", "hi" au "salama", jibu kwa salamu ya kawaida ya kirafiki; mfano: "Nzuri sana Mkuu 👑, niko tayari. Nikusaidie nini?".\n- USISEME "marahaba" kwa salamu ya kawaida. Tumia "marahaba" tu ikiwa Max ameanza kwa salamu ya Kiislamu inayohitaji jibu hilo.\n\n`;
  if (!s.includes(promptAnchor)) throw new Error('FAST_CHAT_PATCH_FAILED: personality prompt anchor not found');
  s = s.replace(promptAnchor, rule + promptAnchor);
}

fs.writeFileSync(file, s, 'utf8');
console.log('[MKUU-FAST-CHAT] Normal chat is hard-locked to Gemini 3.7 Flash; fast owner greetings and reduced chat churn enabled.');
