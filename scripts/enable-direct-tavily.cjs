const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server/geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

// This patch must be idempotent because npm run build executes it on every build.
// It deliberately does NOT depend on the presence/order of tavilySearch imports.
const directImport = "import { answerDirectlyWithTavily } from './tavilyDirect.js';";
if (!source.includes(directImport)) {
  const firstImportEnd = source.indexOf('\n', source.indexOf('import '));
  if (firstImportEnd < 0) throw new Error('MKUU: Could not locate import section in geminiService.ts.');
  source = source.slice(0, firstImportEnd + 1) + directImport + '\n' + source.slice(firstImportEnd + 1);
}

if (!source.includes('webSources: Array<{ title: string; url: string }>')) {
  const generatedFilesField = '  generatedFiles: GeneratedFileSummary[];';
  if (!source.includes(generatedFilesField)) throw new Error('MKUU: ChatProcessResult interface not found.');
  source = source.replace(
    generatedFilesField,
    `${generatedFilesField}\n  webSources: Array<{ title: string; url: string }>;`,
  );
}

if (source.includes('MKUU_DIRECT_TAVILY_PATH')) {
  console.log('MKUU: Direct Tavily path already enabled; skipping.');
  process.exit(0);
}

const start = source.indexOf('    if (isSearchQuery) {');
if (start < 0) throw new Error('MKUU: Could not locate live-search branch in geminiService.ts.');

// Find the matching closing brace of the if block, rather than relying on an
// exact old implementation. This makes the patch survive other live-search patches.
let depth = 0;
let end = -1;
let inString = null;
let escaped = false;
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
  else if (ch === '}') {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) throw new Error('MKUU: Could not determine end of live-search branch.');

const directBlock = `    if (isSearchQuery) {
      // MKUU_DIRECT_TAVILY_PATH: live/current questions are answered by Tavily directly.
      // IMPORTANT: no Gemini call, no Google Search grounding, and no Gemini fallback.
      try {
        console.log('[MKUU-BACKEND] [DIRECT_TAVILY_STARTED] Gemini completely bypassed for live/current question.');
        const tavily = await answerDirectlyWithTavily(message);
        aiReplyText = tavily.answer;
        (this as any).__lastDirectTavilySources = tavily.sources
          .map((s: any) => ({ title: String(s.title || ''), url: String(s.url || '') }))
          .filter((s: any) => s.url);
        console.log(\`[MKUU-BACKEND] [DIRECT_TAVILY_SUCCESS] sources=\${tavily.sources.length} latency=\${Date.now() - startTime}ms\`);
      } catch (tavilyErr: any) {
        const msg = String(tavilyErr?.message || tavilyErr);
        console.error(\`[MKUU-BACKEND] [DIRECT_TAVILY_FAILED] \${msg}\`);
        // Fail closed: do not call Gemini when Tavily fails.
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Direct Tavily failed and Gemini fallback is disabled. \${msg}\`);
      }
    }`;

source = source.slice(0, start) + directBlock + source.slice(end);

if (!source.includes('      webSources: isSearchQuery ?')) {
  const generatedFilesLine = '      generatedFiles: generatedFilesList,';
  const returnPos = source.lastIndexOf(generatedFilesLine);
  if (returnPos < 0) throw new Error('MKUU: Could not locate generatedFiles return field.');
  const insertAt = returnPos + generatedFilesLine.length;
  source = source.slice(0, insertAt) +
    "\n      webSources: isSearchQuery ? ((this as any).__lastDirectTavilySources || []) : []," +
    source.slice(insertAt);
}

source = source.replace(
  '      aiProvider: AI_PROVIDER,\n      chatModel: usedModel,',
  "      aiProvider: isSearchQuery ? 'Tavily' : AI_PROVIDER,\n      chatModel: isSearchQuery ? 'Tavily Direct Answer' : usedModel,",
);

fs.writeFileSync(file, source);
console.log('MKUU: Direct Tavily live/current answer path enabled; Gemini is completely bypassed for live queries.');
