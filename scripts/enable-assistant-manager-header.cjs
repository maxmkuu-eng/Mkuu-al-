const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
let source = fs.readFileSync(file, 'utf8');

const importNeedle = "import { getApiUrl } from '../services/apiConfig';";
if (!source.includes("from './AssistantManager'")) {
  if (!source.includes(importNeedle)) throw new Error('MKUU: ChatView Assistant Manager import point not found.');
  source = source.replace(importNeedle, `${importNeedle}\nimport AssistantManager from './AssistantManager';`);
}

const stateNeedle = "const [errorMessage, setErrorMessage] = useState<string | null>(null);";
if (!source.includes('isAssistantManagerOpen')) {
  if (!source.includes(stateNeedle)) throw new Error('MKUU: ChatView Assistant Manager state point not found.');
  source = source.replace(stateNeedle, `${stateNeedle}\n  const [isAssistantManagerOpen, setIsAssistantManagerOpen] = useState(false);`);
}

const historyButton = "{onOpenHistory && <button id=\"chat-open-history-btn\"";
if (!source.includes('chat-assistant-manager-btn')) {
  if (!source.includes(historyButton)) throw new Error('MKUU: Chat header history button not found.');
  source = source.replace(historyButton, `{<button id="chat-assistant-manager-btn" onClick={() => setIsAssistantManagerOpen(true)} className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-xs font-semibold text-[#D4AF37] flex items-center space-x-1.5 transition border border-[#D4AF37]/40 cursor-pointer" title="Fungua Assistant Manager"><Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Assistant Manager</span></button>}\n          ${historyButton}`);
}

const headerEnd = '</header>';
const overlay = `</header>\n\n      {isAssistantManagerOpen && <div className="absolute inset-0 top-14 sm:top-16 z-30 bg-[#07090e] border-t border-[#222222]">\n        <div className="absolute top-2 right-3 z-40"><button onClick={() => setIsAssistantManagerOpen(false)} className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer">Funga</button></div>\n        <AssistantManager />\n      </div>}`;
if (!source.includes('isAssistantManagerOpen && <div')) {
  if (!source.includes(headerEnd)) throw new Error('MKUU: Chat header closing point not found.');
  source = source.replace(headerEnd, overlay);
}

fs.writeFileSync(file, source);
console.log('MKUU: Assistant Manager header button enabled; legacy lower button remains removed.');
