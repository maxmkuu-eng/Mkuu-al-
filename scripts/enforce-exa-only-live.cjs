const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(file)) throw new Error('[EXA-ONLY] server/geminiService.ts not found');

let source = fs.readFileSync(file, 'utf8');

// Tavily is not part of MKUU's runtime architecture.
source = source.replace(/import \{ searchWithTavily \} from '\.\/tavilySearch\.js';\n?/g, '');
if (!source.includes("import { searchWithExa } from './exaSearch.js';")) {
  source = source.replace("import { generateRealFile } from './files.js';", "import { generateRealFile } from './files.js';\nimport { searchWithExa } from './exaSearch.js';");
}

// Gemini 3.x no longer accepts legacy sampling fields such as temperature.
// Remove them at build time so all generated server builds use a valid Gemini 3.x config.
source = source.replace(/const generationConfig:\s*any\s*=\s*\{\s*systemInstruction:\s*systemPrompt,\s*temperature:\s*0\.7\s*\};/g, 'const generationConfig: any = { systemInstruction: systemPrompt };');
source = source.replace(/temperature:\s*0\.7,?\s*/g, '');
source = source.replace(/temperature:\s*0\.2,?\s*/g, '');

// The Gemini service itself must also be safe if called directly: live search is Exa-only.
const liveStart = source.indexOf('    if (isSearchQuery) {');
const fileIntentMarker = source.indexOf('    if (fileIntent) {', liveStart);
if (liveStart < 0 || fileIntentMarker < 0) throw new Error('[EXA-ONLY] Live-search block target not found');

const liveBlock = `    if (isSearchQuery) {
      try {
        const tanzaniaNow = getCurrentTanzaniaTimeContext();
        console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live/social search is Exa-direct; Gemini/Tavily/Google Search are not used.');
        const exaResult = await searchWithExa(\`${'${message}'}\\nCURRENT TANZANIA TIME: \${tanzaniaNow.formattedString}\`);
        aiReplyText = String(exaResult?.answer || '').trim();
        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no direct answer.');
        console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] directAnswer=true citations=\${exaResult?.citations?.length || 0}\`);
      } catch (exaErr: any) {
        const exaMsg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] \${exaMsg}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${exaMsg}\`);
      }
    } else {
      try {
        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });
        console.log(\`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model=\"\${PERSONAL_CHAT_MODEL}\" latency=\${Date.now() - startTime}ms status=200\`);
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        console.error(\`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error=\"\${errMsg}\" latency=\${Date.now() - startTime}ms\`);
        const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Rate limit') || errMsg.includes('exceeded your current quota');
        if (isRateLimit) {
          aiReplyText = 'Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';
        } else {
          throw new Error(\`Google Gemini API (\${PERSONAL_CHAT_MODEL}) Error: \${err?.message || 'Huduma haikupatikana kwa sasa'}\`);
        }
      }
    }

`;
source = source.slice(0, liveStart) + liveBlock + source.slice(fileIntentMarker);

// Never fall back from ordinary Gemini answers into Google Search grounding.
source = source.replace(/\n\s*if \(this\.isInsufficientKnowledgeResponse\(aiReplyText\)\) \{[\s\S]*?\n\s*\}\n\s*console\.log\(\`\[MKUU-BACKEND\] \[GEMINI_RESPONSE_RECEIVED\]/, '\n        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED]');
source = source.replace(/export const LIVE_SEARCH_MODEL = '[^']+';/, "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");

// Make backend health truthful: a failed Gemini configuration/request is not "connected".
source = source.replace(
  /return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};\n    \} catch \(err: any\) \{\n      return \{ aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date\.now\(\) - startTime \};/,
  "return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };\n    } catch (err: any) {\n      const message = String(err?.message || err || 'Gemini unavailable');\n      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - startTime, error: message };")
;

fs.writeFileSync(file, source, 'utf8');

// Distinguish Exa failures from Gemini failures at the public API boundary.
const serverFile = path.join(process.cwd(), 'server.ts');
if (fs.existsSync(serverFile)) {
  let server = fs.readFileSync(serverFile, 'utf8');
  const oldHandler = "res.status(503).json({error:'GEMINI_UNAVAILABLE',message:error.message||'Google Gemini API Error',aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});";
  const newHandler = "const errorMessage=String(error?.message||'Google Gemini API Error');const isLiveSearchError=/LIVE_SEARCH_UNAVAILABLE|EXA_SEARCH_/i.test(errorMessage);res.status(503).json({error:isLiveSearchError?'EXA_UNAVAILABLE':'GEMINI_UNAVAILABLE',message:errorMessage,aiProvider:isLiveSearchError?'Exa Live Search':AI_PROVIDER,chatModel:isLiveSearchError?'Exa':PERSONAL_CHAT_MODEL});";
  if (server.includes(oldHandler)) server = server.replace(oldHandler, newHandler);
  fs.writeFileSync(serverFile, server, 'utf8');
}

console.log('[EXA-ONLY] Live/social queries use Exa only; normal chat uses Gemini; Gemini 3.x legacy temperature fields removed; Tavily and Google Search live fallbacks removed; health/error reporting fixed.');