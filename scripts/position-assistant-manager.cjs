const fs = require('fs');
const path = require('path');

const root = process.cwd();
const appPath = path.join(root, 'src', 'App.tsx');
const chatPath = path.join(root, 'src', 'components', 'ChatView.tsx');

function patch(filePath, patches, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { needle, replacement, description } of patches) {
    if (source.includes(replacement)) continue;
    if (!source.includes(needle)) {
      throw new Error(`MKUU: ${label} insertion point not found: ${description}`);
    }
    source = source.replace(needle, replacement);
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, source);
}

patch(chatPath, [
  {
    needle: '  onOpenVoice: () => void; onNewChat: () => void; onOpenHistory?: () => void;\n',
    replacement: '  onOpenVoice: () => void; onNewChat: () => void; onOpenHistory?: () => void; onOpenManager?: () => void;\n',
    description: 'ChatView manager callback prop',
  },
  {
    needle: '  onOpenVoice, onNewChat, onOpenHistory, onDeleteMessage, onOpenMemoryModal,\n',
    replacement: '  onOpenVoice, onNewChat, onOpenHistory, onOpenManager, onDeleteMessage, onOpenMemoryModal,\n',
    description: 'ChatView manager callback destructuring',
  },
  {
    needle: '          {onOpenHistory && <button id="chat-open-history-btn"',
    replacement: '          {onOpenManager && <button id="chat-assistant-manager-btn" onClick={onOpenManager} className="px-2.5 sm:px-3 py-1.5 rounded-xl glass hover:bg-white/5 text-xs font-semibold text-[#888888] hover:text-[#D4AF37] flex items-center space-x-1.5 transition border border-[#222222] cursor-pointer" title="Fungua Assistant Manager"><Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /><span className="hidden sm:inline">Assistant Manager</span></button>}\n          {onOpenHistory && <button id="chat-open-history-btn"',
    description: 'Chat header manager button beside chat history',
  },
], 'ChatView');

patch(appPath, [
  {
    needle: "import { ChatView } from './components/ChatView';\n",
    replacement: "import { ChatView } from './components/ChatView';\nimport { AssistantManager } from './components/AssistantManager';\n",
    description: 'AssistantManager import',
  },
  {
    needle: '            onOpenHistory={() => setActiveTab(\'history\')}\n',
    replacement: '            onOpenHistory={() => setActiveTab(\'history\')}\n            onOpenManager={() => setActiveTab(\'manager\')}\n',
    description: 'ChatView manager navigation callback',
  },
  {
    needle: "        {activeTab === 'security' && (\n",
    replacement: "        {activeTab === 'manager' && <AssistantManager />}\n\n        {activeTab === 'security' && (\n",
    description: 'Assistant Manager page render',
  },
], 'App');

console.log('MKUU: Assistant Manager moved to Chat header beside Recently Chat/history button.');
