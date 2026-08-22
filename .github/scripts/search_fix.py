from pathlib import Path
import re

p=Path('server/geminiService.ts')
s=p.read_text()
s=s.replace("export const LIVE_SEARCH_MODEL = 'gemini-3.6-flash';","export const LIVE_SEARCH_MODEL = PERSONAL_CHAT_MODEL;")
m=re.search(r"const searchKeywords = \[(.*?)\];",s,re.S)
if not m: raise SystemExit('searchKeywords array not found')
if 'amejifungua' not in m.group(1):
    extra="'amejifungua','amepata mtoto','ujauzito','pregnancy','baby','birth','zuchu','diamond','msanii','celebrity','social media','instagram','facebook','tiktok','youtube','twitter','x.com','official statement','today','latest','current','sasa','leo','hivi punde','nani ni','who is','what happened','price','cost','salary','appointed','resigned','died'"
    s=s[:m.start(1)]+m.group(1)+','+extra+s[m.end(1):]

start=s.find('        const groundedSystemPrompt =')
end=s.find('        if (!aiReplyText?.trim())',start)
if start<0 or end<0: raise SystemExit('Tavily synthesis block not found')
block='''        const groundedSystemPrompt = `Wewe ni MKUU AI. LIVE TAVILY EVIDENCE ndiyo chanzo pekee cha taarifa za sasa. Usitumie conversation history, MAX memory, Google Search, browsing, au maarifa ya zamani ya model kuthibitisha current facts. Usibuni dai lisilothibitishwa na evidence. Kama evidence haitoshi, sema wazi kuwa ushahidi wa kuaminika haujatosha. Chagua chanzo kipya na chenye mamlaka zaidi pale vyanzo vinapotofautiana. Jibu kwa Kiswahili fasaha.`;\n        const groundedContents = [{ role: 'user' as const, parts: [{ text: `${message}\\n\\n[LIVE TAVILY EVIDENCE — USE THIS ONLY]\\n${tavilyResults}` }] }];\n        aiReplyText = await this.executeGeminiCallWithFallback({ contents: groundedContents, config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 }, preferredModel: LIVE_SEARCH_MODEL, authoritativeTavily: true });\n'''
s=s[:start]+block+s[end:]
start=s.find('        // Secondary fallback: Google Search grounding.')
end=s.find('      }\n\n      console.log',start)
if start<0 or end<0: raise SystemExit('Google fallback not found')
s=s[:start]+"        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily search failed; refusing stale Gemini answer. ${tavilyMsg}`);\n"+s[end:]
start=s.find('        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {')
end=s.find('        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED]',start)
if start>=0 and end>=0: s=s[:start]+s[end:]
s=s.replace("private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {","private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string; authoritativeTavily?: boolean }): Promise<string> {",1)
s=s.replace("const modelsToTry = params.config?.tools ? [preferred] : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];","const modelsToTry = params.authoritativeTavily ? [preferred] : (params.config?.tools ? [preferred] : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)]);",1)
p.write_text(s)

p=Path('server.ts');s=p.read_text()
if 'getLastTavilySources' not in s:
 s=s.replace("import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';","import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';\nimport { getLastTavilySources } from './server/tavilySearch.js';",1)
start=s.find('    // Current/changing facts must be grounded with live Google Search.');end=s.find('    const result=await geminiService.processChat',start)
if start>=0 and end>=0:s=s[:start]+s[end:]
s=s.replace('message:searchMessage,conversationHistory:effectiveHistory','message,conversationHistory:effectiveHistory',1)
s=s.replace('latencyMs:result.latencyMs};','latencyMs:result.latencyMs,webSources:getLastTavilySources()};',1)
p.write_text(s)

p=Path('src/services/aiEngine.ts');s=p.read_text()
s=s.replace("  if (directApiKey && directApiKey.trim().length > 10) return callDirectGemini(directApiKey.trim(), params);","  if (directApiKey && directApiKey.trim().length > 10 && !needsLiveSearch(params.message)) return callDirectGemini(directApiKey.trim(), params);",1)
s=s.replace("  intent?: string;\n}","  intent?: string;\n  webSources?: Array<{ title: string; url: string }>;\n}",1)
s=s.replace("    intent: serverRes.intent || 'chat',\n  };","    intent: serverRes.intent || 'chat',\n    webSources: serverRes.webSources || [],\n  };",1)
p.write_text(s)
