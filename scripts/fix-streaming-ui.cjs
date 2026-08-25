const fs = require('fs');
const path = require('path');

const chatFile = path.join(process.cwd(), 'src/components/ChatView.tsx');
if (!fs.existsSync(chatFile)) process.exit(0);
const chat = fs.readFileSync(chatFile, 'utf8');
const old = `{isLoading && <div className="flex items-start space-x-3 max-w-[85%]"><div className="w-8 h-8 rounded-xl glass border border-[#222222] text-[#D4AF37] flex items-center justify-center flex-shrink-0"><Crown className="w-4 h-4 animate-bounce" /></div><div className="p-3.5 rounded-2xl glass border border-[#222222] border-l-2 border-[#D4AF37] text-xs text-[#888888] flex items-center space-x-2 rounded-tl-none serif italic"><RefreshCw className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" /><span>MKUU AI anachakata na kutafakari...</span></div></div>}`;
const replacement = `{isLoading && <div id="mkuu-stream-status" className="flex items-start space-x-3 max-w-[85%]"><div className="w-8 h-8 rounded-xl glass border border-[#222222] text-[#D4AF37] flex items-center justify-center flex-shrink-0"><Crown className="w-4 h-4" /></div><div className="p-3.5 rounded-2xl glass border border-[#222222] border-l-2 border-[#D4AF37] text-xs text-[#D4AF37] rounded-tl-none serif italic"><span>MKUU AI anaandika...</span></div></div>}`;
if (chat.includes(old)) {
  fs.writeFileSync(chatFile, chat.replace(old, replacement), 'utf8');
  console.log('[STREAM-UI] Removed spinning loader.');
} else {
  console.log('[STREAM-UI] Spinner marker already patched or not found.');
}
