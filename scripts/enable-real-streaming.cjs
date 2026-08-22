const fs = require('fs');
const path = require('path');

const root = process.cwd();

function patch(filePath, transform, label) {
  const file = path.join(root, filePath);
  if (!fs.existsSync(file)) return console.log(`MKUU: ${label} skipped; ${filePath} not found.`);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`MKUU: ${label} enabled.`);
  } else {
    console.log(`MKUU: ${label} already enabled.`);
  }
}

patch('server/geminiService.ts', (s) => {
  if (s.includes('onChunk?: (text: string) => void')) return s;
  s = s.replace(
    'private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {',
    'private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string; onChunk?: (text: string) => void }): Promise<string> {'
  );
  const old = `const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });\n        const text = response.text;\n        if (text?.trim()) return text;`;
  const replacement = `let text = '';\n        if (params.onChunk) {\n          const stream = await client.models.generateContentStream({ model, contents: params.contents, config: params.config });\n          for await (const chunk of stream) {\n            const piece = chunk.text || '';\n            if (piece) {\n              text += piece;\n              params.onChunk(piece);\n            }\n          }\n        } else {\n          const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });\n          text = response.text || '';\n        }\n        if (text?.trim()) return text;`;
  if (!s.includes(old)) throw new Error('MKUU streaming patch: Gemini call block not found.');
  return s.replace(old, replacement);
}, 'real Gemini response streaming');

patch('server.ts', (s) => {
  if (s.includes('const processChatRequest = async (req:any, onText?: (text:string)=>void)')) return s;
  s = s.replace(
    'const processChatRequest = async (req:any) => {',
    'const processChatRequest = async (req:any, onText?: (text:string)=>void) => {'
  );
  const call = 'const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});';
  const callReplacement = 'const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments,onChunk:onText});';
  if (!s.includes(call)) throw new Error('MKUU streaming patch: processChat call not found.');
  s = s.replace(call, callReplacement);
  const oldEndpoint = "app.post('/api/chat/stream',async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});try{const result=await processChatRequest(req);res.write(`data: ${JSON.stringify({type:'delta',text:result.reply})}\\n\\n`);res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);res.end();}catch(e:any){res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\\n\\n`);res.end();}});";
  const newEndpoint = "app.post('/api/chat/stream',async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});try{const result=await processChatRequest(req,(text)=>{if(text)res.write(`data: ${JSON.stringify({type:'delta',text})}\\n\\n`);});res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);res.end();}catch(e:any){res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\\n\\n`);res.end();}});";
  if (!s.includes(oldEndpoint)) throw new Error('MKUU streaming patch: stream endpoint not found.');
  return s.replace(oldEndpoint, newEndpoint);
}, 'backend SSE token streaming');

patch('src/services/aiEngine.ts', (s) => {
  s = s.replace(
    "if (isCapacitorNative()) return callNativeServerChat(params);",
    "if (isCapacitorNative()) return streamServerChat(params);"
  );
  const oldBody = "body: JSON.stringify({ message: params.message, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [], attachments: params.attachments || [] })";
  const newBody = "body: JSON.stringify({ conversationId: params.conversationId, message: params.message, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [], attachments: params.attachments || [] })";
  return s.replace(oldBody, newBody);
}, 'native Android streaming chat path');

console.log('MKUU: real token-by-token response streaming enabled without changing chat/search routing.');
