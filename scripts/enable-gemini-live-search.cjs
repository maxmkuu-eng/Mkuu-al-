const fs = require('fs');
const path = require('path');

// MKUU uses Gemini native Google Search grounding for live/current questions.
// Idempotent migration: runs before every build.
const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');
source = source.replace(/import \{ searchWithTavily \} from '\.\/tavilySearch\.js';\n/, '');
source = source.replace(/\/\/ Live-search path:[^\n]*/g, '// Live-search path: Gemini native Google Search grounding');

const start = source.indexOf('    if (isSearchQuery) {');
if (start < 0) throw new Error('MKUU: live-search branch not found.');
let depth = 0, end = -1, inString = null, escaped = false;
for (let i = source.indexOf('{', start); i < source.length; i++) {
  const ch = source[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === inString) inString = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('MKUU: live-search branch end not found.');

const replacement = `    if (isSearchQuery) {
      // LIVE WEB SEARCH: Gemini native Google Search grounding only.
      try {
        console.log('[MKUU-BACKEND] [GOOGLE_SEARCH_STARTED] Gemini native Google Search grounding.');
        const livePrompt = \`\${systemPrompt}\\n\\nLIVE WEB SEARCH RULES:\\n- Use Google Search grounding for current-information questions.\\n- Prefer the newest credible evidence and verify dates.\\n- Do not rely on stale model memory when web evidence is available.\\n- For current public officials, use the newest authoritative source.\\n- For sports, verify the latest result or fixture and exact event date.\\n- If sources conflict, briefly explain and prefer the newest authoritative source.\\n- Never invent names, scores, dates, prices, or events.\\n- Current Tanzania server time: \${getCurrentTanzaniaTimeContext().formattedString}\`;
        const groundedContents = this.buildConversationHistory(conversationHistory, message, attachments);
        aiReplyText = await this.executeGeminiCallWithFallback({
          contents: groundedContents,
          config: { systemInstruction: livePrompt, temperature: 0.2, tools: [{ googleSearch: {} }] },
          preferredModel: usedModel,
        });
        if (!aiReplyText?.trim()) throw new Error('Google Search grounding returned an empty response.');
        console.log(\\`[MKUU-BACKEND] [GOOGLE_SEARCH_SUCCESS] Live web answer generated. latency=\\${Date.now() - startTime}ms\\`);
      } catch (searchErr: any) {
        const msg = String(searchErr?.message || searchErr);
        console.error(\\`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] Google Search grounding failed: \\${msg}\\`);
        throw new Error(\\`LIVE_SEARCH_UNAVAILABLE: Google Search grounding failed. \\${msg}\\`);
      }
      console.log(\\`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model="\\${usedModel}" latency=\\${Date.now() - startTime}ms status=200\\`);
    }`;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source);
console.log('MKUU: Gemini native Google Search grounding enabled for live queries.');
