import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import {
  Send, Mic, Crown, Plus, Paperclip, Camera, Image as ImageIcon, File, FileText,
  FileSpreadsheet, FileCode, Volume2, VolumeX, RefreshCw, X, Eye, Download,
  History, Trash2, WifiOff, HardDrive, Sparkles, MoreHorizontal, Square,
} from 'lucide-react';
import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';

interface ChatViewProps {
  messages: ChatMessage[]; conversationTitle?: string;
  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;
  onRetryMessage?: (message: ChatMessage) => Promise<any>; isLoading: boolean;
  onOpenVoice: () => void; onNewChat: () => void; onOpenHistory?: () => void;
  onDeleteMessage?: (messageId: string) => void; onOpenMemoryModal: () => void;
  onOpenFileGenerator: () => void; onPreviewDocument: (file: GeneratedFileSummary) => void;
  memories: Memory[]; people: Person[]; isOnline?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages, conversationTitle = 'Mkuu', onSendMessage, onRetryMessage, isLoading,
  onOpenVoice, onNewChat, onOpenHistory, onDeleteMessage, onOpenMemoryModal,
  onOpenFileGenerator, onPreviewDocument, memories, people, isOnline = true,
}) => {
  const [inputText, setInputText] = useState('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<AttachmentItem[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;
    const text = inputText.trim();
    const attachments = [...selectedAttachments];
    setInputText(''); setSelectedAttachments([]); setErrorMessage(null); setIsToolsOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try { await onSendMessage(text, false, attachments); }
    catch (err: any) { setErrorMessage(err?.message || 'Ujumbe haukuweza kutumwa.'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Faili limezidi uwezo wa 20MB.'); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = String(reader.result || '');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
      setSelectedAttachments((prev) => [...prev, {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        filename: file.name, fileType: ext, mimeType: file.type || 'application/octet-stream',
        size: file.size, base64Data, previewUrl: file.type.startsWith('image/') ? base64Data : undefined,
      }]);
      setErrorMessage(null); setIsToolsOpen(false);
    };
    reader.onerror = () => setErrorMessage('Picha au faili haikuweza kusomwa.');
    reader.readAsDataURL(file);
  };

  const playSpeech = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (playingMessageId === id) { window.speechSynthesis.cancel(); setPlayingMessageId(null); return; }
    window.speechSynthesis.cancel();
    const clean = text.replace(/#{1,6}\s+/g, '').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'sw-TZ'; utterance.rate = 0.95;
    utterance.onend = () => setPlayingMessageId(null);
    utterance.onerror = () => setPlayingMessageId(null);
    setPlayingMessageId(id); window.speechSynthesis.speak(utterance);
  };

  const getFileIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="h-4 w-4 text-red-400" />;
    if (type === 'xlsx' || type === 'csv') return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
    if (type === 'json') return <FileCode className="h-4 w-4 text-amber-400" />;
    return <File className="h-4 w-4 text-zinc-400" />;
  };

  const quickPrompts = [
    { title: 'Tengeneza picha', prompt: 'Tengeneza picha ya ' },
    { title: 'Andika kitu', prompt: 'Nisaidie kuandika ' },
    { title: 'Changanua faili', prompt: 'Changanua faili hili na ' },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#0b0b0b] text-zinc-100">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
      <input ref={documentInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.md,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />

      {/* ChatGPT-style minimal top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0b0b0b]/95 px-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
            <Crown className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{conversationTitle || 'Mkuu'}</div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenHistory && <button onClick={onOpenHistory} aria-label="Historia" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"><History className="h-4 w-4" /></button>}
          <button onClick={onNewChat} aria-label="Mazungumzo mapya" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"><Plus className="h-4 w-4" /></button>
          <button onClick={onOpenVoice} aria-label="Sauti" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-[#D4AF37]"><Volume2 className="h-4 w-4" /></button>
        </div>
      </header>

      {!isOnline && <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-[11px] text-amber-200"><WifiOff className="h-3.5 w-3.5 shrink-0" /> Mazungumzo yaliyopita yako salama kwenye kifaa. Majibu mapya yanahitaji intaneti.</div>}

      {/* Conversation canvas */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-36 pt-5 sm:px-6 sm:pt-8">
        <div className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center px-2 text-center">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Habari Max 👋</h1>
              <p className="max-w-lg text-sm leading-6 text-zinc-500">Mimi ni MKUU. Niambie unachohitaji—kuandika, kuchanganua, kutengeneza faili, au kufanya kazi na picha.</p>
              <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
                {quickPrompts.map((item) => <button key={item.title} onClick={() => { setInputText(item.prompt); textareaRef.current?.focus(); }} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-left text-xs text-zinc-300 transition hover:border-white/[0.14] hover:bg-white/[0.05]"><span className="font-medium">{item.title}</span><span className="mt-1 block truncate text-[10px] text-zinc-600">Anza kwa kubonyeza hapa</span></button>)}
              </div>
            </div>
          ) : messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} id={`chat-msg-${msg.id}`} className={`group mb-7 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex w-full gap-3 ${isUser ? 'max-w-[88%] flex-row-reverse sm:max-w-[78%]' : 'max-w-[100%]'} `}>
                  {!isUser && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]"><Crown className="h-3.5 w-3.5" /></div>}
                  <div className={`min-w-0 flex-1 ${isUser ? 'items-end' : ''}`}>
                    {msg.attachments?.length ? <div className={`mb-2 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>{msg.attachments.map((att, i) => <div key={i} className="overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.04]">{att.previewUrl ? <img src={att.previewUrl} alt={att.filename} className="max-h-56 max-w-[260px] object-cover" /> : <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300">{getFileIcon(att.fileType)}<span className="max-w-[180px] truncate">{att.filename}</span></div>}</div>)}</div> : null}
                    {msg.content && <div className={isUser ? 'ml-auto w-fit max-w-full rounded-3xl rounded-br-lg bg-[#2f2f2f] px-4 py-3 text-sm leading-6 text-zinc-100' : 'prose prose-invert max-w-none text-sm leading-7 text-zinc-200 prose-p:my-2 prose-headings:text-zinc-100 prose-a:text-[#D4AF37] prose-code:text-[#e6c75a]'}><Markdown>{msg.content}</Markdown></div>}

                    {msg.generatedFiles?.length ? <div className="mt-3 space-y-2">{msg.generatedFiles.map((file) => <div key={file.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3"><div className="flex min-w-0 items-center gap-3">{getFileIcon(file.fileType)}<div className="min-w-0"><div className="truncate text-xs font-medium text-zinc-200">{file.filename}</div><div className="text-[10px] text-zinc-500">{file.fileType.toUpperCase()}</div></div></div><div className="flex shrink-0 gap-1"><button onClick={() => onPreviewDocument(file)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"><Eye className="h-4 w-4" /></button><a href={file.downloadUrl} download={file.filename} className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-[#D4AF37]"><Download className="h-4 w-4" /></a></div></div>)}</div> : null}

                    {msg.webSources?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{msg.webSources.slice(0, 6).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-400 hover:text-[#D4AF37]">{source.title}</a>)}</div> : null}

                    <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-600 ${isUser ? 'justify-end' : ''}`}>
                      {msg.savedOffline && <span className="flex items-center gap-1 text-emerald-500"><HardDrive className="h-2.5 w-2.5" /> Saved Local</span>}
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isUser && <button onClick={() => playSpeech(msg.id, msg.content)} className="rounded-md p-1 hover:bg-white/[0.06] hover:text-zinc-300" title="Soma kwa sauti">{playingMessageId === msg.id ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}</button>}
                      {onRetryMessage && msg.isError && <button onClick={() => onRetryMessage(msg)} className="rounded-md p-1 hover:bg-white/[0.06] hover:text-[#D4AF37]" title="Jaribu tena"><RefreshCw className="h-3 w-3" /></button>}
                      {onDeleteMessage && <button onClick={() => onDeleteMessage(msg.id)} className="rounded-md p-1 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-red-400" title="Futa"><Trash2 className="h-3 w-3" /></button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {isLoading && <div className="mb-7 flex items-start gap-3"><div className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]"><Crown className="h-3.5 w-3.5" /></div><div className="flex items-center gap-1.5 pt-2"><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" /></div></div>}
          {errorMessage && <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">{errorMessage}</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ChatGPT-style floating composer */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/95 to-transparent px-3 pb-3 pt-10 sm:px-5 sm:pb-5">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          {selectedAttachments.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{selectedAttachments.map((att, i) => <div key={i} className="relative shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[#171717]">{att.previewUrl ? <img src={att.previewUrl} alt={att.filename} className="h-16 w-16 object-cover" /> : <div className="flex h-16 w-28 items-center gap-2 px-2 text-[10px] text-zinc-300">{getFileIcon(att.fileType)}<span className="truncate">{att.filename}</span></div>}<button onClick={() => setSelectedAttachments((prev) => prev.filter((_, x) => x !== i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button></div>)}</div>}

          {isToolsOpen && <div className="mb-2 flex w-fit items-center gap-1 rounded-2xl border border-white/[0.08] bg-[#171717] p-1.5 shadow-2xl"><button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"><ImageIcon className="h-4 w-4" /> Picha</button><button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"><Camera className="h-4 w-4" /> Kamera</button><button onClick={() => documentInputRef.current?.click()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"><Paperclip className="h-4 w-4" /> Faili</button></div>}

          <form onSubmit={handleSend} className="flex items-end gap-2 rounded-[26px] border border-white/[0.1] bg-[#171717] px-2 py-2 shadow-2xl shadow-black/40 transition focus-within:border-white/[0.18]">
            <button type="button" onClick={() => setIsToolsOpen((v) => !v)} aria-label="Ongeza" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-100"><Plus className="h-5 w-5" /></button>
            <textarea ref={textareaRef} value={inputText} onChange={(e) => { setInputText(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }} onKeyDown={handleKeyDown} rows={1} placeholder="Andika ujumbe wako..." className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-zinc-100 outline-none placeholder:text-zinc-500" />
            <button type="button" onClick={onOpenVoice} aria-label="Sauti" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-100"><Mic className="h-5 w-5" /></button>
            <button type="submit" disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">{isLoading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button>
          </form>
          <div className="mt-2 text-center text-[10px] text-zinc-600">MKUU inaweza kufanya makosa. Hakikisha taarifa muhimu.</div>
        </div>
      </div>
    </div>
  );
};