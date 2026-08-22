const fs = require('fs');
const path = require('path');

function patchFile(relative, transform) {
  const file = path.join(process.cwd(), relative);
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

// Backend: classify current public-figure/social questions as live-search requests.
patchFile('server/geminiService.ts', (source) => {
  const match = source.match(/const searchKeywords = \[(.*?)\];/s);
  if (!match) throw new Error('MKUU: searchKeywords array marker not found.');
  const extras = [
    'amejifungua', 'amepata mtoto', 'mtoto wa', 'ujauzito', 'pregnancy', 'pregnant',
    'baby', 'birth', 'zuchu', 'diamond', 'msanii', 'celebrity', 'artist', 'singer',
    'actor', 'actress', 'social media', 'instagram', 'facebook', 'tiktok', 'youtube',
    'twitter', 'x.com', 'official statement', 'post ya', 'statement ya', 'today',
    'yesterday', 'tomorrow', 'what happened', 'nani ni', 'who is', 'price', 'cost',
    'salary', 'appointed', 'resigned', 'died', 'death'
  ];
  let body = match[1];
  for (const term of extras) if (!body.includes(`'${term}'`)) body += `,'${term}'`;
  const bodyStart = match.index + match[0].indexOf(match[1]);
  return source.slice(0, bodyStart) + body + source.slice(bodyStart + match[1].length);
});

// Client: make the same questions live-search requests when the marker exists.
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

console.log('MKUU: current public-figure and social-information questions now route through Tavily.');
console.log('MKUU: response Stop control patched without changing other features.');
