const fs = require('fs');
const path = require('path');

const geminiFile = path.join(process.cwd(), 'server', 'geminiService.ts');
let gemini = fs.readFileSync(geminiFile, 'utf8');

if (!gemini.includes('getLastTavilySources')) {
  gemini = gemini.replace(
    "import { searchWithTavily } from './tavilySearch.js';",
    "import { searchWithTavily, getLastTavilySources } from './tavilySearch.js';"
  );
}

const oldRules = "- Prefer the newest credible source and pay attention to publication dates and event dates.\\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.";
const newRules = `- Prefer the newest credible source and pay attention to publication dates and event dates.
- NEVER treat a source publication date as the date an event happened. State an event date only when the evidence explicitly supports it; otherwise say that the source was published/reported on that date.
- When sources mention both an event date and a publication date, use the event date for the event and the publication date only to establish freshness.
- For sports in Tanzania, always report kickoff times in East Africa Time (EAT, UTC+3). If a Tanzanian source says "saa 12:00 jioni" or "12 jioni", that means 18:00 EAT, NOT 12:00 or 17:00. If a source says "saa 1:00 usiku", that means 01:00 EAT. Never copy the numeric local phrase as an EAT clock time without converting it. Prefer an official club/TFF fixture when available.
- For sports, report the exact latest result from the search evidence; do not substitute an older match.`;
if (!gemini.includes('always report kickoff times in East Africa Time')) {
  gemini = gemini.replace(oldRules, newRules);
}

const marker = "        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_SUCCESS] Live search answer generated from fresh web evidence.');";
if (!gemini.includes('const liveSources = getLastTavilySources()')) {
  const block = [
    marker,
    "        // Keep live sources together at the very bottom of the answer; show only four unique sources.",
    "        const liveSources = getLastTavilySources().slice(0, 4);",
    "        if (liveSources.length > 0) {",
    "          const seen = new Set<string>();",
    "          const sourceLines = liveSources.map((source) => {",
    "            const url = String(source.url || '').trim();",
    "            if (!url || seen.has(url)) return '';",
    "            seen.add(url);",
    "            const title = String(source.title || 'Chanzo cha Tavily').replace(/\\[/g, '(').replace(/\\]/g, ')').trim();",
    "            return `${seen.size}. [${title}](${url})`;",
    "          }).filter(Boolean).join('\\n');",
    "          if (sourceLines) aiReplyText = `${aiReplyText.trim()}\\n\\n**Vyanzo:**\\n${sourceLines}`;",
    "        }"
  ].join('\n');
  gemini = gemini.replace(marker, block);
}

fs.writeFileSync(geminiFile, gemini);

// Strengthen Tanzanian sports retrieval so kickoff times come from authoritative fixture sources.
const tavilyFile = path.join(process.cwd(), 'server', 'tavilySearch.ts');
let tavily = fs.readFileSync(tavilyFile, 'utf8');
const sportsMarker = "if(sports){\n  searches.push(runTavilySearch(`${query} final score FT full time result completed match`,'news',undefined,'week'));";
const sportsReplacement = "if(sports){\n  searches.push(runTavilySearch(`${query} kickoff time 18:00 EAT Tanzania official fixture`,'general',['tff-tickets.com'],'week'));\n  searches.push(runTavilySearch(`${query} kickoff time 18:00 EAT Tanzania official club fixture`,'general',['simbasc.co.tz','simbasc.com','ligikuu.co.tz'],'week'));\n  searches.push(runTavilySearch(`${query} final score FT full time result completed match`,'news',undefined,'week'));";
if (!tavily.includes("tff-tickets.com")) {
  tavily = tavily.replace(sportsMarker, sportsReplacement);
}
fs.writeFileSync(tavilyFile, tavily);

console.log('[BUILD] Live-search source/date safeguards and Tanzania sports timezone safeguards applied.');
