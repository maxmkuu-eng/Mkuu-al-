import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Crown,
  AlertCircle,
  Settings,
  Send,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';
import { VoiceState, Memory, Person } from '../types';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string, isVoice: boolean) => Promise<{ reply: string; cleanSpeechText: string }>;
  memories: Memory[];
  people: Person[];
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  memories,
  people,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'sw-TZ' | 'en-US'>('sw-TZ');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [manualInput, setManualInput] = useState('');
  const [isRecordingMediaStream, setIsRecordingMediaStream] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<string>('');
  const voiceStateRef = useRef<VoiceState>('ready');
  const selectedLangRef = useRef<'sw-TZ' | 'en-US'>('sw-TZ');
  const isListeningExplicitlyRef = useRef<boolean>(false);

  // Sync refs
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  // Clean Markdown & Technical symbols for clean spoken voice
  const sanitizeTextForSpeech = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/^[\s*•\-+]+\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Text-To-Speech Playback
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) {
      setVoiceState('ready');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const cleaned = sanitizeTextForSpeech(text);
      if (!cleaned) {
        setVoiceState('ready');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);
      const isSwahili = selectedLangRef.current === 'sw-TZ';
      utterance.lang = isSwahili ? 'sw-TZ' : 'en-US';
      utterance.rate = isSwahili ? 0.95 : 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        if (isSwahili) {
          const swVoice = voices.find((v) => v.lang.toLowerCase().startsWith('sw'));
          if (swVoice) utterance.voice = swVoice;
        } else {
          const enVoice = voices.find((v) => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb'));
          if (enVoice) utterance.voice = enVoice;
        }
      }

      utterance.onstart = () => setVoiceState('speaking');
      utterance.onend = () => setVoiceState('ready');
      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        setVoiceState('ready');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('TTS playback error:', err);
      setVoiceState('ready');
    }
  };

  // Send speech transcript to backend AI
  const handleProcessVoice = async (textToSend: string) => {
    if (!textToSend || !textToSend.trim()) {
      setVoiceState('ready');
      return;
    }

    setVoiceState('thinking');
    setErrorMessage('');

    try {
      const result = await onSendMessage(textToSend, true);
      setAiResponse(result.reply);
      setVoiceState('speaking');
      speakText(result.cleanSpeechText || result.reply);
    } catch (e: any) {
      console.error('AI Voice Processing Error:', e);
      setVoiceState('error');
      setErrorMessage(
        e.message?.includes('network') || e.message?.includes('fetch')
          ? 'Haijaweza kuwasiliana na seva. Angalia mtandao wako.'
          : 'MKUU AI haijaweza kupata jibu kwa sasa.'
      );
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    synthRef.current = 'speechSynthesis' in window ? window.speechSynthesis : null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningExplicitlyRef.current = true;
      setVoiceState('listening');
      setErrorMessage('');
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      if (currentTranscript) {
        setTranscript(currentTranscript);
        transcriptRef.current = currentTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition event error:', event.error);
      isListeningExplicitlyRef.current = false;

      let msg = '';
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          msg = 'Ruhusa ya microphone imekataliwa. Tafadhali ruhusu kipaza sauti kwenye kivinjari au app.';
          setHasPermission(false);
          break;
        case 'no-speech':
          msg = 'Sauti haijasikika. Tafadhali gusa tena kitufe uongee kwa sauti iliyo wazi.';
          break;
        case 'audio-capture':
          msg = 'Hakuna kipaza sauti (microphone) kilichopatikana kwenye kifaa hiki.';
          break;
        case 'network':
          msg = 'Speech recognition inahitaji mtandao au Google Speech Services.';
          break;
        default:
          msg = `Kipaza sauti: ${event.error}`;
      }

      if (event.error === 'no-speech') {
        setVoiceState('ready');
        setErrorMessage(msg);
      } else {
        setVoiceState('error');
        setErrorMessage(msg);
      }
    };

    recognition.onend = () => {
      const wasListening = isListeningExplicitlyRef.current;
      isListeningExplicitlyRef.current = false;

      const finalSpeech = transcriptRef.current;
      if (finalSpeech && finalSpeech.trim().length > 0 && wasListening) {
        handleProcessVoice(finalSpeech);
      } else if (voiceStateRef.current === 'listening') {
        setVoiceState('ready');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        if (recognitionRef.current) recognitionRef.current.abort();
      } catch (e) {}
      try {
        if (synthRef.current) synthRef.current.cancel();
      } catch (e) {}
    };
  }, []);

  // Request Microphone Permissions
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setHasPermission(true);
        setErrorMessage('');
        return true;
      }
      setHasPermission(true);
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setHasPermission(false);
      setVoiceState('error');
      setErrorMessage(
        'Ruhusa ya microphone imezuiwa. Gusa kitufe cha "Ruhusu Mic Sasa" au ruhusu kwenye Settings za simu / kivinjari.'
      );
      return false;
    }
  };

  // Start Listening
  const startListening = async () => {
    if (synthRef.current) synthRef.current.cancel();

    setTranscript('');
    transcriptRef.current = '';
    setAiResponse('');
    setErrorMessage('');

    // Check / Request permission
    const granted = await requestMicPermission();
    if (!granted) return;

    if (recognitionRef.current && isSupported) {
      try {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
        return;
      } catch (e: any) {
        try {
          recognitionRef.current.abort();
          setTimeout(() => {
            recognitionRef.current.lang = selectedLang;
            recognitionRef.current.start();
          }, 150);
          return;
        } catch (restartErr: any) {
          console.warn('Recognition start fallback:', restartErr);
        }
      }
    }

    // Direct MediaRecorder Audio Capture Fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecordingMediaStream(true);
        setVoiceState('listening');
      };

      mediaRecorder.onstop = () => {
        setIsRecordingMediaStream(false);
        stream.getTracks().forEach((track) => track.stop());
        if (transcriptRef.current.trim()) {
          handleProcessVoice(transcriptRef.current);
        } else {
          setVoiceState('ready');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (err: any) {
      setVoiceState('error');
      setErrorMessage('Kipaza sauti hakijafunguka. Unaweza kutumia kisanduku cha maneno hapa chini.');
    }
  };

  // Stop Listening & Trigger Processing
  const stopListening = () => {
    isListeningExplicitlyRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        if (transcriptRef.current.trim()) {
          handleProcessVoice(transcriptRef.current);
        }
      }
    }

    if (mediaRecorderRef.current && isRecordingMediaStream) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (synthRef.current) synthRef.current.cancel();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (voiceState === 'speaking') {
      setVoiceState('ready');
    }
  };

  // Quick Voice Prompts
  const quickVoicePrompts = [
    'Mkuu, nipe muhtasari wa watu wangu wa karibu',
    'Niandalie faili la PDF la ripoti yangu',
    'Max Memory imehifadhi nini kunihusu?',
    'Mkuu, naomba usaidizi wa kazi za leo',
  ];

  if (!isOpen) return null;

  const stateConfig = {
    ready: {
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      badge: '🟢 READY',
      label: 'Uko Tayari — Gusa Kipaza Sauti Kuongea',
    },
    listening: {
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
      badge: '🔵 LISTENING',
      label: 'Anasikiliza Max...',
    },
    thinking: {
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
      badge: '🟣 THINKING',
      label: 'MKUU AI Anatafakari...',
    },
    speaking: {
      color: 'bg-[#D4AF37]',
      textColor: 'text-[#D4AF37]',
      badge: '🟠 SPEAKING',
      label: 'MKUU AI Anazungumza...',
    },
    error: {
      color: 'bg-red-500',
      textColor: 'text-red-400',
      badge: '🔴 INFO',
      label: errorMessage || 'Weka ujumbe wa sauti au chagua hapa chini',
    },
  };

  const currentStatus = stateConfig[voiceState];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in text-[#F5F2ED]">
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#222222] rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-md">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="serif font-bold text-white text-base leading-tight">
                MKUU AI — Sauti ya Moja kwa Moja
              </h3>
              <p className="text-[11px] text-[#888888]">Voice Pipeline & Utambuzi wa Sauti</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="voice-toggle-mute-btn"
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isMuted
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'glass text-[#888888] hover:text-[#F5F2ED] border-[#222222]'
              }`}
              title={isMuted ? 'Washa Sauti ya Spika' : 'Zima Sauti ya Spika'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              id="voice-close-modal-btn"
              onClick={() => {
                if (synthRef.current) synthRef.current.cancel();
                if (recognitionRef.current) recognitionRef.current.abort();
                if (mediaRecorderRef.current && isRecordingMediaStream) mediaRecorderRef.current.stop();
                onClose();
              }}
              className="p-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] border-[#222222] transition cursor-pointer"
              title="Funga Dirisha"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Orb & Visual Status */}
        <div className="flex flex-col items-center justify-center py-2 space-y-3">
          {/* Status Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#161616] border border-[#262626]">
            <span className="text-xs font-mono font-bold tracking-wider">{currentStatus.badge}</span>
            <span className="text-[#444]">•</span>
            <span className={`text-xs font-semibold ${currentStatus.textColor}`}>
              {currentStatus.label}
            </span>
          </div>

          {/* Interactive Mic / Soundwave Orb */}
          <div className="relative my-2">
            <button
              id="voice-orb-action-btn"
              onClick={() => {
                if (voiceState === 'listening') {
                  stopListening();
                } else if (voiceState === 'speaking') {
                  if (synthRef.current) synthRef.current.cancel();
                  setVoiceState('ready');
                } else {
                  startListening();
                }
              }}
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer shadow-2xl ${
                voiceState === 'listening'
                  ? 'bg-blue-600 scale-105 shadow-blue-500/50'
                  : voiceState === 'thinking'
                  ? 'bg-purple-600 animate-pulse shadow-purple-500/50'
                  : voiceState === 'speaking'
                  ? 'bg-[#D4AF37] scale-105 shadow-[#D4AF37]/50'
                  : voiceState === 'error'
                  ? 'bg-red-950/60 border-2 border-red-500/80 hover:bg-red-900/60'
                  : 'bg-[#1a1a1a] hover:bg-[#222222] border-2 border-[#D4AF37]/40 hover:border-[#D4AF37]'
              }`}
            >
              {voiceState === 'listening' ? (
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-10 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-14 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="w-1.5 h-10 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                </div>
              ) : voiceState === 'thinking' ? (
                <RefreshCw className="w-10 h-10 text-white animate-spin" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-10 h-10 text-black animate-pulse" />
              ) : voiceState === 'error' ? (
                <MicOff className="w-10 h-10 text-red-400 animate-pulse" />
              ) : (
                <Mic className="w-10 h-10 text-[#D4AF37]" />
              )}
            </button>
          </div>

          {hasPermission === false && (
            <div className="w-full max-w-sm bg-red-950/40 border border-red-500/40 rounded-2xl p-3 text-center space-y-2">
              <p className="text-xs text-red-200">
                Kipaza sauti kimezuiwa kwenye kifaa hiki.
              </p>
              <button
                id="voice-request-perm-direct-btn"
                onClick={async () => {
                  const ok = await requestMicPermission();
                  if (ok) startListening();
                }}
                className="px-4 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow cursor-pointer transition"
              >
                Ruhusu Microphone Sasa
              </button>
            </div>
          )}

          <p className="text-xs text-[#888888] text-center max-w-xs">
            {voiceState === 'listening'
              ? 'Ongea sasa... kisha gusa kitufe au kaa kimya kutuma.'
              : voiceState === 'speaking'
              ? 'MKUU AI anazungumza kwa sauti ya asili...'
              : 'Gusa kitufe cha kati kuanza kuongea na MKUU AI'}
          </p>
        </div>

        {/* Live Transcript / AI Output Display Box */}
        {(transcript || aiResponse) && (
          <div className="glass p-4 rounded-2xl border border-[#222222] space-y-2 bg-[#090909]">
            {transcript && (
              <div className="space-y-1">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  Maneno Yako:
                </span>
                <p className="text-xs text-[#F5F2ED] italic">"{transcript}"</p>
              </div>
            )}

            {aiResponse && (
              <div className="pt-2 border-t border-[#1e1e1e] space-y-1">
                <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>Jibu la MKUU AI:</span>
                </span>
                <p className="text-xs text-[#E0DCD3] leading-relaxed serif">{aiResponse}</p>
              </div>
            )}
          </div>
        )}

        {/* Quick Voice Phrases (Click to Speak with AI) */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">
            Mifano ya Kuanzia:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {quickVoicePrompts.map((prompt, idx) => (
              <button
                key={idx}
                id={`voice-quick-prompt-${idx}`}
                onClick={() => {
                  setTranscript(prompt);
                  transcriptRef.current = prompt;
                  handleProcessVoice(prompt);
                }}
                className="text-left p-2.5 rounded-xl glass hover:bg-white/5 border border-[#222222] text-[11px] text-[#CCCCCC] hover:text-[#D4AF37] transition cursor-pointer flex items-center space-x-1.5"
              >
                <Play className="w-3 h-3 text-[#D4AF37] flex-shrink-0" />
                <span className="truncate">{prompt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Speech Input Box (Seamless Bridge) */}
        <div className="pt-2 border-t border-[#1e1e1e]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualInput.trim()) {
                const text = manualInput.trim();
                setManualInput('');
                setTranscript(text);
                transcriptRef.current = text;
                handleProcessVoice(text);
              }
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              id="voice-manual-input"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Au andika hapa uongee na sauti ya MKUU AI..."
              className="flex-1 bg-[#141414] border border-[#282828] rounded-xl px-3 py-2 text-xs text-[#F5F2ED] placeholder-[#777777] outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              id="voice-manual-send-btn"
              disabled={!manualInput.trim()}
              className={`p-2 rounded-xl text-black font-bold transition cursor-pointer ${
                manualInput.trim() ? 'bg-[#D4AF37] hover:bg-[#c59f2e]' : 'bg-[#222222] text-[#666666]'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VoiceModal;
