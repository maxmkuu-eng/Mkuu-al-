const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, value) { fs.writeFileSync(path.join(root, rel), value, 'utf8'); }
function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`[LIVE-WEB] Patch target not found: ${label}`);
  return next;
}

// ---------------------------------------------------------------------------
// 1) Backend: Exa is the single live-web/social retrieval layer. Gemini only
//    synthesizes the retrieved evidence. This prevents stale Gemini memory,
//    Tavily leftovers, and direct-client Gemini routing from bypassing Exa.
// ---------------------------------------------------------------------------
let gemini = read('server/geminiService.ts');
gemini = gemini.replace("import { searchWithTavily } from './tavilySearch.js';", "import { searchWithExa } from './exaSearch.js';");
gemini = gemini.replace("  latencyMs: number;\n}", "  latencyMs: number;\n  webSources?: Array<{ title: string; url: string }>;\n}");

gemini = replaceOnce(
  gemini,
  /    \/\/ Tavily is the primary live-search provider[\\s\\S]*?    \} else \{/,
  `    // Exa is the authoritative live-web/social retrieval layer. Gemini is used\n    // only to synthesize the fresh evidence returned by Exa.\n    if (isSearchQuery) {\n      try {\n        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live web/social grounding via Exa.');\n        const exa = await searchWithExa(\
          \`${message}\\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}\`,\n        );\n        const webSources = exa.citations || [];\n        const sourceText = webSources\n          .map((s, i) => `${i + 1}. ${s.title} — ${s.url}`)\n          .join('\\n');\n        const groundedSystemPrompt = `${systemPrompt}\\n\\nLIVE WEB EVIDENCE (EXA):\\n${exa.answer}\\n\\nLIVE SOURCE LIST (EXA):\\n${sourceText}\\n\\nSTRICT LIVE-WEB RULES:\\n- Treat the supplied Exa evidence as the primary and current evidence.\\n- Give the user the concrete answer first, then the important supporting details.\\n- For social-media questions, distinguish an actual post/profile/video from an article reporting about it. State the platform and account/post context when the evidence supports it.\\n- Use multiple independent sources when available; do not rely on one weak snippet when stronger evidence is present.\\n- Prefer official accounts, government sources, clubs, leagues, verified organizations, and primary statements over reposts or commentary.\\n- Respect the requested date (leo/jana/juzi/etc.) and Tanzania time.\\n- For sports, give opponent, competition, venue, kick-off/result and score when the evidence contains them. Never substitute an older fixture or preview for a completed result.\\n- For current public officials, prefer the newest authoritative government evidence and never revive a former office holder from stale memory.\\n- If sources disagree, explain the conflict and identify which evidence is newer/stronger.\\n- Never invent names, scores, dates, posts, quotes, or events not supported by the evidence.\\n- Do not answer “hakuna taarifa” merely because one result is weak; inspect the supplied evidence and sources first.\\n`,\n        );\n        const groundedContents = this.buildConversationHistory(\n          conversationHistory,\n          `${message}\\n\\n[MKUU EXA LIVE EVIDENCE]\\n${exa.answer}\\n\\n[MKUU EXA SOURCES]\\n${sourceText}`,\n          attachments,\n        );\n        aiReplyText = await this.executeGeminiCallWithFallback({\n          contents: groundedContents,\n          config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 },\n          preferredModel: PERSONAL_CHAT_MODEL,\n        });\n        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Exa search.');\n        console.log(\n          \`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] sources=\${webSources.length} latency=\${Date.now() - startTime}ms\`,\n        );\n      } catch (exaErr) {\n        const exaMsg = String(exaErr?.message || exaErr);\n        console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] \${exaMsg}\`);\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live web/social search failed. \${exaMsg}\`);\n      }\n    } else {`,
  'Tavily live-search block',
);

gemini = replaceOnce(
  gemini,
  "      webSources?: Array<{ title: string; url: string }>;",
  "      webSources?: Array<{ title: string; url: string }>;",
  'webSources interface guard',
);

// The previous replacement needs the variable initialized before the search branch.
gemini = replaceOnce(
  gemini,
  "    let aiReplyText = '';",
  "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];",
  'webSources initialization',
);

gemini = replaceOnce(
  gemini,
  "        const webSources = exa.citations || [];",
  "        webSources = exa.citations || [];",
  'webSources assignment',
);

gemini = replaceOnce(
  gemini,
  "      latencyMs: Date.now() - startTime,\n    };",
  "      latencyMs: Date.now() - startTime,\n      webSources,\n    };",
  'webSources result',
);

// Health must report the real state. The old catch returned connected even when
// Gemini was unavailable, which masked the exact failure shown in the app.
gemini = replaceOnce(
  gemini,
  "      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };\n    } catch (err: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };",
  "      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };\n    } catch (err: any) {\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: String(err?.message || err) };",
  'Gemini health catch',
);
write('server/geminiService.ts', gemini);

// ---------------------------------------------------------------------------
// 2) Exa: make social-media search explicit and platform-aware. Search still
//    returns ordinary web evidence when the user asks for general web search.
// ---------------------------------------------------------------------------
let exa = read('server/exaSearch.ts');
exa = replaceOnce(
  exa,
  "  const data=await response.json() as any;const raw=Array.isArray(data?.results)?data.results:[];",
  "  const data=await response.json() as any;const raw=Array.isArray(data?.results)?data.results:[];",
  'Exa response anchor',
);

