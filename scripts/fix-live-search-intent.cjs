const fs = require('fs');
const path = require('path');

function patchFile(relative, transform) {
  const file = path.join(process.cwd(), relative);
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

// Backend: classify current public-figure/social questions as live-search requests.
patchFile('server/geminiService.ts', (source) => {
  const match = source.match(/const searchKeywords = \[(.*?)\];/s);
  if (!match) throw new Error('MKUU: searchKeywords array marker not found.');
  const extras = [
    'amejifungua', 'amepata mtoto', 'mtoto wa', 'ujauzito', 'pregnancy', 'pregnant',
    'baby', 'birth', 'zuchu', 'diamond', 'msanii', 'celebrity', 'artist', 'singer',
    'actor', 'actress', 'social media', 'instagram', 'facebook', 'tiktok', 'youtube',
    'twitter', 'x.com', 'official statement', 'post ya', 'statement ya', 'today',
    'yesterday', 'tomorrow', 'what happened', 'nani ni', 'who is', 'price', 'cost',
    'salary', 'appointed', 'resigned', 'died', 'death'
  ];
  let body = match[1];
  for (const term of extras) {
    if (!body.includes(`'${term}'`)) body += `,'${term}'`;
  }
  const bodyStart = match.index + match[0].indexOf(match[1]);
  return source.slice(0, bodyStart) + body + source.slice(bodyStart + match[1].length);
});

// Client: the same questions must bypass any stored direct Gemini API key and go to the server/Tavily path.
patchFile('src/services/aiEngine.ts', (source) => {
  const marker = '  const changingFactPatterns = [';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error('MKUU: client changingFactPatterns marker not found.');
  const end = source.indexOf('  ];', index);
  if (end < 0) throw new Error('MKUU: client live-search pattern end marker not found.');
  const additions = [
    /\bamejifungua\b/, /\bamepata mtoto\b/, /\bujauzito\b/, /\bpregnan\w*\b/, /\bbaby\b/, /\bbirth\b/, /\bzuchu\b/, /\bdiamond\b/, /\bmsanii\b/, /\bcelebrity\b/, /\bsocial media\b/, /\binstagram\b/, /\bfacebook\b/, /\btiktok\b/, /\byoutube\b/, /\btwitter\b/, /\bx\.com\b/, /\bofficial statement\b/, /\bpost ya\b/, /\bstatement ya\b/, /\bwhat happened\b/, /\bnani ni\b/
  ];
  const existing = source.slice(index, end);
  const missing = additions.filter((rx) => !rx.test(existing));
  if (!missing.length) return source;
  return source.slice(0, end) + ', ' + missing.map((rx) => rx.toString()).join(', ') + source.slice(end);
});

console.log('MKUU: current public-figure and social-information questions now route through Tavily.');
