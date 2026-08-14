import React from 'react';
import {
  Brain,
  Users,
  FolderDown,
  Zap,
  Crown,
  Plus,
  ArrowRight,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { Memory, Person, GeneratedFileSummary, AutoReplySettings, ActiveTab } from '../types';

interface RightSidebarProps {
  memories: Memory[];
  people: Person[];
  files: GeneratedFileSummary[];
  autoReplySettings: AutoReplySettings;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenVoice: () => void;
  onOpenFileGenerator: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  memories,
  people,
  files,
  autoReplySettings,
  setActiveTab,
  onOpenVoice,
  onOpenFileGenerator,
}) => {
  return (
    <aside className="hidden xl:flex flex-col w-64 2xl:w-72 flex-shrink-0 bg-[#050505] border-l border-[#222222] h-full overflow-y-auto p-4 2xl:p-6 space-y-5 2xl:space-y-6 text-[#F5F2ED]">
      {/* Top Owner Quick Card */}
      <div className="glass p-4 rounded-2xl border-l-2 border-[#D4AF37] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <span className="serif text-xs font-bold text-[#D4AF37] tracking-wider">MMILIKI: MAX</span>
          </div>
          <span className="status-dot text-emerald-500 bg-emerald-500" />
        </div>
        <p className="text-[11px] text-[#888888] leading-relaxed">
          MKUU AI anafanya kazi kwa uelewa kamili wa data zako.
        </p>

        <button
          onClick={onOpenVoice}
          className="w-full py-2 px-3 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Washa Sauti ya Mkuu</span>
        </button>
      </div>

      {/* Max Memory Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">
            Max Memory ({memories.length})
          </h3>
          <button
            onClick={() => setActiveTab('memory')}
            className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"
          >
            <span>Zote</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {memories.slice(0, 2).map((m, idx) => (
            <div
              key={m.id}
              onClick={() => setActiveTab('memory')}
              className={`3d-card glass p-3 rounded-xl text-xs cursor-pointer hover:border-[#D4AF37]/40 transition ${
                idx === 0 ? 'border-l-2 border-[#D4AF37]' : ''
              }`}
            >
              <p className="text-[#888888] text-[10px] mb-1 italic">Kumbukumbu • {m.category}</p>
              <p className="text-[#F5F2ED] line-clamp-2 leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Watu Wangu Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">
            Watu Wangu ({people.length})
          </h3>
          <button
            onClick={() => setActiveTab('people')}
            className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"
          >
            <span>Orodha</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {people.length > 0 && (
          <div className="glass p-4 rounded-2xl border-l-2 border-[#D4AF37] space-y-2.5">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#222222] overflow-hidden flex items-center justify-center font-bold text-xs text-[#D4AF37]">
                {people[0].name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-[#F5F2ED]">{people[0].name}</p>
                <p className="text-[10px] text-[#D4AF37] font-medium">{people[0].relationship}</p>
              </div>
            </div>

            {people[0].phone && (
              <p className="text-[10px] text-[#888888]">📞 {people[0].phone}</p>
            )}
            {people[0].email && (
              <p className="text-[10px] text-[#888888]">📧 {people[0].email}</p>
            )}

            <button
              onClick={() => setActiveTab('people')}
              className="w-full mt-2 py-1.5 border border-red-900/30 text-[10px] uppercase tracking-widest text-red-400 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition cursor-pointer"
            >
              Futa au Badili Mtu
            </button>
          </div>
        )}
      </section>

      {/* Auto Reply Smart Status */}
      <section>
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888] mb-3">
          Auto Reply
        </h3>
        <div
          onClick={() => setActiveTab('autoreply')}
          className="flex items-center justify-between glass p-3.5 rounded-xl cursor-pointer hover:border-[#D4AF37]/30 transition"
        >
          <div>
            <span className="text-xs font-bold text-[#F5F2ED] tracking-wider block">SMART STATUS</span>
            <span className="text-[10px] text-[#888888]">
              {autoReplySettings.emergencyStop ? 'Emergency Stopped' : 'Active & Ready'}
            </span>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            autoReplySettings.emergencyStop ? 'bg-red-900/60' : 'bg-[#D4AF37]'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              autoReplySettings.emergencyStop ? 'left-0.5 bg-white' : 'right-0.5 bg-black'
            }`} />
          </div>
        </div>
      </section>

      {/* Real Files Quick Action */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">
            Faili Halisi ({files.length})
          </h3>
          <button
            onClick={() => setActiveTab('files')}
            className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"
          >
            <span>Vault</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <button
          onClick={onOpenFileGenerator}
          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F2ED] border border-[#222222] hover:border-[#D4AF37]/40 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Tengeneza PDF / Excel</span>
        </button>
      </section>

      {/* Security Guarantee Pill */}
      <div className="p-3 rounded-xl glass border border-[#222222] flex items-center space-x-2 text-[10px] text-[#888888] mt-auto">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Data za Max zinalindwa na hazitoki kwenye seva.</span>
      </div>
    </aside>
  );
};
export default RightSidebar;