// Insert platform filters immediately after body construction.
exa = replaceOnce(
  exa,
  "  const body:any={query:sports&&finalResult?`${q}\\nFINAL RESULT ONLY: ${requestedDate}`:q,type:fresh?'fast':'auto',numResults:sports?12:(fresh?12:8),contents:{highlights:true,text:true}};",
  "  const body:any={query:sports&&finalResult?`${q}\\nFINAL RESULT ONLY: ${requestedDate}`:q,type:fresh?'fast':'auto',numResults:sports?12:(fresh?12:8),contents:{highlights:true,text:true}};\n  if(social){\n    const socialDomains:string[]=[];\n    if(/\\binstagram\\b|\\binsta\\b/i.test(query)) socialDomains.push('instagram.com');\n    if(/\\bfacebook\\b|\\bfb\\b/i.test(query)) socialDomains.push('facebook.com');\n    if(/\\btiktok\\b/i.test(query)) socialDomains.push('tiktok.com');\n    if(/\\b(?:twitter|x\\.com)\\b/i.test(query)) socialDomains.push('x.com','twitter.com');\n    if(/\\byoutube\\b/i.test(query)) socialDomains.push('youtube.com');\n    if(!socialDomains.length) socialDomains.push('instagram.com','facebook.com','tiktok.com','x.com','twitter.com','youtube.com');\n    body.includeDomains=[...new Set(socialDomains)];\n    body.query=`${q}\\nSOCIAL MEDIA EVIDENCE: find the actual public post/profile/video or the most direct platform evidence. Return concrete post details, account identity, date/time and engagement facts when indexed. Prefer official/verified accounts and primary posts over articles discussing them.`;\n  }",
  'Exa social-domain routing',
);
write('server/exaSearch.ts', exa);

// ---------------------------------------------------------------------------
// 3) Client: live/social questions must never bypass the backend Exa pipeline,
//    even when a direct Gemini API key is stored on the device.
// ---------------------------------------------------------------------------
let engine = read('src/services/aiEngine.ts');
engine = replaceOnce(
  engine,
  "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[]; engineUsed:'server'|'direct_gemini'; aiProvider?:string; chatModel?:string; intent?:string; }",
  "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>; engineUsed:'server'|'direct_gemini'; aiProvider?:string; chatModel?:string; intent?:string; }",
  'ChatEngineResult webSources',
);
engine = replaceOnce(
  engine,
  "return{reply:serverRes.reply,cleanSpeechText:serverRes.cleanSpeechText||serverRes.reply,memoriesExtracted:serverRes.memoriesExtracted,peopleRecognized:serverRes.peopleRecognized,generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:serverRes.aiProvider||'Google Gemini',chatModel:serverRes.chatModel||'gemini-3.7-flash',intent:serverRes.intent||'chat'};",
  "return{reply:serverRes.reply,cleanSpeechText:serverRes.cleanSpeechText||serverRes.reply,memoriesExtracted:serverRes.memoriesExtracted,peopleRecognized:serverRes.peopleRecognized,generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:serverRes.aiProvider||'Google Gemini',chatModel:serverRes.chatModel||'gemini-3.7-flash',intent:serverRes.intent||'chat'};",
  'native server webSources',
);
engine = replaceOnce(
  engine,
  "const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let reply='';",
  "const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let reply='';let webSources:Array<{title:string;url:string}>=[];",
  'stream webSources state',
);
engine = replaceOnce(
  engine,
  "if(payload.type==='error')throw new Error(payload.message||'Streaming error');",
  "if(payload.type==='done'&&Array.isArray(payload.webSources))webSources=payload.webSources;if(payload.type==='error')throw new Error(payload.message||'Streaming error');",
  'stream done webSources',
);
engine = replaceOnce(
  engine,
  "return{reply,cleanSpeechText:reply.replace(/[#*`_~[\\]()]/g,' ').replace(/\\s+/g,' ').trim(),engineUsed:'server',aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'};",
  "return{reply,cleanSpeechText:reply.replace(/[#*`_~[\\]()]/g,' ').replace(/\\s+/g,' ').trim(),webSources,engineUsed:'server',aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'};",
  'stream result webSources',
);
engine = replaceOnce(
  engine,
  "export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{const smsCommand=await handleDirectSmsCommand(params);if(smsCommand)return smsCommand;if(needsImageRoute(params))return callImageStudio(params);const directApiKey=getStoredGeminiApiKey();",
  "export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{const smsCommand=await handleDirectSmsCommand(params);if(smsCommand)return smsCommand;if(needsImageRoute(params))return callImageStudio(params);if(needsLiveSearch(params.message)){if(isCapacitorNative())return callNativeServerChat(params);return streamServerChat(params);}const directApiKey=getStoredGeminiApiKey();",
  'live-search route before direct Gemini',
);
write('src/services/aiEngine.ts', engine);

// ---------------------------------------------------------------------------
// 4) App persistence: retain Exa source cards with the assistant message.
// ---------------------------------------------------------------------------
let app = read('src/App.tsx');
app = replaceOnce(
  app,
  "        generatedFiles: processedFiles,\n        memoryExtracted:",
  "        generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:",
  'App webSources persistence',
);
write('src/App.tsx', app);

// ---------------------------------------------------------------------------
// 5) Backend response/persistence: return and store webSources for both JSON
//    and SSE clients. /api/chat/stream already spreads the result on done.
// ---------------------------------------------------------------------------
let server = read('server.ts');
server = replaceOnce(
  server,
  "generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)",
  "generatedFiles:result.generatedFiles,webSources:result.webSources||[],memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)",
  'server conversation webSources',
);
server = replaceOnce(
  server,
  "generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs",
  "generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs",
  'server chat response webSources',
);
write('server.ts', server);

console.log('[LIVE-WEB] Complete Exa web + social grounding pipeline applied.');
console.log('[LIVE-WEB] Live/social requests are forced through backend Exa; Gemini only synthesizes Exa evidence.');
console.log('[LIVE-WEB] Exa citations are returned to UI as clickable webSources.');
