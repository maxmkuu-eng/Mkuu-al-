const fs = require('fs');
const path = require('path');

function patchFile(relative, transform) {
  const file = path.join(process.cwd(), relative);
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

// Backend: current/public-figure/social questions are LIVE WEB requests.
// IMPORTANT: live-search answers must bypass Gemini/Tavily entirely and use Exa directly.
patchFile('server/geminiService.ts', (source) => {
  if (!source.includes("import { searchWithExa } from './exaSearch.js';")) {
    source = source.replace(
      "import { searchWithTavily } from './tavilySearch.js';",
      "import { searchWithTavily } from './tavilySearch.js';\nimport { searchWithExa } from './exaSearch.js';"
    );
  }

  source = source.replace(
    "const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;",
    "const usedModel = isSearchQuery ? 'Exa Live Search' : PERSONAL_CHAT_MODEL;"
  );

  // Replace only the top-level live-search branch. This prevents any Gemini
  // generation call, Google Search tool, or Tavily fallback from running for
  // live/social questions.
  const start = source.indexOf('    if (isSearchQuery) {');
  const elseMarker = start >= 0 ? source.indexOf('\n    } else {', start) : -1;
  if (start < 0 || elseMarker < 0) throw new Error('MKUU: live-search branch marker not found.');

  const branchEnd = elseMarker + '\n    }'.length;
  const liveBranch = `    if (isSearchQuery) {\n      try {\n        const tz = getCurrentTanzaniaTimeContext();\n        const exaQuery = [\n          String(message || '').trim(),\n          '',\n          'LIVE SEARCH POLICY:',\n          '- Answer ONLY the exact question asked by the user.',\n          '- Use Exa live web/social search evidence only; do not use model memory.',\n          '- Current Tanzania date/time: ' + tz.formattedString,\n          '- If the user says jana/yesterday/juzi/leo, resolve it using Tanzania local date above.',\n          '- Never substitute an older event, old article, old match, or historical person for the requested date.',\n          '- For social-media questions, prefer the requested official/public post or profile evidence.',\n          '- For sports result questions, require the completed final result for the requested date.',\n          '- If Exa cannot verify the exact requested fact, say it could not be verified instead of guessing.',\n        ].join('\\n');\n\n        console.log('[MKUU-BACKEND] [EXA_LIVE_SEARCH_STARTED] Gemini is bypassed for live/social search.');\n        const exaResult = await searchWithExa(exaQuery);\n        aiReplyText = String(exaResult.answer || '').trim();\n        if (!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no verified answer.');\n        console.log('[MKUU-BACKEND] [EXA_LIVE_SEARCH_SUCCESS] Direct Exa answer returned.');\n      } catch (exaErr: any) {\n        const exaMsg = String(exaErr?.message || exaErr);\n        console.error('[MKUU-BACKEND] [EXA_LIVE_SEARCH_FAILED]', exaMsg);\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${exaMsg}\`);\n      }\n    }`;

  source = source.slice(0, start) + liveBranch + source.slice(branchEnd);

  // Never label a direct Exa answer as Gemini.
  source = source.replace(
    "aiProvider: AI_PROVIDER,\n      chatModel: usedModel,",
    "aiProvider: isSearchQuery ? 'Exa Live Search' : AI_PROVIDER,\n      chatModel: usedModel,"
  );

  return source;
});

// Backend request wrapper: remove the old Google wording from the live-search hint.
patchFile('server.ts', (source) => {
  return source.replace(
    'Tafuta Google na uthibitishe taarifa za sasa kabla ya kujibu.',
    'Tafuta mtandaoni kupitia Exa na uthibitishe taarifa za sasa kabla ya kujibu.'
  );
});

// Agent path: remove the old Tavily instruction. geminiService now routes the
// actual live request directly to Exa and never calls Gemini for that branch.
patchFile('server/agentEngine.ts', (source) => {
  return source.replace(
    '[LIVE_WEB_SEARCH_REQUIRED — Tumia Tavily kupata taarifa mpya kabla ya kujibu]',
    '[LIVE_WEB_SEARCH_REQUIRED — Tumia Exa kupata taarifa mpya kabla ya kujibu]'
  );
});

// Client: make current/public-figure/social questions live-search requests.
patchFile('src/services/aiEngine.ts', (source) => {
  const marker = '  const changingFactPatterns = [';
  const index = source.indexOf(marker);
  if (index >= 0) {
    const end = source.indexOf('  ];', index);
    if (end >= 0) {
      const additions = [
        /\bamejifungua\b/, /\bamepata mtoto\b/, /\bujauzito\b/, /\bpregnan\w*\b/, /\bbaby\b/, /\bbirth\b/, /\bzuchu\b/, /\bdiamond\b/, /\bmsanii\b/, /\bcelebrity\b/, /\bsocial media\b/, /\binstagram\b/, /\bfacebook\b/, /\btiktok\b/, /\byoutube\b/, /\btwitter\b/, /\bx\.com\b/, /\bofficial statement\b/, /\bpost ya\b/, /\bstatement ya\b/, /\bwhat happened\b/, /\bnani ni\b/
      ];
      const existing = source.slice(index, end);
      const missing = additions.filter((rx) => !rx.test(existing));
      if (missing.length) source = source.slice(0, end) + ', ' + missing.map((rx) => rx.toString()).join(', ') + source.slice(end);
    }
  } else {
    console.log('MKUU: client changingFactPatterns marker already changed; skipping that patch.');
  }

  // Client: make the active chat request cancellable without changing routing.
  if (!source.includes('let activeMkuuChatAbortController: AbortController | null = null;')) {
    const marker2 = "let streamPreview = '';";
    if (source.includes(marker2)) source = source.replace(marker2, `${marker2}\n\nlet activeMkuuChatAbortController: AbortController | null = null;\n\nexport function cancelMkuuChat(): void { activeMkuuChatAbortController?.abort(); }`);
  }
  source = source.replace(
    "fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })",
    "fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: activeMkuuChatAbortController?.signal })"
  );
  source = source.replace(
    "const response = await apiFetch<any>(endpoint, {\n    method: 'POST',",
    "const response = await apiFetch<any>(endpoint, {\n    method: 'POST',\n    signal: activeMkuuChatAbortController?.signal,"
  );
  source = source.replace(
    "const serverRes = await apiFetch<any>('/api/chat', {\n    method: 'POST',",
    "const serverRes = await apiFetch<any>('/api/chat', {\n    method: 'POST',\n    signal: activeMkuuChatAbortController?.signal,"
  );
  const execMarker = 'export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {\n';
  if (source.includes(execMarker) && !source.includes('activeMkuuChatAbortController = new AbortController();')) source = source.replace(execMarker, `${execMarker}  activeMkuuChatAbortController = new AbortController();\n`);
  return source;
});

// UI: expose a dedicated Stop action while the AI request is running.
patchFile('src/components/ChatView.tsx', (source) => {
  if (!source.includes("import { cancelMkuuChat } from '../services/aiEngine';")) source = source.replace("import { getApiUrl } from '../services/apiConfig';", "import { getApiUrl } from '../services/apiConfig';\nimport { cancelMkuuChat } from '../services/aiEngine';");
  source = source.replace("if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;", "if (isLoading) { cancelMkuuChat(); window.dispatchEvent(new Event('mkuu-stop-generation')); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;");
  source = source.replace("<Send className=\"w-5 h-5\" />", "{isLoading ? <X className=\"w-5 h-5\" /> : <Send className=\"w-5 h-5\" />}");
  source = source.replace("catch (err: any) { setErrorMessage(err.message || 'Ujumbe haukuweza kutumwa.'); }", "catch (err: any) { if (err?.name === 'AbortError' || err?.code === 'CHAT_CANCELLED') return; setErrorMessage(err.message || 'Ujumbe haukuweza kutumwa.'); }");
  return source;
});

// App: release loading state immediately when Stop is pressed.
patchFile('src/App.tsx', (source) => {
  if (!source.includes("import { cancelMkuuChat } from './services/aiEngine';")) source = source.replace("import { executeMkuuChat } from './services/aiEngine';", "import { executeMkuuChat, cancelMkuuChat } from './services/aiEngine';");
  if (!source.includes("window.addEventListener('mkuu-stop-generation'")) {
    const marker = "  // Safe JSON fetch helper with remote URL resolution";
    const block = `  useEffect(() => {\n    const stopGeneration = () => { cancelMkuuChat(); setIsLoading(false); };\n    window.addEventListener('mkuu-stop-generation', stopGeneration);\n    return () => window.removeEventListener('mkuu-stop-generation', stopGeneration);\n  }, []);\n\n`;
    if (source.includes(marker)) source = source.replace(marker, block + marker);
  }
  return source;
});

// apiFetch already accepts RequestInit.signal; preserve AbortError instead of retrying it.
patchFile('src/services/apiConfig.ts', (source) => {
  const marker = "    }catch(e:any){clearTimeout(t);last=e instanceof MkuuApiError?e:new MkuuApiError";
  if (source.includes(marker) && !source.includes("if(options?.signal?.aborted)throw e;")) source = source.replace(marker, "    }catch(e:any){if(options?.signal?.aborted)throw e;clearTimeout(t);last=e instanceof MkuuApiError?e:new MkuuApiError");
  return source;
});

console.log('MKUU: live/social search is now direct Exa; Gemini/Tavily/Google Search are bypassed for live requests.');
console.log('MKUU: Tanzania real-time date/time context and relative-date guard enabled.');
console.log('MKUU: response Stop control patched without changing other features.');
