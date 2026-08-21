const fs = require('node:fs');

function patch(file, label, fn) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`MKUU: ${label} applied.`);
  } else {
    console.log(`MKUU: ${label} already applied.`);
  }
}

patch('server/tavilySearch.ts', 'authoritative TFF sports search', (source) => {
  if (source.includes('MKUU_TFF_SPORTS_FRESHNESS')) return source;

  const marker = 'const settled=await Promise.allSettled(searches);';
  if (!source.includes(marker)) throw new Error('MKUU: sports freshness search insertion point not found.');

  const injected = `// MKUU_TFF_SPORTS_FRESHNESS\nif(sports){\n  const relativeDate = containsRelativeDay(query,'kesho') ? getTanzaniaDate(1) : containsRelativeDay(query,'jana') ? getTanzaniaDate(-1) : getTanzaniaDate(0);\n  searches.unshift(runTavilySearch(\`${query} Tanzania Football Federation official fixture kickoff ${relativeDate}\`,'general',['tff-tickets.com']));\n  searches.unshift(runTavilySearch(\`${query} official TFF fixture kickoff time Tanzania ${relativeDate}\`,'general',['tff-tickets.com']));\n}\n`;
  return source.replace(marker, injected + marker);
});

patch('server/tavilySearch.ts', 'authoritative TFF sports result ordering', (source) => {
  const old = 'const results=Array.from(unique.values()).sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,20);';
  if (!source.includes('MKUU_TFF_SPORTS_RESULT_ORDER')) {
    if (!source.includes(old)) throw new Error('MKUU: sports result ordering insertion point not found.');
    const replacement = `// MKUU_TFF_SPORTS_RESULT_ORDER\nconst results=Array.from(unique.values()).sort((a,b)=>{\n  const au=String(a?.url||'').toLowerCase();\n  const bu=String(b?.url||'').toLowerCase();\n  const aTff=sports && au.includes('tff-tickets.com');\n  const bTff=sports && bu.includes('tff-tickets.com');\n  if(aTff!==bTff) return aTff ? -1 : 1;\n  const ad=Date.parse(String(a?.published_date||''));\n  const bd=Date.parse(String(b?.published_date||''));\n  if(Number.isFinite(ad)&&Number.isFinite(bd)&&ad!==bd) return bd-ad;\n  if(Number.isFinite(bd)&&!Number.isFinite(ad)) return 1;\n  if(Number.isFinite(ad)&&!Number.isFinite(bd)) return -1;\n  return Number(b?.score||0)-Number(a?.score||0);\n}).slice(0,20);`;
    return source.replace(old, replacement);
  }
  return source;
});

patch('server/geminiService.ts', 'sports exact-time verification instructions', (source) => {
  const old = '- For sports, report the exact latest result from the search evidence; do not substitute an older match.';
  const replacement = '- For sports, verify the exact fixture date, opponent, competition, venue, and kickoff time. For Tanzanian football, treat an official TFF fixture/ticket listing as authoritative when available. Use the Tanzania-local kickoff time exactly as published; never guess, round, or convert a secondary site time when an authoritative local time is available. If sources conflict, prefer the official TFF listing and state the conflict only when necessary.';
  if (source.includes('authoritative TFF fixture/ticket listing')) return source;
  if (!source.includes(old)) throw new Error('MKUU: sports Gemini instruction marker not found.');
  return source.replace(old, replacement);
});

console.log('MKUU_TFF_SPORTS_FRESHNESS: exact-date and authoritative kickoff verification enabled.');
