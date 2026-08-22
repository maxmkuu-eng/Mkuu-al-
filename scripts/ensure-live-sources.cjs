const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('getLastTavilySources')) {
  source = source.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily, getLastTavilySources } from './tavilySearch.js';"
  );
}

const oldRules = "- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.";
const newRules = "- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- NEVER treat a source publication date as the date an event happened. State an event date only when the evidence explicitly supports it; otherwise say that the source was published/reported on that date.\\n- When sources mention both an event date and a publication date, use the event date for the event and the publication date only to establish freshness.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.";
if (!source.includes('NEVER treat a source publication date')) {
  source = source.replace(oldRules, newRules);
}

const marker = "        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_SUCCESS] Live search answer generated from fresh web evidence.');";
if (!source.includes('const liveSources = getLastTavilySources()')) {
  const block = [
    marker,
    "        // Keep the final answer auditable: expose the actual Tavily sources used.",
    "        // The existing UI renders these markdown links normally.",
    "        const liveSources = getLastTavilySources().slice(0, 6);",
    "        if (liveSources.length > 0) {",
    "          const sourceLines = liveSources.map((source, index) => {",
    "            const title = String(source.title || 'Chanzo cha Tavily').replace(/\\[/g, '(').replace(/\\]/g, ')');",
    "            return `${index + 1}. [${title}](${source.url})`;",
    "          }).join('\\n');",
    "          aiReplyText = `${aiReplyText.trim()}\\n\\n**Vyanzo vya taarifa (Tavily):**\\n${sourceLines}`;",
    "        }"
  ].join('\n');
  source = source.replace(marker, block);
}

fs.writeFileSync(file, source);
console.log('[BUILD] Live-search source/date safeguards applied.');
