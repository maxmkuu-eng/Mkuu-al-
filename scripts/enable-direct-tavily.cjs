const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server/geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("import { answerDirectlyWithTavily } from './tavilyDirect.js';")) {
  source = source.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily } from './tavilySearch.js';\nimport { answerDirectlyWithTavily } from './tavilyDirect.js';",
  );
}

if (!source.includes('webSources: Array<{ title: string; url: string }>')) {
  source = source.replace(
    '  generatedFiles: GeneratedFileSummary[];\n  aiProvider: string;',
    '  generatedFiles: GeneratedFileSummary[];\n  webSources: Array<{ title: string; url: string }>;\n  aiProvider: string;',
  );
}

if (source.includes('MKUU_DIRECT_TAVILY_PATH')) {
  console.log('MKUU: Direct Tavily path already enabled; skipping.');
  process.exit(0);
}

const start = source.indexOf('    if (isSearchQuery) {');
const end = source.indexOf('    } else {', start);
if (start < 0 || end < 0) throw new Error('MKUU: Could not locate live-search block for direct Tavily patch.');

const directBlock = `    if (isSearchQuery) {\n      // MKUU_DIRECT_TAVILY_PATH: current/live questions are answered directly by Tavily.\n      // Gemini is deliberately NOT called on this path.\n      try {\n        console.log('[MKUU-BACKEND] [DIRECT_TAVILY_STARTED] Gemini bypassed for live/current question.');\n        const tavily = await answerDirectlyWithTavily(message);\n        aiReplyText = tavily.answer;\n        (this as any).__lastDirectTavilySources = tavily.sources.map((s: any) => ({ title: String(s.title || ''), url: String(s.url || '') })).filter((s: any) => s.url);\n        console.log(\\`[MKUU-BACKEND] [DIRECT_TAVILY_SUCCESS] sources=\${tavily.sources.length} latency=\${Date.now() - startTime}ms\\`);\n      } catch (tavilyErr: any) {\n        const msg = String(tavilyErr?.message || tavilyErr);\n        console.error(\\`[MKUU-BACKEND] [DIRECT_TAVILY_FAILED] \${msg}\\`);\n        throw new Error(\\`LIVE_SEARCH_UNAVAILABLE: Direct Tavily answer failed. \${msg}\\`);\n      }\n`;

source = source.slice(0, start) + directBlock + source.slice(end + '    } else {'.length);

const oldReturn = `      generatedFiles: generatedFilesList,\n      aiProvider: AI_PROVIDER,\n      chatModel: usedModel,`;
const newReturn = `      generatedFiles: generatedFilesList,\n      webSources: isSearchQuery ? ((this as any).__lastDirectTavilySources || []) : [],\n      aiProvider: isSearchQuery ? 'Tavily' : AI_PROVIDER,\n      chatModel: isSearchQuery ? 'Tavily Direct Answer' : usedModel,`;
if (source.includes(oldReturn)) source = source.replace(oldReturn, newReturn, 1);
else throw new Error('MKUU: Could not locate ChatProcessResult return block.');

fs.writeFileSync(file, source);
console.log('MKUU: Direct Tavily live/current answer path enabled; Gemini is bypassed for search queries.');
