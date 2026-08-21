const fs = require('node:fs');

const file = 'server/geminiService.ts';
let source = fs.readFileSync(file, 'utf8');

// fix-source-request-scope.cjs runs before this script, so target the current
// Tavily call rather than the pre-patch source text.
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
  ].join('\\n        ');

  source = source.replace(searchCall, newBlock);
}

if (!source.includes('If sportsFocus is non-empty')) {
  const promptAnchor = 'STRICT LIVE-DATA RULES:';
  if (!source.includes(promptAnchor)) throw new Error('MKUU: live search prompt anchor not found.');
  source = source.replace(
    promptAnchor,
    '${sportsFocus}\\n- If sportsFocus is non-empty, follow it strictly and answer only the requested next-match detail.\\nSTRICT LIVE-DATA RULES:'
  );
}

fs.writeFileSync(file, source, 'utf8');
console.log('MKUU: sports intent patch now targets the post-source-scope Tavily call and is build-order safe.');