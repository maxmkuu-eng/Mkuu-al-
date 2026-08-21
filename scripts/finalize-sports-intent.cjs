const fs = require('node:fs');

const file = 'server/geminiService.ts';
let source = fs.readFileSync(file, 'utf8');

const oldBlock = `const tavilyResults = await searchWithTavily(`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);`;
const newBlock = `const lowerSearchMessage = message.toLowerCase().trim();
        const nextMatchIntent = /\\b(anacheza lini|inacheza lini|ata[ -]?cheza lini|mchezo unaofuata|mechi inayofuata|next match|when does .* play|when is .* playing)\\b/i.test(lowerSearchMessage);
        const opponentIntent = /\\b(anacheza na nani|inacheza na nani|mpinzani wake|opponent wake|who are .* playing)\\b/i.test(lowerSearchMessage);
        const timeIntent = /\\b(anacheza saa ngapi|inacheza saa ngapi|mechi ni saa ngapi|mchezo ni saa ngapi|what time .* play|what time is .* match)\\b/i.test(lowerSearchMessage);
        const broadScheduleIntent = /\\b(ratiba|schedule|fixtures|michezo yote|mechi zote|all matches|full schedule)\\b/i.test(lowerSearchMessage);
        const sportsFocus = nextMatchIntent && !broadScheduleIntent
          ? `\\nSPORTS INTENT: The user is asking for the next upcoming match. Return ONLY the next relevant match for the named team, not a list of men's/women's teams or unrelated fixtures. ${opponentIntent ? 'Prioritize the opponent.' : ''} ${timeIntent ? 'Prioritize the kickoff time and convert it to Tanzania time (Africa/Dar_es_Salaam, UTC+3).' : ''} Use the exact event date/time supported by the search evidence.`
          : '';
        const tavilyQuery = nextMatchIntent && !broadScheduleIntent
          ? `${message}\\nFind the NEXT upcoming match only for the specifically named team. Do not return a general schedule.\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`
          : `${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`;
        const tavilyResults = await searchWithTavily(tavilyQuery);`;

if (!source.includes('const nextMatchIntent =')) {
  if (!source.includes(oldBlock)) throw new Error('MKUU: Tavily query insertion point not found.');
  source = source.replace(oldBlock, newBlock);
}

const promptNeedle = `- You may include source names/URLs when useful.\\n`;
const promptReplacement = `- You may include source names/URLs when useful.${'\\n'}${'${sportsFocus}'}${'\\n'}`;
if (!source.includes('SPORTS INTENT: The user is asking for the next upcoming match.')) {
  if (!source.includes(promptNeedle)) throw new Error('MKUU: live search prompt insertion point not found.');
  source = source.replace(promptNeedle, promptReplacement);
}

fs.writeFileSync(file, source, 'utf8');
console.log('MKUU: sports intent is now prioritized; next-match questions return the next relevant fixture instead of broad team schedules.');
