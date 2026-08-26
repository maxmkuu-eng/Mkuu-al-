const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
const source = fs.readFileSync(file, 'utf8');

if (source.includes('id="mkuu-web-sources"')) {
  console.log('MKUU: Web sources UI already formatted; skipping.');
  process.exit(0);
}

const marker = '<div className="flex items-center space-x-3 px-2 text-[10px] text-[#888888]"><span>MKUU AI • {new Date(msg.timestamp).toLocaleTimeString([], { hour: \'2-digit\', minute: \'2-digit\' })}</span>';

if (!source.includes(marker)) {
  console.error('MKUU: Web sources UI insertion point not found.');
  process.exit(1);
}

const block = `{msg.webSources && msg.webSources.length > 0 && <div id="mkuu-web-sources" className="mt-4 pt-3 border-t border-[#222222] not-italic font-sans w-full"><div className="flex items-center justify-between mb-2.5"><span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider">Vyanzo</span><span className="text-[9px] text-[#666666] uppercase tracking-wider">{msg.webSources.length} source{msg.webSources.length === 1 ? '' : 's'}</span></div><div className="space-y-2">{msg.webSources.map((source, idx) => <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 p-2.5 rounded-xl bg-[#111111]/80 border border-[#222222] hover:border-[#D4AF37]/40 hover:bg-white/[0.03] transition-colors no-underline"><span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] flex items-center justify-center text-[11px] font-bold flex-shrink-0">{idx + 1}</span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#F5F2ED] group-hover:text-[#D4AF37] truncate">{source.title || source.url}</span><span className="block text-[9px] text-[#666666] truncate mt-0.5">{source.url.replace(/^https?:\\/\\//, '').split('/')[0]}</span></span><span className="text-[#666666] group-hover:text-[#D4AF37] text-sm flex-shrink-0">↗</span></a>)}</div></div>}`;

const updated = source.replace(marker, `${block}${marker}`);
fs.writeFileSync(file, updated);
console.log('MKUU: Numbered web sources UI enabled.');
