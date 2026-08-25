const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.ts');
let source = fs.readFileSync(file, 'utf8');

const start = "  app.post('/api/chat/stream'";
const end = "  app.post('/api/agent'";
const startIndex = source.indexOf(start);
const endIndex = source.indexOf(end, startIndex);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('[STREAM] Could not locate /api/chat/stream route boundaries.');
}

const replacement = `  app.post('/api/chat/stream', async (req, res) => {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    try {
      const result = await processChatRequest(req);
      const text = String(result.reply || '');
      const chunks = text.match(/\\S+\\s*/g) || [text];
      for (const chunk of chunks) {
        if (res.writableEnded) break;
        res.write('data: ' + JSON.stringify({ type: 'delta', text: chunk }) + '\\n\\n');
        await new Promise(resolve => setTimeout(resolve, 24));
      }
      if (!res.writableEnded) {
        res.write('data: ' + JSON.stringify({ type: 'done', ...result }) + '\\n\\n');
        res.end();
      }
    } catch (e) {
      if (!res.writableEnded) {
        res.write('data: ' + JSON.stringify({ type: 'error', message: e?.message || 'Google Gemini API Error' }) + '\\n\\n');
        res.end();
      }
    }
  });
`;

source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
fs.writeFileSync(file, source);
console.log('[STREAM] Production SSE now emits replies word-by-word; spinner-free.');
