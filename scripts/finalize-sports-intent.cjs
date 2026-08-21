const fs = require('node:fs');

const file = 'server/geminiService.ts';
let source = fs.readFileSync(file, 'utf8');

// The sports patch must be build-order safe and must never inject literal
// backslash-n sequences between TypeScript statements.
source = source
  .replace(/\\\\n        const nextMatchIntent/g, '\n        const nextMatchIntent')
  .replace(/\\\\n        const opponentIntent/g, '\n        const opponentIntent')
  .replace(/\\\\n        const timeIntent/g, '\n        const timeIntent')
  .replace(/\\\\n        const broadScheduleIntent/g, '\n        const broadScheduleIntent')
  .replace(/\\\\n        const sportsFocus/g, '\n        const sportsFocus')
  .replace(/\\\\n        const originalTavilyQuery/g, '\n        const originalTavilyQuery')
  .replace(/\\\\n        const tavilyQuery/g, '\n        const tavilyQuery')
  .replace(/\\\\n        const tavilyResults = await searchWithTavily\(tavilyQuery\);/g, '\n        const tavilyResults = await searchWithTavily(tavilyQuery);');

// Also repair the exact malformed sequence produced by the previous version.
source = source.replace('message.toLowerCase().trim();\\n        const nextMatchIntent', 'message.toLowerCase().trim();\n        const nextMatchIntent');

if (!source.includes('const nextMatchIntent =')) {
  const searchCall = /const tavilyResults = await searchWithTavily\(([\s\S]*?)\);/;
  const match = source.match(searchCall);
  if (!match) throw new Error('MKUU: Tavily search call not found for sports intent patch.');

  const newBlock = [
    'const lowerSearchMessage = message.toLowerCase().trim();',
    "const nextMatchIntent = /\\b(anacheza lini|inacheza lini|ata[ -]?cheza lini|mchezo unaofuata|mechi inayofuata|next match|when does .* play|when is .* playing)\\b/i.test(lowerSearchMessage);",
    "const opponentIntent = /\\b(anacheza na nani|inacheza na nani|mpinzani wake|opponent wake|who are .* playing)\\b/i.test(lowerSearchMessage);",
    "const timeIntent = /\\b(anacheza saa ngapi|inacheza saa ngapi|mechi ni saa ngapi|mchezo ni saa ngapi|what time .* play|what time is .* match)\\b/i.test(lowerSearchMessage);",
    "const broadScheduleIntent = /\\b(ratiba|schedule|fixtures|michezo yote|mechi zote|all matches|full schedule)\\b/i.test(lowerSearchMessage);",
    "const sportsFocus = nextMatchIntent && !broadScheduleIntent ? 'SPORTS INTENT: Return ONLY the next relevant match for the specifically named team, not a broad men\\'s/women\\'s schedule. ' + (opponentIntent ? 'Prioritize the opponent. ' : '') + (timeIntent ? 'Prioritize kickoff time and convert it to Tanzania time (Africa/Dar_es_Salaam, UTC+3). ' : '') + 'Use the exact event date/time supported by the search evidence.' : '';",
    'const originalTavilyQuery = ' + match[1] + ';',
    "const tavilyQuery = nextMatchIntent && !broadScheduleIntent ? `${message}\\nFind the NEXT upcoming match only for the specifically named team. Do not return a general schedule.\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}` : originalTavilyQuery;",
    'const tavilyResults = await searchWithTavily(tavilyQuery);',
  ].join('\n        ');

  source = source.replace(searchCall, newBlock);
}

if (!source.includes('If sportsFocus is non-empty')) {
  // Global Live Web Engine now owns the final grounding prompt. Support both
  // the old and new prompt anchors so this optional sports refinement never
  // breaks the build when another patch changes the prompt wording/order.
  const promptAnchors = ['STRICT TAVILY AUTHORITY RULES:', 'STRICT LIVE-DATA RULES:'];
  const promptAnchor = promptAnchors.find(anchor => source.includes(anchor));
  if (promptAnchor) {
    source = source.replace(
      promptAnchor,
      '${sportsFocus}\\n- If sportsFocus is non-empty, follow it strictly and answer only the requested next-match detail.\\n' + promptAnchor
    );
  } else {
    console.log('MKUU: sports prompt anchor already owned by the Global Live Web engine; skipped optional sports prompt insertion.');
  }
}

fs.writeFileSync(file, source, 'utf8');
console.log('MKUU: sports intent patch is build-order safe and free of malformed literal statement separators.');
