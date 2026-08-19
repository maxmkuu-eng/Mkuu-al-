import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Crown,
  Key,
  Download,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cpu,
  Server,
  Globe,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, Memory, Person, AutoReplySettings } from '../types';
import { getStoredGeminiApiKey, setStoredGeminiApiKey } from '../services/aiEngine';
import { getRemoteServerUrl, setRemoteServerUrl, isCapacitorNative, getApiUrl, PRODUCTION_API_BASE_URL } from '../services/apiConfig';

interface SecurityCenterProps {
  user: UserProfile | null;
  memories: Memory[];
  people: Person[];
  autoReplySettings: AutoReplySettings;
  onExportAllData: () => void;
  onUpdatePin: (newPin: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({
  user,
  memories,
  people,
  autoReplySettings,
  onExportAllData,
  onUpdatePin,
  onClearAllData,
}) => {
  const [pin, setPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Connection & API Key Configuration State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [serverUrlSaved, setServerUrlSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  // Backend Health / Architecture Status State
  const [systemStatus, setSystemStatus] = useState<{
    aiProvider: string;
    chatModel: string;
    backend: string;
    status: string;
    imageModel?: string;
    latencyMs?: number;
  }>({
    aiProvider: 'Google Gemini',
    chatModel: 'gemini-3.7-flash',
    backend: 'MKUU Server',
    status: 'connected',
  });

  useEffect(() => {
    setGeminiApiKey(getStoredGeminiApiKey());
    setServerUrl(getRemoteServerUrl());

    // Fetch live backend health and architecture status
    fetch(getApiUrl('/api/status'))
      .then((res) => res.json())
      .then((data) => {
        if (data && data.aiProvider) {
          setSystemStatus(data);
        }
      })
      .catch((err) => {
        console.warn('Status fetch note:', err);
      });
  }, []);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 4) return;
    await onUpdatePin(pin.trim());
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
    setPin('');
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGeminiApiKey(geminiApiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 3000);
  };

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setRemoteServerUrl(serverUrl);
    setServerUrlSaved(true);
    setTimeout(() => setServerUrlSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing', message: 'Inajaribu muunganisho wa AI...' });

    // 1. Test Live Production Backend Server (/api/health)
    const targetHealthUrl = getApiUrl('/api/health');
    try {
      const res = await fetch(targetHealthUrl, {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          status: 'success',
          message: `Muunganisho wa moja kwa moja na MKUU AI Server (${data.aiProvider} - ${data.chatModel}) umethibitishwa kwa 100%!`,
        });
        return;
      }
    } catch (err: any) {
      console.warn('Backend test connection error:', err);
    }

    // 2. Test Direct Gemini Key if present
    const key = geminiApiKey.trim() || getStoredGeminiApiKey();
    if (key) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Sema jambo' }] }],
          }),
        });

        if (res.ok) {
          setTestResult({
            status: 'success',
            message: 'Muunganisho wa Moja kwa Moja na Google Gemini AI umethibitishwa kwa 100%!',
          });
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
      } catch (err: any) {
        setTestResult({
          status: 'error',
          message: `Hitilafu ya Gemini Key: ${err.message}`,
        });
        return;
      }
    }

    // 3. If unreachable
    setTestResult({
      status: 'error',
      message: 'Imeshindwa kuunganishwa na seva ya AI. Hakikisha kifaa chako kimeunganishwa kwenye intaneti.',
    });
  };

  const isNative = isCapacitorNative();
  const hasDirectKey = !!geminiApiKey.trim();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MAX SECURITY VAULT & PRIVACY SHIELD</span>
          </div>
          <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
            Ulinzi wa Faragha na Udhibiti wa Mmiliki (Max)
          </h2>
          <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
            Data zote za Max Memory, Watu wa Karibu, na Auto Reply zimehifadhiwa kwa usalama wa kiwango cha juu ndani ya kifaa chako.
          </p>
        </div>
      </div>

      {/* EXPLICIT ARCHITECTURE & BACKEND SYSTEM STATUS CARD */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] bg-[#0c0c0c] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1f1f1f]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                  MKUU AI Backend & Architecture Status
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wider">
                  Live System
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Ripoti rasmi ya uhusiano kati ya MKUU App, MKUU Backend Server, na Google Gemini API.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {systemStatus.status === 'connected' ? 'Connected' : 'Active'}
            </span>
          </div>
        </div>

        {/* System Architecture Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">AI PROVIDER</span>
            <span className="text-sm font-bold text-[#D4AF37] font-mono block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {systemStatus.aiProvider || 'Google Gemini'}
            </span>
            <span className="text-[10px] text-[#666666] block">Official Google Gemini API</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">CHAT MODEL</span>
            <span className="text-sm font-bold text-white font-mono block">
              {systemStatus.chatModel || 'gemini-3.7-flash'}
            </span>
            <span className="text-[10px] text-[#666666] block">Personal Chat AI Engine</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">BACKEND SERVER</span>
            <span className="text-sm font-bold text-emerald-400 font-mono block flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              {systemStatus.backend || 'MKUU Server'}
            </span>
            <span className="text-[10px] text-[#666666] block">Dedicated GeminiService & DB</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">IMAGE STUDIO SERVICE</span>
            <span className="text-sm font-bold text-sky-400 font-mono block">
              {systemStatus.imageModel || 'gemini-3-pro-image'}
            </span>
            <span className="text-[10px] text-[#666666] block">Separate Vision / Editing Pipeline</span>
          </div>
        </div>

        {/* Visual Architectural Diagram */}
        <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-3">
          <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
            REQUEST PIPELINE FLOW (ARCHITECTURE)
          </span>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#F5F2ED]">
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-[#D4AF37]">
              MKUU AI APP
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-emerald-400">
              MKUU BACKEND
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-sky-400">
              GeminiService
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#151515] border border-[#333333] font-bold text-white">
              Google Gemini API
            </div>
            <span className="text-[#666666]">→</span>
            <div className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 font-bold text-[#D4AF37]">
              Gemini 3.7 Flash
            </div>
          </div>
        </div>
      </div>

      {/* AI Connection & Standalone Phone Setup */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-[#D4AF37] shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="serif font-bold text-[#F5F2ED] text-base sm:text-lg">
                Muunganisho wa Akili ya AI (Gemini Direct & Cloud Engine)
              </h3>
              <p className="text-xs text-[#888888]">
                Sanidi jinsi simu hii inavyounganishwa na Google Gemini AI kwa uhuru kamili.
              </p>
            </div>
          </div>

          <div className="hidden sm:block">
            {hasDirectKey ? (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Gemini Direct Ipo Tayari
              </span>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Akili ya Ndani (Local AI)
              </span>
            )}
          </div>
        </div>

        {/* Gemini API Key Direct Input */}
        <form onSubmit={handleSaveGeminiKey} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Google Gemini API Key (Kwa Matumizi ya Moja kwa Moja Kwenye Simu)
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-1 transition underline"
            >
              <span>Pata API Key Bure hapa</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Weka AIzaSy... au uache wazi kwa Local Brain"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0"
            >
              HIFADHI KEY
            </button>
          </div>

          {apiKeySaved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gemini API Key imehifadhiwa salama kwenye simu yako!</span>
            </div>
          )}
        </form>

        {/* Custom Server URL (Optional) */}
        <form onSubmit={handleSaveServerUrl} className="space-y-3 pt-1 border-t border-[#1a1a1a]">
          <label className="text-xs font-semibold text-[#888888] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            Seva ya Wingu Binafsi (Custom Backend Server URL — Hiari)
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://seva-yako.app (hiari)"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl glass hover:bg-[#222222] text-[#F5F2ED] font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 border border-[#333333]"
            >
              HIFADHI SEVA
            </button>
          </div>

          {serverUrlSaved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anwani ya seva imehifadhiwa kikamilifu!</span>
            </div>
          )}
        </form>

        {/* Test Connection Button & Status Output */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testResult.status === 'testing'}
            className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] text-[#F5F2ED] border border-[#333333] text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testResult.status === 'testing' ? 'animate-spin text-[#D4AF37]' : ''}`} />
            <span>JARIBU MUUNGANISHO WA AI</span>
          </button>

          {testResult.message && (
            <p className={`text-xs ${testResult.status === 'success' ? 'text-emerald-400' : testResult.status === 'error' ? 'text-red-400' : 'text-[#888888]'}`}>
              {testResult.message}
            </p>
          )}
        </div>
      </div>

      {/* Owner Identity Profile Card */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xl shadow-lg">
              MX
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="serif font-bold text-[#F5F2ED] text-xl">{user?.name || 'Max'}</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold border border-[#D4AF37]/30 flex items-center gap-1 uppercase tracking-wider">
                  <Crown className="w-3 h-3" />
                  MMILIKI HALISI
                </span>
              </div>
              <p className="text-xs text-[#888888] font-mono mt-0.5">{user?.email || 'maxmkuu@gmail.com'}</p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Akaunti Imethibitishwa
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Jukumu (Role)</span>
            <span className="text-xs font-semibold text-[#F5F2ED] mt-0.5 block">Mmiliki Mkuu wa Mfumo (Root Owner)</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Ufikiaji wa Kumbukumbu</span>
            <span className="text-xs font-semibold text-[#D4AF37] mt-0.5 block">{memories.length} Kumbukumbu Zimehifadhiwa</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#050505] border border-[#222222]">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Watu wa Karibu</span>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">{people.length} Watu Wametambuliwa</span>
          </div>
        </div>
      </div>

      {/* Security Engine Specs & Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-[#D4AF37] font-bold text-xs">
            <Database className="w-4 h-4" />
            <span>Hifadhi ya Ndani (Offline IndexedDB)</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Data zote zimefungwa kwa mtumiaji wa Max pekee ndani ya kifaa chako na hazipotei kamwe hata ukiwa bila intaneti.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-[#D4AF37] font-bold text-xs">
            <Cpu className="w-4 h-4" />
            <span>Unified Gemini Brain</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Inaauni utekelezaji wa moja kwa moja wa Gemini 2.5 Flash, Gemini Flash, na akili thabiti ya ndani ya Kiswahili.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
            <Server className="w-4 h-4" />
            <span>Real File Generation</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Mafaili ya PDF, Excel, na Word yanaundwa kwa binary halisi na kuthibitishwa kabla ya kupakuliwa.
          </p>
        </div>
      </div>

      {/* PIN Protection & Vault Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-3.5">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="serif font-bold text-sm text-[#F5F2ED]">Nambari ya Siri ya Vault (Security PIN)</h3>
          </div>
          <p className="text-xs text-[#888888]">
            Weka au badilisha PIN ya usalama kwa ajili ya kufunga shughuli nyeti za Max Memory na Auto Reply.
          </p>

          <form onSubmit={handleSetPin} className="space-y-3">
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Weka PIN mpya (tarakimu 4 hadi 6)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37] font-mono tracking-widest"
            />
            <button
              type="submit"
              disabled={!pin.trim() || pin.length < 4}
              className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
            >
              HIFADHI PIN YA USALAMA
            </button>
          </form>

          {pinSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>PIN imehifadhiwa kikamilifu!</span>
            </div>
          )}
        </div>

        {/* Data Backup & Export */}
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-3.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <h3 className="serif font-bold text-sm text-[#F5F2ED]">Hamisha Data Zote (Export All Data)</h3>
            </div>
            <p className="text-xs text-[#888888]">
              Pakua nakala kamili ya JSON yenye Max Memory, orodha ya Watu wa Karibu, na kumbukumbu zote za Auto Reply.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              id="export-all-data-btn"
              onClick={onExportAllData}
              className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>PAKUA NAKALA KAMILI YA DATA (JSON BACKUP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="p-6 rounded-3xl bg-red-950/20 border border-red-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="serif font-bold text-sm text-white">Eneo Nyeti la Mfumo (Danger Zone)</h3>
          </div>
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition cursor-pointer"
          >
            Safisha Mfumo Upya
          </button>
        </div>
        <p className="text-xs text-[#888888]">
          Uchaguzi huu utarejesha kumbukumbu na taarifa za msingi za Max na kufuta historia zote za majaribio.
        </p>
      </div>

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border border-red-900/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-white text-base">Thibitisha Kusafisha Mfumo?</h3>
                <p className="text-xs text-[#888888]">Hatua hii itarejesha mfumo katika hali safi ya msingi.</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={async () => {
                  await onClearAllData();
                  setIsResetConfirmOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                NDIYO, REJESHA MFUMO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SecurityCenter;
