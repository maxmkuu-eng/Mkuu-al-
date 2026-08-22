const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("getLastTavilySources")) {
  source = source.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily, getLastTavilySources } from './tavilySearch.js';"
  );
}

source = source.replace(
  "- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.",
  "- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- NEVER treat a source publication date as the date an event happened. State an event date only when the evidence explicitly supports it; otherwise say that the source was published/reported on that date.\\n- When sources mention both an event date and a publication date, use the event date for the event and the publication date only to establish freshness.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match."
);

const marker = "        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_SUCCESS] Live search answer generated from fresh web evidence.');";
const replacement = `${marker}\n        // Keep the final answer auditable: expose the actual Tavily sources used.\n        // The source block is rendered as normal markdown links by the existing UI.\n        const liveSources = getLastTavilySources().slice(0, 6);\n        if (liveSources.length > 0) {\n          const sourceLines = liveSources.map((source, index) =>\n            \\`${index + 1}. [${String(source.title || 'Chanzo cha Tavily').replace(/\\[/g, '(').replace(/\\]/g, ')')}](${source.url})\\`\n          ).join('\\n');\n          aiReplyText = \\`${aiReplyText.trim()}\\n\\n**Vyanzo vya taarifa (Tavily):**\\n${sourceLines}\\`;\n        }`;
if (!source.includes('const liveSources = getLastTavilySources()')) {
  source = source.replace(marker, replacement);
}

fs.writeFileSync(file, source);
console.log('[BUILD] Live-search source/date safeguards applied.');
