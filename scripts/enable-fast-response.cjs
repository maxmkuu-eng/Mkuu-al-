const fs = require('fs');

function replaceOnce(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(to)) {
    console.log(`[FAST] ${label}: already enabled`);
    return;
  }
  if (!source.includes(from)) {
    throw new Error(`[FAST] ${label}: insertion/replacement point not found in ${path}`);
  }
  fs.writeFileSync(path, source.replace(from, to));
  console.log(`[FAST] ${label}: enabled`);
}

const gemini = 'server/geminiService.ts';
replaceOnce(gemini,
  "  'gemini-3.6-flash',\n];",
  "  'gemini-flash-latest',\n];",
  'Gemini resilient fallback cascade');
replaceOnce(gemini,
  "httpOptions: { headers: { 'User-Agent': 'mkuu-ai-backend-gemini-service' } }",
  "httpOptions: { headers: { 'User-Agent': 'mkuu-ai-backend-gemini-service' }, timeout: 90000 }",
  'Gemini 90s upstream timeout');
replaceOnce(gemini,
  "const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });",
  "const response = await Promise.race([\n          client.models.generateContent({ model, contents: params.contents, config: params.config }),\n          new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini request timeout after 90000ms (${model})`)), 90000)),\n        ]);",
  'Gemini request timeout guard');

const client = 'src/services/aiEngine.ts';
replaceOnce(client,
  "if(isCapacitorNative())return callNativeServerChat(params);",
  "if(isCapacitorNative())return streamServerChat(params);",
  'Android chat uses resilient SSE stream');
replaceOnce(client,
  "body:JSON.stringify({message:params.message,conversationHistory:(params.conversationHistory||[]).slice(-10),people:params.people||[],attachments:params.attachments||[]})",
  "body:JSON.stringify({conversationId:params.conversationId,message:params.message,conversationHistory:(params.conversationHistory||[]).slice(-10),people:params.people||[],attachments:params.attachments||[]})",
  'Streaming conversation continuity');

const server = 'server.ts';
replaceOnce(server,
  "app.use(express.urlencoded({ extended:true, limit:'50mb' }));",
  "app.use(express.urlencoded({ extended:true, limit:'50mb' }));\n  app.use((_req,res,next)=>{res.setTimeout(90000);next();});",
  '90s request timeout');
replaceOnce(server,
  "res.write(`data: ${JSON.stringify({type:'delta',text:result.reply})}\\n\\n`); res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`); res.end();",
  "const text=result.reply||''; const chunkSize=48; for(let i=0;i<text.length;i+=chunkSize){res.write(`data: ${JSON.stringify({type:'delta',text:text.slice(i,i+chunkSize)})}\\n\\n`); await new Promise(r=>setTimeout(r,8));} res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`); res.end();",
  'Fluid SSE delta delivery');

console.log('[FAST] MKUU fast-response configuration complete.');
