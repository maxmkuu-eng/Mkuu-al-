const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/services/aiEngine.ts');
if (!fs.existsSync(file)) throw new Error('[CHAT] src/services/aiEngine.ts not found.');
let source = fs.readFileSync(file, 'utf8');

const startMarker = 'async function streamServerChat(params:ChatEngineParams):Promise<ChatEngineResult>{';
const endMarker = 'export async function executeMkuuChat';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('[CHAT] Could not locate streamServerChat boundaries.');

const replacement = `async function streamServerChat(params:ChatEngineParams):Promise<ChatEngineResult>{
 const endpoint='/api/chat';
 let serverRes:any;
 try {
   serverRes=await apiFetch<any>(endpoint,{method:'POST',signal:params.signal,body:JSON.stringify({conversationId:params.conversationId,message:params.message,isVoice:params.isVoice,attachments:params.attachments||[],conversationHistory:(params.conversationHistory||[]).slice(-10),people:params.people||[]})},45000);
 } catch(e:any) {
   throw e instanceof MkuuApiError ? e : new MkuuApiError({code:'BACKEND_UNREACHABLE',userMessage:'SEVA YA MKUU HAIPATIKANI\\nTafadhali jaribu tena.',technicalDetails:e?.message||'Failed to fetch',targetUrl:getApiUrl(endpoint)});
 }
 const reply=String(serverRes?.reply||'');
 if(!reply.trim()) throw new MkuuApiError({code:'BACKEND_UNREACHABLE',status:502,userMessage:'SEVA YA MKUU HAIPATIKANI\\nTafadhali jaribu tena.',technicalDetails:'JSON /api/chat returned an empty reply',targetUrl:getApiUrl(endpoint)});
 // Transport is JSON for reliability. The UI reveal is client-side word-by-word,
 // so reverse proxies never have to keep an SSE socket open.
 emitStream('',false);
 const words=reply.match(/\\S+\\s*/g)||[reply];
 for(const word of words){
   if(params.signal?.aborted){emitStream('',true);throw new DOMException('Aborted','AbortError');}
   emitStream(word,false);
   await new Promise(resolve=>setTimeout(resolve,28));
 }
 emitStream('',true);
 return {reply,cleanSpeechText:serverRes.cleanSpeechText||reply.replace(/[#*_~[\\]()]/g,' ').replace(/\\s+/g,' ').trim(),memoriesExtracted:serverRes.memoriesExtracted,peopleRecognized:serverRes.peopleRecognized,generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:serverRes.aiProvider||'Google Gemini',chatModel:serverRes.chatModel||'gemini-3.7-flash',intent:serverRes.intent||'chat'};
}
`;

source = source.slice(0,start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[CHAT] JSON /api/chat transport enabled; SSE removed from client path; word-by-word UI reveal enabled.');
