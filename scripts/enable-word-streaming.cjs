const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.ts');
if (!fs.existsSync(file)) {
  console.error('[STREAM] server.ts not found; preserving build');
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');
const startMarker = "  app.post('/api/chat/stream'";
const endMarker = "  app.post('/api/agent'";
const start = source.indexOf(startMarker);
const end = start >= 0 ? source.indexOf(endMarker, start) : -1;

if (start < 0 || end < 0) {
  console.log('[STREAM] SSE endpoint marker not found; preserving existing implementation');
  process.exit(0);
}

const replacement = `  app.post('/api/chat/stream',async(req,res)=>{\n    res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});\n    if (typeof (res).flushHeaders === 'function') (res).flushHeaders();\n    try {\n      const result=await processChatRequest(req);\n      const text=String(result.reply||'');\n      const words=text.match(/\\S+\\s*/g)||[];\n      for (const word of words) {\n        res.write(\`data: \${JSON.stringify({type:'delta',text:word})}\\n\\n\`);\n        if (typeof (res).flush === 'function') res.flush();\n        await new Promise(resolve=>setTimeout(resolve,28));\n      }\n      res.write(\`data: \${JSON.stringify({type:'done',...result})}\\n\\n\`);\n      if (typeof (res).flush === 'function') res.flush();\n      res.end();\n    } catch(e) {\n      res.write(\`data: \${JSON.stringify({type:'error',message:e?.message||'Google Gemini API Error'})}\\n\\n\`);\n      res.end();\n    }\n  });\n`;

fs.writeFileSync(file, source.slice(0, start) + replacement + source.slice(end), 'utf8');
console.log('[STREAM] Word-by-word SSE streaming enabled.');
