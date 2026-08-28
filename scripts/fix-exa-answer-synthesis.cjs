const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

const old = '        aiReplyText = exaResult.answer;\n        webSources = exaResult.citations;';
const replacement = `        webSources = exaResult.citations;\n        const groundedSystemPrompt = \`${'${systemPrompt}'}\\n\\nLIVE WEB SEARCH EVIDENCE (Exa):\\n${'${exaResult.answer}'}\\n\\nSTRICT ANSWER RULES:\\n- Answer the user\'s actual question, do not dump or repeat the search-result titles/snippets.\\n- Use the Exa evidence as the primary source of truth and do not rely on stale model memory.\\n- For sports results, identify the exact requested date, opponent and final score. Prefer explicit FT/full-time/final-result evidence. Ignore previews, fixtures, scheduled kick-off pages, and text saying a team will play.\\n- If the evidence does not contain a verified final result, say that the final result could not be verified instead of guessing.\\n- Give a concise direct answer first, then only the useful supporting detail.\\n- Never present a search-result title as if it were the answer.\`;\n        const groundedContents = this.buildConversationHistory(\n          conversationHistory,\n          \`${'${message}'}\\n\\n[MKUU EXA LIVE SEARCH EVIDENCE - synthesize this evidence into the answer]\\n${'${exaResult.answer}'}\`,\n          attachments,\n        );\n        aiReplyText = await this.executeGeminiCallWithFallback({\n          contents: groundedContents,\n          config: { systemInstruction: groundedSystemPrompt, temperature: 0.15 },\n          preferredModel: PERSONAL_CHAT_MODEL,\n        });`;

if (source.includes(old)) {
  source = source.replace(old, replacement);
} else if (!source.includes('MKUU EXA LIVE SEARCH EVIDENCE - synthesize this evidence')) {
  throw new Error('EXA SYNTHESIS patch target missing in server/geminiService.ts');
}

fs.writeFileSync(file, source);
console.log('MKUU: Exa evidence is now synthesized by Gemini instead of being shown directly to the user.');
