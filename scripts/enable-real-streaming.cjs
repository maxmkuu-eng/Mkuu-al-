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
  // Add the streaming callback to the public chat params once.
  if (!s.includes('onChunk?: (text: string) => void;')) {
    const marker = '  people?: Person[];\n';
    if (!s.includes(marker)) throw new Error('MKUU streaming patch: ProcessChatParams marker not found.');
    s = s.replace(marker, marker + '  onChunk?: (text: string) => void;\n');
  }

  // Make processChat accept the callback and pass it to every Gemini generation path.
  s = s.replace(
    'const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;',
    'const { userId, message, conversationHistory = [], isVoice = false, attachments = [], onChunk } = params;'
  );

  // Make the low-level Gemini call capable of yielding real chunks.
  s = s.replace(
    'private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {',
    'private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string; onChunk?: (text: string) => void }): Promise<string> {'
  );

  const old = `const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });\n        const text = response.text;\n        if (text?.trim()) return text;`;
  const replacement = `let text = '';\n        if (params.onChunk) {\n          const stream = await client.models.generateContentStream({ model, contents: params.contents, config: params.config });\n          for await (const chunk of stream) {\n            const piece = chunk.text || '';\n            if (piece) {\n              text += piece;\n              params.onChunk(piece);\n            }\n          }\n        } else {\n          const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });\n          text = response.text || '';\n        }\n        if (text?.trim()) return text;`;
  if (s.includes(old)) s = s.replace(old, replacement);

  // Ensure all Gemini calls made by processChat can receive the stream callback.
  s = s.replace(
    'preferredModel: PERSONAL_CHAT_MODEL,\n        });',
    'preferredModel: PERSONAL_CHAT_MODEL,\n          onChunk,\n        });'
  );
  s = s.replace(
    'preferredModel: usedModel,\n          });',
    'preferredModel: usedModel,\n            onChunk,\n          });'
  );
  s = s.replace(
    'preferredModel: PERSONAL_CHAT_MODEL });',
    'preferredModel: PERSONAL_CHAT_MODEL, onChunk });'
  );
  s = s.replace(
    'preferredModel: LIVE_SEARCH_MODEL,\n            });',
    'preferredModel: LIVE_SEARCH_MODEL,\n              onChunk,\n            });'
  );

  return s;
}, 'real Gemini response streaming');

patch('server.ts', (s) => {
  s = s.replace(
    'const processChatRequest = async (req:any) => {',
    'const processChatRequest = async (req:any, onText?: (text:string)=>void) => {'
  );
  s = s.replace(
    'const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});',
    'const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments,onChunk:onText});'
  );

  const oldEndpoint = "app.post('/api/chat/stream',async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});try{const result=await processChatRequest(req);res.write(`data: ${JSON.stringify({type:'delta',text:result.reply})}\\n\\n`);res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);res.end();}catch(e:any){res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\\n\\n`);res.end();}});";
  const newEndpoint = "app.post('/api/chat/stream',async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});if(typeof res.flushHeaders==='function')res.flushHeaders();try{const result=await processChatRequest(req,(text)=>{if(text)res.write(`data: ${JSON.stringify({type:'delta',text})}\\n\\n`);});res.write(`data: ${JSON.stringify({type:'done',...result})}\\n\\n`);res.end();}catch(e:any){res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\\n\\n`);res.end();}});";
  if (s.includes(oldEndpoint)) s = s.replace(oldEndpoint, newEndpoint);
  return s;
}, 'backend SSE token streaming');

patch('src/services/aiEngine.ts', (s) => {
  // Android must use the actual SSE route; the old native route waits for the full response.
  s = s.replace(
    'if (isCapacitorNative()) return callNativeServerChat(params);',
    'if (isCapacitorNative()) return streamServerChat(params);'
  );

  // Preserve conversation persistence and metadata through the streaming endpoint.
  const oldBody = 'body: JSON.stringify({ message: params.message, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [], attachments: params.attachments || [] })';
  const newBody = 'body: JSON.stringify({ conversationId: params.conversationId, message: params.message, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [], attachments: params.attachments || [] })';
  s = s.replace(oldBody, newBody);

  // Parse the final SSE event so the native result retains server metadata.
  s = s.replace(
    "let reply = '';\n  emitStream('', false);",
    "let reply = '';\n  let finalPayload: any = null;\n  emitStream('', false);"
  );
  s = s.replace(
    "if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'error')",
    "if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }\n        if (payload.type === 'done') finalPayload = payload;\n        if (payload.type === 'error')"
  );
  s = s.replace(
    "return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
    "return { reply, cleanSpeechText: finalPayload?.cleanSpeechText || reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), memoriesExtracted: finalPayload?.memoriesExtracted, peopleRecognized: finalPayload?.peopleRecognized, generatedFiles: finalPayload?.generatedFiles, engineUsed: 'server', aiProvider: finalPayload?.aiProvider || 'Google Gemini', chatModel: finalPayload?.chatModel || 'gemini-3.7-flash', intent: finalPayload?.intent || 'chat' };"
  );
  return s;
}, 'native Android streaming chat path');

console.log('MKUU: real token-by-token response streaming enabled for backend and Android without changing chat/search routing.');
