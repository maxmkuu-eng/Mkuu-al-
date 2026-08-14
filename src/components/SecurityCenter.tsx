import React, { useState } from 'react';
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
} from 'lucide-react';
import { UserProfile, Memory, Person, AutoReplySettings } from '../types';

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

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 4) return;
    await onUpdatePin(pin.trim());
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
    setPin('');
  };

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
            Data zote za Max Memory, Watu wa Karibu, na Auto Reply zimehifadhiwa kwa usalama wa kiwango cha juu.
            Hakuna siri za API au data za kibinafsi zinazofichuliwa kwenye kivinjari cha mbele.
          </p>
        </div>
      </div>

      {/* Owner Identity Profile Card */}
      <div className="glass p-6 sm:p-7 rounded-3xl border border-[#222222] border-l-2 border-[#D4AF37] shadow-lg space-y-5">
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
            <span>Hifadhi ya Seva (Isolated DB)</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Data zote zimefungwa kwa mtumiaji wa Max pekee. Hakuna muingiliano na watumiaji wengine.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-[#D4AF37] font-bold text-xs">
            <Cpu className="w-4 h-4" />
            <span>Gemini AI Server Proxy</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            API Keys zinalindwa kwa 100% upande wa seva (`server/gemini.ts`) na hazionekani kamwe kwenye browser.
          </p>
        </div>

        <div className="glass p-5 rounded-2xl border border-[#222222] space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
            <Server className="w-4 h-4" />
            <span>Real File Sandbox</span>
          </div>
          <p className="text-xs text-[#888888] leading-relaxed">
            Mafaili ya PDF, Excel, na Word yanaundwa kwa binary halisi na kuthibitishwa kabla ya kumpa Max.
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
