const fs = require('fs');
const path = require('path');

// Final build guard: never rewrite GeminiService. Only normalize the public
// server response so repeated historical source patches cannot create duplicate
// webSources keys in the generated bundle.
const file = path.join(process.cwd(), 'server.ts');
if (fs.existsSync(file)) {
  let source = fs.readFileSync(file, 'utf8');
  const responseStart = source.indexOf('return {reply:result.reply');
  const responseEnd = responseStart >= 0 ? source.indexOf('};', responseStart) : -1;
  if (responseStart >= 0 && responseEnd >= 0) {
    const response = source.slice(responseStart, responseEnd + 2);
    const first = response.indexOf('webSources:');
    if (first >= 0) {
      const second = response.indexOf('webSources:', first + 'webSources:'.length);
      if (second >= 0) {
        const beforeSecond = response.slice(0, second);
        const comma = beforeSecond.lastIndexOf(',');
        const afterSecond = response.slice(second);
        const afterValue = afterSecond.indexOf(',');
        const cleaned = afterValue >= 0 ? beforeSecond.slice(0, comma) + afterSecond.slice(afterValue) : beforeSecond + ';';
        source = source.slice(0, responseStart) + cleaned + source.slice(responseStart + response.length);
        fs.writeFileSync(file, source, 'utf8');
        console.log('[MKUU] Final response guard removed duplicate webSources key.');
      }
    }
  }
}
console.log('[MKUU] Final source guard complete; Gemini runtime untouched.');
