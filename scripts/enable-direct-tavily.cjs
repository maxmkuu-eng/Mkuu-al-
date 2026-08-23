const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server/geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("import { answerDirectlyWithTavily } from './tavilyDirect.js';")) {
  const importMarker = "import { searchWithTavily } from './tavilySearch.js';";
  if (!source.includes(importMarker)) throw new Error('MKUU: Tavily search import not found.');
  source = source.replace(importMarker, `${importMarker}\nimport { answerDirectlyWithTavily } from './tavilyDirect.js';`);
}

if (!source.includes('webSources: Array<{ title: string; url: string }>')) {
  const generatedFilesField = '  generatedFiles: GeneratedFileSummary[];';
  if (!source.includes(generatedFilesField)) throw new Error('MKUU: ChatProcessResult interface not found.');
  source = source.replace(generatedFilesField, `${generatedFilesField}\n  webSources: Array<{ title: string; url: string }>;`);
}

if (source.includes('MKUU_DIRECT_TAVILY_PATH')) {
  console.log('MKUU: Direct Tavily path already enabled; skipping.');
  process.exit(0);
}

const start = source.indexOf('    if (isSearchQuery) {');
const elseStart = source.indexOf('    } else {', start);
if (start < 0 || elseStart < 0) throw new Error('MKUU: Could not locate live-search branch in geminiService.ts.');

// Replace only the existing live-search branch. Preserve the existing `} else {`
// and all normal Gemini-chat code after it.
const directBlock = `    if (isSearchQuery) {\n      // MKUU_DIRECT_TAVILY_PATH: current/live questions are answered directly by Tavily.\n      // Gemini is deliberately NOT called on this path.\n      try {\n        console.log('[MKUU-BACKEND] [DIRECT_TAVILY_STARTED] Gemini bypassed for live/current question.');\n        const tavily = await answerDirectlyWithTavily(message);\n        aiReplyText = tavily.answer;\n        (this as any).__lastDirectTavilySources = tavily.sources\n          .map((s: any) => ({ title: String(s.title || ''), url: String(s.url || '') }))\n          .filter((s: any) => s.url);\n        console.log(\`[MKUU-BACKEND] [DIRECT_TAVILY_SUCCESS] sources=\${tavily.sources.length} latency=\${Date.now() - startTime}ms\`);\n      } catch (tavilyErr: any) {\n        const msg = String(tavilyErr?.message || tavilyErr);\n        console.error(\`[MKUU-BACKEND] [DIRECT_TAVILY_FAILED] \${msg}\`);\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Direct Tavily answer failed. \${msg}\`);\n      }\n    }`;

source = source.slice(0, start) + directBlock + source.slice(elseStart);

// Add web-source metadata without depending on the exact field ordering.
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
console.log('MKUU: Direct Tavily live/current answer path enabled; Gemini is bypassed for search queries.');
