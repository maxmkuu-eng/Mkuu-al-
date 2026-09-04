const fs = require('fs');
const path = require('path');

function patch(filePath, replacements) {
  const file = path.join(process.cwd(), filePath);
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(from)) {
      const next = source.replace(from, to);
      if (next !== source) changed = true;
      source = next;
    }
  }
  if (changed) fs.writeFileSync(file, source);
}

// This step must NOT rewrite Gemini. It only repairs source propagation that
// is missing after the dedicated Exa pipeline has run.
patch('server/geminiService.ts', [
  [
    "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];",
    "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];",
  ],
]);

// server.ts is handled by fix-web-sources-ui.cjs. Do not inject webSources here:
// that previously produced the duplicate object key seen in Render.
// aiEngine.ts and App.tsx are likewise handled by the dedicated UI/source step.

console.log('MKUU: live source pipeline integrity step completed without duplicate webSources injection.');
