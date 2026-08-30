const fs=require('fs');
const path=require('path');
const root=process.cwd();
function patch(file,fn){const p=path.join(root,file);if(!fs.existsSync(p))throw new Error('[MKUU FINAL] missing '+file);const before=fs.readFileSync(p,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(p,after);console.log('[MKUU FINAL] patched '+file);}else console.log('[MKUU FINAL] unchanged '+file);}

patch('server/geminiService.ts',s=>{
  s=s.replace("import { searchWithTavily } from './tavilySearch.js';","import { searchWithExa } from './exaSearch.js';");
  const start=s.indexOf('    // IMPORTANT: Current-information questions must be grounded in fresh web data.');
  const branchElse=s.indexOf('    } else {',start);
  if(start<0||branchElse<0)throw new Error('[MKUU FINAL] live branch markers not found');
  const block=`    // LIVE WEB / SOCIAL SEARCH IS EXA-ONLY. Gemini is never used on this path.\n    if (isSearchQuery) {\n      try {\n        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Direct live/social search.');\n        const exaResult = await searchWithExa(\`${'${message}'}\\nCURRENT TANZANIA DATE/TIME: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\`);\n        aiReplyText = exaResult.answer;\n        if (!aiReplyText?.trim()) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable answer.');\n        console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] citations=\${exaResult.citations.length} latency=\${Date.now()-startTime}ms\`);\n      } catch (exaErr) {\n        const exaMsg=String(exaErr?.message||exaErr);\n        console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] \${exaMsg}\`);\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${exaMsg}\`);\n      }\n`;
  s=s.slice(0,start)+block+s.slice(branchElse);
  s=s.replace("const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;","const usedModel = isSearchQuery ? 'Exa Live Search' : PERSONAL_CHAT_MODEL;");
  const timeAnchor="    const isSearchQuery = this.detectSearchIntent(message);";
  if(!s.includes("const isClockQuestion"))s=s.replace(timeAnchor,"    const isClockQuestion = /\\b(saa ngapi|ni saa|muda wa sasa|leo ni siku gani|tarehe ya leo|leo tarehe ngapi|date today|current time|time now)\\b/i.test(String(message||''));\n"+timeAnchor);
  s=s.replace("    let aiReplyText = '';","    let aiReplyText = '';\n\n    if (isClockQuestion) {\n      const clock = getCurrentTanzaniaTimeContext();\n      aiReplyText = `Kwa Tanzania, sasa ni saa ${clock.timeString}, ${clock.dayOfWeek} ${clock.dateString}.`;\n    }");
  s=s.replace("    if (isSearchQuery) {","    if (!isClockQuestion && isSearchQuery) {",1);
  s=s.replace("      aiProvider: AI_PROVIDER,\n      chatModel: usedModel,","      aiProvider: isClockQuestion ? 'MKUU Tanzania Clock' : (isSearchQuery ? 'Exa' : AI_PROVIDER),\n      chatModel: isClockQuestion ? 'Africa/Dar_es_Salaam' : usedModel,");
  return s;
});

patch('server/agentEngine.ts',s=>{
  if(!s.includes("import { searchWithExa } from './exaSearch.js';"))s=s.replace("import { geminiService } from './geminiService.js';","import { geminiService } from './geminiService.js';\nimport { searchWithExa } from './exaSearch.js';");
  const old="    let liveAwareMessage = request.message;\n    if (isLiveWebQuestion(request.message)) {\n      liveAwareMessage = `[LIVE_WEB_SEARCH_REQUIRED — Tumia Tavily kupata taarifa mpya kabla ya kujibu]\\ntafuta mtandaoni: ${request.message}`;\n    }\n    const result = await geminiService.processChat({ userId: request.userId, message: liveAwareMessage, conversationHistory: request.conversationHistory || [], isVoice: request.isVoice, attachments: request.attachments || [] });\n    return { intent, reply: result.reply, cleanSpeechText: result.cleanSpeechText, generatedFiles: result.generatedFiles || [], memoriesExtracted: result.memoriesExtracted || [], peopleRecognized: result.peopleRecognized || [], aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: Date.now() - started };";
  if(s.includes(old))s=s.replace(old,"    if (isLiveWebQuestion(request.message)) {\n      const live = await searchWithExa(request.message);\n      return { intent, reply: live.answer, cleanSpeechText: live.answer, generatedFiles: [], memoriesExtracted: [], peopleRecognized: [], aiProvider: 'Exa', chatModel: 'Exa Live Search', latencyMs: Date.now() - started };\n    }\n    const result = await geminiService.processChat({ userId: request.userId, message: request.message, conversationHistory: request.conversationHistory || [], isVoice: request.isVoice, attachments: request.attachments || [] });\n    return { intent, reply: result.reply, cleanSpeechText: result.cleanSpeechText, generatedFiles: result.generatedFiles || [], memoriesExtracted: result.memoriesExtracted || [], peopleRecognized: result.peopleRecognized || [], aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: Date.now() - started };");
  return s;
});

