import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Mic,
  Crown,
  User,
  Brain,
  Users,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Plus,
  File,
  Settings,
  Paperclip,
  Image,
  Camera,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  History,
  Trash2,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';
import { downloadFileHelper } from '../services/clientFileGenerator';
import { getApiUrl } from '../services/apiConfig';

interface ChatViewProps {
  messages: ChatMessage[];
  conversationTitle?: string;
  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;
  onRetryMessage?: (message: ChatMessage) => Promise<any>;
  isLoading: boolean;
  onOpenVoice: () => void;
  onNewChat: () => void;
  onOpenHistory?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenMemoryModal: () => void;
  onOpenFileGenerator: () => void;
  onPreviewDocument: (file: GeneratedFileSummary) => void;
  memories: Memory[];
  people: Person[];
  isOnline?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  conversationTitle = 'Mkuu Chat',
  onSendMessage,
  onRetryMessage,
  isLoading,
  onOpenVoice,
  onNewChat,
  onOpenHistory,
  onDeleteMessage,
  onOpenMemoryModal,
  onOpenFileGenerator,
  onPreviewDocument,
  memories,
  people,
  isOnline = true,
}) => {
  const [inputText, setInputText] = useState('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<AttachmentItem[]>([]);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;

    const textToSend = inputText;
    const attachmentsToSend = [...selectedAttachments];

    setInputText('');
    setSelectedAttachments([]);
    setErrorMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(textToSend, false, attachmentsToSend);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ujumbe haukuweza kutumwa.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File Selection Handlers
  const handleFileSelect = (files: FileList | null, isDoc = false) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB limit

    if (file.size > maxSizeBytes) {
      setErrorMessage(`Faili limezidi uwezo (Max 20MB). Faili hili lina ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
      
      const newAttachment: AttachmentItem = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        filename: file.name,
        fileType: ext,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64Data,
        previewUrl: file.type.startsWith('image/') ? base64Data : undefined,
      };

      setSelectedAttachments((prev) => [...prev, newAttachment]);
      setErrorMessage(null);
      setIsPhotoMenuOpen(false);
    };

    reader.onerror = () => {
      setErrorMessage('Picha au faili haikuweza kusomwa kwenye kifaa chako.');
    };

    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // TTS Readout for specific message
  const playSpeech = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (playingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setPlayingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingMessageId(msgId);

    const cleanText = text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'sw-TZ';
    utterance.rate = 0.95;

    utterance.onend = () => setPlayingMessageId(null);
    utterance.onerror = () => setPlayingMessageId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Quick suggestions tailored for Max
  const quickActions = [
    { label: '🧠 Kumbuka lugha ninayopenda', text: 'Kumbuka napenda Kiswahili fasaha na ripoti fupi za kiufundi.' },
    { label: '👥 Unamjua mke wangu?', text: 'Unamjua mke wangu Mary?' },
    { label: '📄 Niandalie PDF ya Ripoti', text: 'Niandalie PDF ya ripoti ya miradi ya wiki hii kwa Max.' },
    { label: '📊 Tengeneza Excel ya Bajeti', text: 'Tengeneza Excel ya bajeti ya ofisi na matumizi ya vifaa.' },
    { label: '⚡ Hali ya Auto Reply', text: 'Nipe taarifa ya utayari wa mfumo wa Max Auto Reply kwa SMS na Gmail.' },
  ];

  // File type icon resolver
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'json':
        return <FileCode className="w-5 h-5 text-[#D4AF37]" />;
      default:
        return <File className="w-5 h-5 text-[#888888]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[#080808] relative overflow-hidden text-[#F5F2ED]">
      {/* Hidden File Inputs for Image, Camera & Document pickers */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        id="hidden-gallery-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        id="hidden-camera-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        type="file"
        ref={documentInputRef}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.md,.png,.jpg,.jpeg"
        id="hidden-document-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, true)}
      />

      {/* Top Chat Header */}
      <header className="h-14 sm:h-16 flex-shrink-0 border-b border-[#222222] px-3 sm:px-6 flex items-center justify-between bg-[#050505] z-10">
        <div className="flex items-center space-x-2.5 sm:space-x-4 overflow-hidden">
          <div className="flex items-center text-xs uppercase tracking-widest text-[#888888] flex-shrink-0">
            <span className={`status-dot mr-1.5 ${isOnline ? 'text-emerald-500 bg-emerald-500' : 'text-amber-500 bg-amber-500'}`} />
            <span className="text-[#F5F2ED] font-semibold hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <div className="h-4 w-[1px] bg-[#222222] flex-shrink-0" />

          <div className="flex items-center space-x-1.5 truncate">
            <span className="text-xs font-bold text-[#D4AF37] truncate max-w-[140px] sm:max-w-[220px]">
              {conversationTitle}
            </span>
            <span className="text-[10px] text-[#666666] hidden md:inline">
              • Max Memory & Identify Active
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          {onOpenHistory && (
            <button
              id="chat-open-history-btn"
              onClick={onOpenHistory}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl glass hover:bg-white/5 text-xs font-semibold text-[#888888] hover:text-[#D4AF37] flex items-center space-x-1.5 transition border border-[#222222] cursor-pointer"
              title="Fungua Kumbukumbu za Chat"
            >
              <History className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">Kumbukumbu</span>
            </button>
          )}

          <button
            id="chat-new-conversation-btn"
            onClick={onNewChat}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl glass hover:bg-white/5 text-xs font-semibold text-[#888888] hover:text-[#F5F2ED] flex items-center space-x-1.5 transition border border-[#222222] cursor-pointer"
            title="Anzisha Mazungumzo Mapya"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mpya</span>
          </button>

          <button
            id="chat-voice-hud-btn"
            onClick={onOpenVoice}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sauti</span>
          </button>
        </div>
      </header>

      {/* Offline Notice Banner */}
      {!isOnline && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Upo Offline:</strong> Mazungumzo yote na majibu yaliyopita yamehifadhiwa salama kwenye kifaa chako cha Android. Majibu mapya ya AI yatahitaji intaneti.
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider flex-shrink-0">
            Local Storage
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 min-h-0 w-full">
        <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
              <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-2xl glass border border-[#222222] flex items-center justify-center text-[#D4AF37] mb-4 shadow-2xl">
                <Crown className="w-7 sm:w-8 h-7 sm:h-8 stroke-[1.5]" />
              </div>
              <h3 className="serif text-lg sm:text-2xl font-bold text-[#D4AF37] mb-2 tracking-wide">
                Habari Max. Mimi ni MKUU AI.
              </h3>
              <p className="text-xs sm:text-sm text-[#888888] mb-6 leading-relaxed">
                Msaidizi wako mkuu wa kibinafsi mwenye <strong className="text-[#F5F2ED]">Max Memory</strong>,{' '}
                <strong className="text-[#F5F2ED]">Max Identify</strong> ya watu wako wa karibu, na <strong className="text-[#F5F2ED]">Uhifadhi wa Kudumu wa Ndani</strong> unaofanya kazi hata bila mtandao.
              </p>

              {/* Quick Prompts */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(action.text);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.style.height = 'auto';
                      }
                    }}
                    className="3d-card glass p-3 sm:p-3.5 rounded-xl text-xs text-[#888888] hover:text-[#F5F2ED] border border-[#222222] hover:border-[#D4AF37]/50 transition group cursor-pointer"
                  >
                    <div className="font-bold text-[#D4AF37] mb-1 group-hover:text-[#e5c158]">
                      {action.label}
                    </div>
                    <div className="text-[11px] text-[#888888] line-clamp-1 italic">
                      "{action.text}"
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  id={`chat-msg-${msg.id}`}
                  className={`group relative flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 w-full`}
                >
                  {/* User Message Bubble */}
                  {isUser ? (
                    <div className="flex flex-col items-end space-y-1.5 max-w-[90%] sm:max-w-[75%]">
                      {/* Attached Items rendered with user bubble */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mb-1">
                          {msg.attachments.map((att, i) => (
                            <div
                              key={i}
                              className="glass p-2 rounded-xl border border-[#333333] flex items-center space-x-2 bg-white/5"
                            >
                              {att.previewUrl ? (
                                <img
                                  src={att.previewUrl}
                                  alt={att.filename}
                                  className="w-12 h-12 object-cover rounded-lg border border-[#333333]"
                                />
                              ) : (
                                <div className="p-2 rounded-lg bg-[#111111] border border-[#222222]">
                                  {getFileIcon(att.fileType)}
                                </div>
                              )}
                              <div className="text-left text-xs pr-2">
                                <div className="font-bold text-[#F5F2ED] truncate max-w-[140px]">{att.filename}</div>
                                <div className="text-[10px] text-[#888888]">
                                  {att.fileType.toUpperCase()} • {(att.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.content && (
                        <div className="glass p-3.5 sm:p-4 rounded-2xl rounded-tr-none bg-white/5 text-xs sm:text-sm text-[#F5F2ED] leading-relaxed border border-[#222222] break-words whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}

                      <div className="flex items-center space-x-2 px-2 text-[10px] text-[#888888]">
                        {msg.savedOffline && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <HardDrive className="w-2.5 h-2.5" />
                            <span>Saved Local</span>
                          </span>
                        )}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {onDeleteMessage && (
                          <button
                            onClick={() => onDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition p-0.5 cursor-pointer"
                            title="Futa Ujumbe Huu"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : msg.isError ? (
                    /* Error Message Bubble */
                    <div className="flex flex-col items-start space-y-1.5 max-w-[95%] sm:max-w-[85%] w-full">
                      <div className="glass p-4 sm:p-5 rounded-2xl rounded-tl-none border-l-2 border-red-500 bg-red-950/20 text-xs sm:text-[14px] leading-relaxed text-[#F5F2ED] border-t border-r border-b border-red-500/30 shadow-2xl w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-red-400 font-bold uppercase tracking-wider text-xs">
                            {msg.errorCode === 'NO_INTERNET' ? (
                              <>
                                <WifiOff className="w-4 h-4 text-amber-400" />
                                <span className="text-amber-400">HAKUNA INTANETI</span>
                              </>
                            ) : msg.errorCode === 'GEMINI_UNAVAILABLE' ? (
                              <>
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                                <span className="text-orange-400">GEMINI HAIPATIKANI</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span>SEVA YA MKUU HAIPATIKANI</span>
                              </>
                            )}
                          </div>
                          {msg.errorCode && (
                            <span className="px-2 py-0.5 rounded-md bg-red-900/40 text-red-300 font-mono text-[10px] border border-red-500/30 font-bold">
                              {msg.errorCode}
                            </span>
                          )}
                        </div>

                        <div className="text-xs sm:text-sm text-[#F5F2ED] leading-relaxed font-sans whitespace-pre-line font-medium">
                          {msg.content}
                        </div>

                        {msg.technicalDetails && (
                          <div className="p-2.5 rounded-xl bg-black/50 border border-[#222222] font-mono text-[10px] text-[#888888] break-all">
                            <span className="text-[#666666] block font-sans uppercase font-bold text-[9px] mb-0.5">Uchunguzi wa Kiufundi:</span>
                            {msg.technicalDetails}
                          </div>
                        )}

                        {onRetryMessage && msg.retryPayload && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => onRetryMessage(msg)}
                              className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>JARIBU TENA</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 px-2 text-[10px] text-[#888888]">
                        <span>Hitilafu ya Mtandao • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {onDeleteMessage && (
                          <button
                            onClick={() => onDeleteMessage(msg.id)}
                            className="hover:text-red-400 transition cursor-pointer ml-1"
                            title="Futa Ujumbe Huu"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Message Bubble */
                    <div className="flex flex-col items-start space-y-1.5 max-w-[95%] sm:max-w-[85%]">
                      <div className="glass p-4 sm:p-5 rounded-2xl rounded-tl-none border-l-2 border-[#D4AF37] text-xs sm:text-[14px] leading-relaxed text-[#F5F2ED] serif italic border-t border-r border-b border-[#222222] shadow-2xl w-full">
                        <div className="not-italic font-sans text-xs text-[#D4AF37] font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Crown className="w-3.5 h-3.5" />
                            <span>MKUU AI</span>
                          </div>
                          {onDeleteMessage && (
                            <button
                              onClick={() => onDeleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#888888] hover:text-red-400 transition p-1 cursor-pointer"
                              title="Futa Ujumbe Huu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="prose prose-invert prose-xs sm:prose-sm max-w-none text-[#F5F2ED] break-words">
                          <Markdown>{msg.content}</Markdown>
                        </div>

                        {/* Extracted Memory Tag */}
                        {msg.memoryExtracted && msg.memoryExtracted.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#222222] flex flex-wrap gap-1.5 not-italic font-sans">
                            {msg.memoryExtracted.map((mem, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-semibold"
                              >
                                <Brain className="w-3 h-3" />
                                <span>Max Memory: Imehifadhiwa kikamilifu</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Person Recognized Tag */}
                        {msg.personRecognized && msg.personRecognized.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 not-italic font-sans">
                            {msg.personRecognized.map((person, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold"
                              >
                                <Users className="w-3 h-3" />
                                <span>Max Identify: {person}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Generated Real Binary Files / Images Cards */}
                        {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#222222] space-y-3 not-italic font-sans">
                            <div className="text-[11px] font-bold text-[#D4AF37] flex items-center gap-1 uppercase tracking-wider">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Faili / Picha Iliyotengenezwa Halisi:</span>
                            </div>
                            {msg.generatedFiles.map((file) => {
                              const isImage =
                                ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(file.fileType?.toLowerCase() || '') ||
                                file.mimeType?.startsWith('image/') ||
                                file.downloadUrl?.startsWith('data:image/');

                              const imageUrl = file.downloadUrl?.startsWith('data:')
                                ? file.downloadUrl
                                : file.downloadUrl
                                ? getApiUrl(file.downloadUrl)
                                : '';

                              return (
                                <div
                                  key={file.id}
                                  className="rounded-xl glass border border-[#222222] overflow-hidden shadow-lg"
                                >
                                  {/* Auto-opening image preview for images */}
                                  {isImage && imageUrl && (
                                    <div className="relative bg-black/60 border-b border-[#222222] p-2 flex justify-center items-center group">
                                      <img
                                        src={imageUrl}
                                        alt={file.filename}
                                        className="max-h-72 w-auto max-w-full object-contain rounded-lg shadow cursor-pointer transition-transform duration-200 group-hover:scale-[1.01]"
                                        onClick={() => onPreviewDocument(file)}
                                        loading="lazy"
                                      />
                                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => onPreviewDocument(file)}
                                          className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold flex items-center space-x-1 backdrop-blur-md border border-white/20 cursor-pointer shadow"
                                          title="Tazama Kikubwa"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                                          <span>Kikubwa</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                      <div className="p-2 rounded-lg bg-[#111111] border border-[#222222] flex-shrink-0">
                                        {getFileIcon(file.fileType)}
                                      </div>
                                      <div className="truncate">
                                        <div className="font-bold text-[#F5F2ED] text-xs truncate">
                                          {file.filename}
                                        </div>
                                        <div className="text-[10px] text-[#888888]">
                                          {file.fileType.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB • Tayari Kwenye Mfumo
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                      <button
                                        id={`preview-file-btn-${file.id}`}
                                        onClick={() => onPreviewDocument(file)}
                                        className="px-2.5 py-1.5 rounded-lg glass hover:bg-white/10 text-xs font-semibold text-[#CCCCCC] hover:text-white flex items-center space-x-1 border border-[#333333] transition cursor-pointer"
                                        title="Soma / Tazama Faili"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                                        <span>TAZAMA</span>
                                      </button>

                                      <button
                                        id={`download-file-${file.id}`}
                                        onClick={() => downloadFileHelper(file)}
                                        className="px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer"
                                        title="Hifadhi / Pakua Kwenye Simu"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>HIFADHI KWENYE SIMU</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Footer Controls for AI Message */}
                      <div className="flex items-center space-x-3 px-2 text-[10px] text-[#888888]">
                        <span>MKUU AI • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <button
                          onClick={() => playSpeech(msg.id, msg.content)}
                          className="hover:text-[#D4AF37] flex items-center space-x-1 transition cursor-pointer"
                          title="Sikiliza kwa Sauti"
                        >
                          {playingMessageId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-red-400 animate-pulse" />
                              <span className="text-red-400 font-semibold">Zima Sauti</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-[#888888] hover:text-[#D4AF37]" />
                              <span>Sikiliza</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start space-x-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-xl glass border border-[#222222] text-[#D4AF37] flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 animate-bounce" />
              </div>
              <div className="p-3.5 rounded-2xl glass border border-[#222222] border-l-2 border-[#D4AF37] text-xs text-[#888888] flex items-center space-x-2 rounded-tl-none serif italic">
                <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
                <span>MKUU AI anachakata na kutafakari...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attachment Preview Chip Row in Composer */}
      {selectedAttachments.length > 0 && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-0">
          <div className="flex flex-wrap gap-2.5 p-3 rounded-2xl bg-[#111111] border border-[#2a2a2a]">
            {selectedAttachments.map((att, index) => (
              <div
                key={index}
                className="relative group p-2 rounded-xl bg-[#1a1a1a] border border-[#333333] flex items-center space-x-3 shadow-md"
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.filename}
                    className="w-12 h-12 object-cover rounded-lg border border-[#444444]"
                  />
                ) : (
                  <div className="p-2 rounded-lg bg-[#222222] text-[#D4AF37]">
                    {getFileIcon(att.fileType)}
                  </div>
                )}
                <div className="text-xs">
                  <div className="font-bold text-[#F5F2ED] truncate max-w-[150px]">{att.filename}</div>
                  <div className="text-[10px] text-[#888888]">
                    {att.fileType.toUpperCase()} • {(att.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <button
                  type="button"
                  id={`remove-att-${index}`}
                  onClick={() => removeAttachment(index)}
                  className="p-1 rounded-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition cursor-pointer"
                  title="Ondoa Kiambatisho"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message Toast in Composer */}
      {errorMessage && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-2">
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent Full-Width Typing Area */}
      <div className="w-full flex-shrink-0 p-3 sm:p-5 bg-[#080808] border-t border-[#1a1a1a] z-10">
        <form onSubmit={handleSend} className="w-full max-w-4xl mx-auto">
          <div className="w-full rounded-2xl bg-[#0f0f0f] border border-[#262626] focus-within:border-[#D4AF37] focus-within:ring-1 focus-within:ring-[#D4AF37]/50 transition-all shadow-2xl p-2.5 sm:p-3.5 flex flex-col space-y-2">
            {/* Multiline Textarea */}
            <textarea
              id="mkuu-chat-input"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Andika ujumbe wako au ambatanisha picha/nyaraka..."
              className="w-full bg-transparent border-0 outline-none resize-none text-sm sm:text-base text-[#F5F2ED] placeholder-[#777777] leading-relaxed min-h-[40px] max-h-[140px] px-2 py-1 caret-[#D4AF37] font-sans"
            />

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1e1e1e]/80 relative">
              {/* Left Action Buttons */}
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {/* Voice Button */}
                <button
                  type="button"
                  id="chat-mic-btn"
                  onClick={onOpenVoice}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                  title="Ongea kwa Sauti"
                >
                  <Mic className="w-4 h-4 text-[#D4AF37]" />
                  <span className="hidden sm:inline">Sauti</span>
                </button>

                {/* Add Image Button with Dropdown / Direct triggers */}
                <div className="relative">
                  <button
                    type="button"
                    id="chat-image-btn"
                    onClick={() => setIsPhotoMenuOpen(!isPhotoMenuOpen)}
                    className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#CCCCCC] hover:text-[#F5F2ED] border border-[#222222] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                    title="Weka Picha (Kamera au Gallery)"
                  >
                    <Image className="w-4 h-4 text-purple-400" />
                    <span className="hidden sm:inline">Picha</span>
                  </button>

                  {/* Photo Options Popup */}
                  {isPhotoMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#141414] border border-[#333333] rounded-2xl p-1.5 shadow-2xl z-30 space-y-1">
                      <button
                        type="button"
                        id="take-photo-action-btn"
                        onClick={() => {
                          setIsPhotoMenuOpen(false);
                          cameraInputRef.current?.click();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#222222] text-[#F5F2ED] flex items-center space-x-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Piga Picha (Camera)</span>
                      </button>

                      <button
                        type="button"
                        id="gallery-photo-action-btn"
                        onClick={() => {
                          setIsPhotoMenuOpen(false);
                          imageInputRef.current?.click();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#222222] text-[#F5F2ED] flex items-center space-x-2 cursor-pointer"
                      >
                        <Image className="w-4 h-4 text-[#D4AF37]" />
                        <span>Chagua Gallery (Photos)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Document Picker Button */}
                <button
                  type="button"
                  id="chat-document-picker-btn"
                  onClick={() => documentInputRef.current?.click()}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#CCCCCC] hover:text-[#F5F2ED] border border-[#222222] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                  title="Ambatanisha Nyaraka (PDF, DOCX, XLSX, CSV, JSON, TXT)"
                >
                  <Paperclip className="w-4 h-4 text-[#D4AF37]" />
                  <span className="hidden sm:inline">Nyaraka</span>
                </button>

                {/* Create Binary File Button */}
                <button
                  type="button"
                  id="chat-generate-file-btn"
                  onClick={onOpenFileGenerator}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#CCCCCC] hover:text-[#F5F2ED] border border-[#222222] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer hidden md:inline-flex"
                  title="Tengeneza Faili (PDF, Excel, Word)"
                >
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="hidden lg:inline">Tengeneza Faili</span>
                </button>

                {/* Max Memory Modal Button */}
                <button
                  type="button"
                  id="chat-add-memory-btn"
                  onClick={onOpenMemoryModal}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#CCCCCC] hover:text-[#D4AF37] border border-[#222222] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer hidden lg:inline-flex"
                  title="Hifadhi Max Memory"
                >
                  <Brain className="w-4 h-4" />
                  <span>Memory</span>
                </button>
              </div>

              {/* Right Send Button */}
              <div className="flex items-center space-x-2">
                <button
                  type="submit"
                  id="chat-send-btn"
                  disabled={(!inputText.trim() && selectedAttachments.length === 0) || isLoading}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md ${
                    (inputText.trim() || selectedAttachments.length > 0) && !isLoading
                      ? 'bg-[#D4AF37] hover:bg-[#c59f2e] text-black cursor-pointer'
                      : 'bg-[#1a1a1a] text-[#666666] cursor-not-allowed border border-[#252525]'
                  }`}
                >
                  <span>SEND</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ChatView;

