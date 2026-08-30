const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(file)) throw new Error('[EXA-ONLY] server/geminiService.ts not found');

let source = fs.readFileSync(file, 'utf8');

// Live/social search must never be answered by Gemini, Tavily, or Google Search.
source = source.replace(/import \{ searchWithTavily \} from '\.\/tavilySearch\.js';\n?/g, '');
if (!source.includes("import { searchWithExa } from './exaSearch.js';")) {
  source = source.replace("import { generateRealFile } from './files.js';", "import { generateRealFile } from './files.js';\nimport { searchWithExa } from './exaSearch.js';");
}

const liveStart = source.indexOf('    if (isSearchQuery) {');
const fileIntentMarker = source.indexOf('    if (fileIntent) {', liveStart);
if (liveStart < 0 || fileIntentMarker < 0) {
  throw new Error('[EXA-ONLY] Live-search block target not found');
}

const liveBlock = `    if (isSearchQuery) {\n      try {\n        const tanzaniaNow = getCurrentTanzaniaTimeContext();\n        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live/social search is Exa-direct; Gemini is not used.');\n        const exaResult = await searchWithExa(\`${'${message}'}\\nCURRENT TANZANIA TIME: \${tanzaniaNow.formattedString}\`);\n        aiReplyText = String(exaResult?.answer || '').trim();\n        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no direct answer.');\n        console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] directAnswer=true citations=\${exaResult?.citations?.length || 0}\`);\n      } catch (exaErr: any) {\n        const exaMsg = String(exaErr?.message || exaErr);\n        console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] \${exaMsg}\`);\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${exaMsg}\`);\n      }\n    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });\n        console.log(\`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model=\"\${PERSONAL_CHAT_MODEL}\" latency=\${Date.now() - startTime}ms status=200\`);\n      } catch (err: any) {\n        const errMsg = String(err?.message || err);\n        console.error(\`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error=\"\${errMsg}\" latency=\${Date.now() - startTime}ms\`);\n        const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Rate limit') || errMsg.includes('exceeded your current quota');\n        if (isRateLimit) {\n          aiReplyText = 'Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';\n        } else {\n          throw new Error(\`Google Gemini API (\${PERSONAL_CHAT_MODEL}) Error: \${err?.message || 'Huduma haikupatikana kwa sasa'}\`);\n        }\n      }\n    }\n\n`;

source = source.slice(0, liveStart) + liveBlock + source.slice(fileIntentMarker);

// Never fall back from ordinary Gemini answers into Google Search grounding.
source = source.replace(/\n\s*if \(this\.isInsufficientKnowledgeResponse\(aiReplyText\)\) \{[\s\S]*?\n\s*\}\n\s*console\.log\(\`\[MKUU-BACKEND\] \[GEMINI_RESPONSE_RECEIVED\]/, '\n        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED]');

source = source.replace(/export const LIVE_SEARCH_MODEL = '[^']+';/, "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");

fs.writeFileSync(file, source, 'utf8');
console.log('[EXA-ONLY] Live/social queries now use Exa directly; Gemini/Tavily/Google Search are excluded from the live-search path.');
