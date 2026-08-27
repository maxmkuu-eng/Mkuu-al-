const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

source = source.replace(
  /import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/,
  "import { searchWithExa } from './exaSearch.js';\n",
);

const startMarker = '    if (isSearchQuery) {';
const endMarker = '\n    } else {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) throw new Error('EXA patch: live-search block markers were not found.');

const exaBlock = `    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Exa is the exclusive live/social search provider.');
        const searchQuery = \`${'${message}'}\\nCurrent date/time in Tanzania: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\`;
        const exaResult = await searchWithExa(searchQuery);
        aiReplyText = exaResult.answer;
        webSources = exaResult.citations;
        if (!aiReplyText?.trim()) throw new Error('Exa returned an empty response.');
        console.log('[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Answer generated directly by Exa with structured web citations.');
      } catch (exaErr) {
        const exaMsg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] Exa search failed: ${'${exaMsg}'}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa search failed. ${'${exaMsg}'}\`);
      }

      console.log(\`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] provider=Exa model=exa latency=${'${Date.now() - startTime}'}ms status=200\`);
`;
source = source.slice(0, start) + exaBlock + source.slice(end);

const insufficientStart = source.indexOf('        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {');
if (insufficientStart !== -1) {
  const insufficientEnd = source.indexOf('        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED]', insufficientStart);
  if (insufficientEnd !== -1) source = source.slice(0, insufficientStart) + source.slice(insufficientEnd);
}

source = source.replace(
  'const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;',
  "const usedModel = isSearchQuery ? 'exa' : PERSONAL_CHAT_MODEL;",
);
source = source.replace(
  '      aiProvider: AI_PROVIDER,\n      chatModel: usedModel,',
  "      aiProvider: isSearchQuery ? 'Exa' : AI_PROVIDER,\n      chatModel: usedModel,",
);
source = source.replace(/Tavily/g, 'Exa').replace(/tavily/gi, 'exa');

// Keep the generated service aware of structured citations even if the source was an older revision.
if (!source.includes('webSources: Array<{ title: string; url: string }>')) {
  source = source.replace('  generatedFiles: GeneratedFileSummary[];\n  aiProvider:', '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider:');
}
if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
  source = source.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];");
}
if (!source.includes('      webSources,\n      aiProvider:')) {
  source = source.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
}

fs.writeFileSync(file, source);
console.log('MKUU: Exa is now the exclusive live-web and social-search provider; citations are returned separately from answer text.');