patch('server/exaSearch.ts',s=>s.replace("import { GoogleGenAI } from '@google/genai';\n\n",''));

patch('src/services/aiEngine.ts',s=>{
  if(!s.includes('let activeMkuuAbortController'))s=s.replace("let streamPreview='';","let activeMkuuAbortController: AbortController | null = null;\nexport function stopMkuuGeneration(): void { try { activeMkuuAbortController?.abort(); } catch {} activeMkuuAbortController = null; }\n\nlet streamPreview='';");
  const fn='export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{';
  const idx=s.indexOf(fn);if(idx<0)throw new Error('[MKUU FINAL] executeMkuuChat not found');
  const after=idx+fn.length;
  if(!s.slice(after,after+300).includes('activeMkuuAbortController'))s=s.slice(0,after)+"const controller=new AbortController(); activeMkuuAbortController=controller; params={...params,signal:controller.signal};"+s.slice(after);
  s=s.replace("if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);","if(directApiKey&&directApiKey.trim().length>10){if(needsLiveSearch(params.message))return callNativeServerChat(params);return callDirectGemini(directApiKey.trim(),params);}");
  return s;
});

patch('src/components/ChatView.tsx',s=>{
  if(!s.includes("from '../services/smartSpeech'"))s=s.replace("import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';","import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';\nimport { stopMkuuGeneration } from '../services/aiEngine';");
  const oldStart="  const playSpeech = (id: string, text: string) => {";
  const oldEnd="  };\n\n  const getFileIcon";
  const a=s.indexOf(oldStart),b=s.indexOf(oldEnd,a);
  if(a>=0&&b>=0){const replacement="  const playSpeech = async (id: string, text: string) => {\n    if (playingMessageId === id) { await stopSmartSpeech(); setPlayingMessageId(null); return; }\n    try { setPlayingMessageId(id); await speakSmart(text, 'sw-TZ'); } catch (error) { console.warn('[MKUU SPEAKER]', error); } finally { setPlayingMessageId(null); }\n  };\n\n";s=s.slice(0,a)+replacement+s.slice(b+oldEnd.length);}
  s=s.replace('<button type="submit" disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma"','<button type="button" onClick={() => { if (isLoading) { stopMkuuGeneration(); void stopSmartSpeech(); } else { void handleSend(); } }} disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} aria-label={isLoading ? "Simamisha" : "Tuma"}');
  return s;
});

patch('src/components/AutoReplyCenter.tsx',s=>s.replace('onClick={handleEmergencyStopClick}onClick={onEmergencyStopToggle}','onClick={handleEmergencyStopClick}'));

patch('src/App.tsx',s=>{
  const old="    } catch (e: any) {\n      console.error('Chat execution error:', e);";
  const neu="    } catch (e: any) {\n      if (e?.name === 'AbortError' || e?.code === 'ABORT_ERR') { console.log('[MKUU] Generation stopped by user.'); return { reply: '', cleanSpeechText: '' }; }\n      console.error('Chat execution error:', e);";
  if(s.includes(old)&&!s.includes('Generation stopped by user'))s=s.replace(old,neu);
  return s;
});

console.log('[MKUU FINAL] Runtime integration fixes complete.');
