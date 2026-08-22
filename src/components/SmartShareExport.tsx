import React, { useState } from 'react';
import { Copy, Download, FileText, Image as ImageIcon, Share2, Check, X } from 'lucide-react';
import { clientGenerateFile, downloadFileHelper } from '../services/clientFileGenerator';

interface SmartShareExportProps {
  title: string;
  content: string;
}

function cleanContent(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~#`>]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function shareText(title: string, content: string): Promise<void> {
  const text = cleanContent(content);
  if (!text) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: `MKUU AI — ${title}`, text });
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
    }
  }
  await navigator.clipboard?.writeText(text);
}

async function shareAsImage(title: string, content: string): Promise<void> {
  const text = cleanContent(content);
  if (!text) return;
  const canvas = document.createElement('canvas');
  const width = 1080;
  const padding = 72;
  const lineHeight = 42;
  const maxChars = 48;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, 55);
  canvas.width = width;
  canvas.height = Math.max(520, 190 + visibleLines.length * lineHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(padding, 120, width - padding * 2, 4);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('MKUU AI', padding, 72);
  ctx.fillStyle = '#888888';
  ctx.font = '20px sans-serif';
  ctx.fillText(title.slice(0, 65), padding, 108);
  ctx.fillStyle = '#F5F2ED';
  ctx.font = '24px sans-serif';
  visibleLines.forEach((item, index) => ctx.fillText(item, padding, 170 + index * lineHeight));
  ctx.fillStyle = '#666666';
  ctx.font = '16px sans-serif';
  ctx.fillText(`MKUU AI • ${new Date().toLocaleDateString('sw-TZ')}`, padding, canvas.height - 28);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  if (!blob) return;
  const filename = `mkuu-${Date.now()}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ title: `MKUU AI — ${title}`, files: [file] });
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  await downloadFileHelper({ filename, downloadUrl: url, mimeType: 'image/png' });
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const SmartShareExport: React.FC<SmartShareExportProps> = ({ title, content }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!content?.trim()) return null;

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setDone(key);
      setTimeout(() => setDone(null), 1600);
    } catch (error) {
      console.warn('[MKUU] Smart Share/Export failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const exportFile = async (fileType: 'pdf' | 'docx') => {
    const result = await clientGenerateFile({
      title: title || 'MKUU AI Response',
      fileType,
      contentPrompt: cleanContent(content),
      description: `Jibu la MKUU AI lililotolewa tarehe ${new Date().toLocaleDateString('sw-TZ')}`,
    });
    await downloadFileHelper({
      filename: result.file.filename,
      base64Data: result.base64Data,
      downloadUrl: result.base64Data,
      mimeType: result.file.mimeType,
    });
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        className="px-2.5 py-1.5 rounded-xl glass hover:bg-white/5 text-[11px] font-semibold text-[#888888] hover:text-[#D4AF37] border border-[#222222] flex items-center gap-1.5 transition disabled:opacity-50"
        title="Shiriki au Export jibu la MKUU"
      >
        {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />}
        <span>{done ? 'Imefanyika' : 'Share'}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-[#333333] bg-[#101010] p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-[#666666]">MKUU Share & Export</span>
            <button type="button" onClick={() => setOpen(false)} className="text-[#666666] hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          <button type="button" onClick={() => run('Shared', () => shareText(title, content))} className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-xs text-[#F5F2ED] flex items-center gap-2"><Share2 className="w-4 h-4 text-[#D4AF37]" /> Share Text</button>
          <button type="button" onClick={() => run('Copied', async () => navigator.clipboard?.writeText(cleanContent(content)))} className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-xs text-[#F5F2ED] flex items-center gap-2"><Copy className="w-4 h-4 text-[#D4AF37]" /> Copy Clean Answer</button>
          <button type="button" onClick={() => run('Image', () => shareAsImage(title, content))} className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-xs text-[#F5F2ED] flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#D4AF37]" /> Share as Image</button>
          <button type="button" onClick={() => run('PDF', () => exportFile('pdf'))} className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-xs text-[#F5F2ED] flex items-center gap-2"><Download className="w-4 h-4 text-[#D4AF37]" /> Export PDF</button>
          <button type="button" onClick={() => run('Word', () => exportFile('docx'))} className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-xs text-[#F5F2ED] flex items-center gap-2"><FileText className="w-4 h-4 text-[#D4AF37]" /> Export Word</button>
        </div>
      )}
    </div>
  );
};
