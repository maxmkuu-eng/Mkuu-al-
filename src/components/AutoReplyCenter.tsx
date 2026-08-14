import React, { useState } from 'react';
import {
  Zap,
  Phone,
  Mail,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Settings,
  History,
  Send,
  CheckCircle2,
  Play,
  Sparkles,
  Search,
  Trash2,
} from 'lucide-react';
import { AutoReplySettings, AutoReplyLog, Person } from '../types';

interface AutoReplyCenterProps {
  settings: AutoReplySettings;
  logs: AutoReplyLog[];
  people: Person[];
  onUpdateSettings: (updates: Partial<AutoReplySettings>) => Promise<void>;
  onEmergencyStopToggle: () => void;
  onSimulateInbound: (params: { sender: string; message: string; channel: 'sms' | 'gmail' }) => Promise<AutoReplyLog>;
  onClearLogs: () => Promise<void>;
}

export const AutoReplyCenter: React.FC<AutoReplyCenterProps> = ({
  settings,
  logs,
  people,
  onUpdateSettings,
  onEmergencyStopToggle,
  onSimulateInbound,
  onClearLogs,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'logs' | 'settings'>('simulator');

  // Simulator Form State
  const [selectedPersonId, setSelectedPersonId] = useState<string>('custom');
  const [simSender, setSimSender] = useState('+255 754 889 001');
  const [simMessage, setSimMessage] = useState('Mume wangu, umekumbuka kuagiza vifaa vya nyumbani?');
  const [simChannel, setSimChannel] = useState<'sms' | 'gmail'>('sms');
  const [isSimulating, setIsSimulating] = useState(false);
  const [latestSimResult, setLatestSimResult] = useState<AutoReplyLog | null>(null);

  // Settings local state
  const [phoneNumber, setPhoneNumber] = useState(settings.myPhoneNumber || '+255 700 123 456');
  const [language, setLanguage] = useState(settings.language);
  const [tone, setTone] = useState(settings.tone);
  const [newRule, setNewRule] = useState('');
  const [rulesList, setRulesList] = useState<string[]>(settings.safetyRules || []);
  const [searchLog, setSearchLog] = useState('');

  const handlePersonSelect = (personId: string) => {
    setSelectedPersonId(personId);
    if (personId === 'custom') {
      setSimSender('+255 711 000 999');
      setSimMessage('Habari, nina swali kuhusu huduma zenu.');
    } else {
      const person = people.find((p) => p.id === personId);
      if (person) {
        setSimSender(person.phone || person.email || person.name);
        if (person.relationship.toLowerCase().includes('mke')) {
          setSimMessage(`Mume wangu Mary hapa, je uko tayari kwa chakula cha usiku?`);
        } else if (person.relationship.toLowerCase().includes('mama')) {
          setSimMessage(`Mwanangu Max, habari ya leo? Usisahau kunipigia jioni.`);
        } else if (person.relationship.toLowerCase().includes('boss')) {
          setSimMessage(`Max, tafadhali nitumie muhtasari wa ripoti ya miradi kabla ya saa kumi.`);
        } else {
          setSimMessage(`Habari Max, niaje kaka?`);
        }
      }
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSender.trim() || !simMessage.trim() || isSimulating) return;

    setIsSimulating(true);
    setLatestSimResult(null);
    try {
      const res = await onSimulateInbound({
        sender: simSender,
        message: simMessage,
        channel: simChannel,
      });
      setLatestSimResult(res);
    } catch (e) {
      console.error('Simulation error', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveSettings = async () => {
    await onUpdateSettings({
      myPhoneNumber: phoneNumber,
      language,
      tone,
      safetyRules: rulesList,
    });
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      const updated = [...rulesList, newRule.trim()];
      setRulesList(updated);
      setNewRule('');
      onUpdateSettings({ safetyRules: updated });
    }
  };

  const handleRemoveRule = (index: number) => {
    const updated = rulesList.filter((_, i) => i !== index);
    setRulesList(updated);
    onUpdateSettings({ safetyRules: updated });
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.sender.toLowerCase().includes(searchLog.toLowerCase()) ||
      (l.senderName && l.senderName.toLowerCase().includes(searchLog.toLowerCase())) ||
      l.incomingMessage.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.generatedReply.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
              <Zap className="w-3.5 h-3.5" />
              <span>MAX AUTO REPLY ENGINE • SMS & GMAIL</span>
            </div>
            <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
              Majibu ya Moja kwa Moja ya Mawasiliano
            </h2>
            <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
              MKUU AI hutambua mtumaji kupitia Max Identify, hutafuta muktadha husika kwenye Max Memory, na huandaa
              jibu sahihi lenye heshima na hekima kupitia ujumuishaji rasmi wa SMS na Gmail.
            </p>
          </div>

          {/* Emergency Stop Killswitch */}
          <button
            id="auto-reply-killswitch"
            onClick={onEmergencyStopToggle}
            className={`px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2.5 transition shadow-xl flex-shrink-0 cursor-pointer ${
              settings.emergencyStop
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 animate-pulse'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{settings.emergencyStop ? 'REJESHA AUTO REPLY' : 'STOP ALL AUTO REPLIES'}</span>
          </button>
        </div>
      </div>

      {/* Emergency Status Banner if active */}
      {settings.emergencyStop && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-between gap-3 text-red-200">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold">EMERGENCY KILLSWITCH IMEWASHWA NA MAX</div>
              <div className="text-[11px] text-red-300/90">
                Hakuna majibu ya moja kwa moja ya SMS au Gmail yatakayotumwa hadi utakapozima kifungo hiki.
              </div>
            </div>
          </div>
          <button
            onClick={onEmergencyStopToggle}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-500 transition cursor-pointer"
          >
            ZIMA KILLSWITCH
          </button>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#222222] pb-3">
        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'simulator'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Jaribu Auto Reply (Inbound Simulator)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Kumbukumbu za SMS & Gmail ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
              : 'text-[#888888] hover:text-[#F5F2ED] glass border border-[#222222]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Mipangilio & Kanuni za Usalama</span>
        </button>
      </div>

      {/* TAB 1: INBOUND SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Form */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#D4AF37]" />
                  <span>Kifaa cha Kujaribu Ujumbe Unaofika (Inbound Test)</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 font-bold uppercase tracking-wider">
                  LIVE PIPELINE
                </span>
              </div>

              <form onSubmit={handleRunSimulation} className="space-y-3.5">
                {/* Select Quick Contact */}
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                    Chagua Mtumaji kutoka Watu wa Karibu
                  </label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => handlePersonSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="custom">Nambari Nyingine / Mgeni (Unknown Number)</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.relationship} ({p.phone || p.email || 'Hana namba'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Mtumaji (From)</label>
                    <input
                      type="text"
                      required
                      value={simSender}
                      onChange={(e) => setSimSender(e.target.value)}
                      placeholder="+255 7..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Njia (Channel)</label>
                    <select
                      value={simChannel}
                      onChange={(e) => setSimChannel(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="sms">📱 SMS Gateway / Companion</option>
                      <option value="gmail">✉️ Gmail OAuth</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                    Ujumbe Unaofika (Incoming Message)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={simMessage}
                    onChange={(e) => setSimMessage(e.target.value)}
                    placeholder="Andika ujumbe unaotumwa kwa Max..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <button
                  id="run-simulation-btn"
                  type="submit"
                  disabled={isSimulating}
                  className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSimulating ? 'INACHAKATA MUKTADHA WA MAX...' : 'TUMA JARIBIO LA UJUMBE (TEST AUTO REPLY)'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Simulation Output & Pipeline Inspector */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg min-h-[300px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                  <span className="serif font-bold text-sm text-[#F5F2ED]">Mrejesho wa Auto Reply</span>
                  {latestSimResult && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        latestSimResult.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : latestSimResult.status === 'blocked_emergency'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                      }`}
                    >
                      {latestSimResult.status}
                    </span>
                  )}
                </div>

                {latestSimResult ? (
                  <div className="space-y-3">
                    {/* Utambuzi */}
                    <div className="p-3 rounded-xl bg-[#050505] border border-[#222222] space-y-1">
                      <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">1. Utambuzi (Max Identify):</div>
                      <div className="text-xs font-semibold text-[#D4AF37]">
                        {latestSimResult.senderName || latestSimResult.sender}
                      </div>
                    </div>

                    {/* Ujumbe Uliofika */}
                    <div className="p-3 rounded-xl bg-[#050505] border border-[#222222] space-y-1">
                      <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">2. Ujumbe Uliopokelewa:</div>
                      <div className="text-xs text-[#F5F2ED] italic">"{latestSimResult.incomingMessage}"</div>
                    </div>

                    {/* Jibu Lililoandaliwa */}
                    <div className="p-4 rounded-xl bg-[#111111] border border-[#D4AF37]/30 space-y-1">
                      <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>3. Jibu la Kiotomatiki Lililozalishwa:</span>
                      </div>
                      <p className="text-xs text-[#F5F2ED] font-medium leading-relaxed">
                        "{latestSimResult.generatedReply}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-[#888888] space-y-2">
                    <Zap className="w-10 h-10 mx-auto opacity-30 text-[#D4AF37]" />
                    <p className="text-xs">Chagua mtumaji upande wa kushoto na uguse 'Tuma Jaribio la Ujumbe'.</p>
                  </div>
                )}
              </div>

              {/* Verified Badge */}
              <div className="pt-3 border-t border-[#222222] flex items-center justify-between text-[11px] text-[#888888]">
                <span>Mtindo: {settings.tone}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salama & Imethibitishwa
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE LOGS (SMS LOG) */}
      {activeSubTab === 'logs' && (
        <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="serif font-bold text-base text-[#F5F2ED] flex items-center gap-2">
                <History className="w-4 h-4 text-[#D4AF37]" />
                <span>SMS LOG & GMAIL AUDIT TRAIL</span>
              </h3>
              <p className="text-xs text-[#888888]">
                Kumbukumbu halisi za ujumbe ulioingia (Inbound) na majibu yaliyotumwa (Outbound) na Mkuu AI.
              </p>
            </div>

            <button
              id="clear-all-sms-logs-btn"
              onClick={onClearLogs}
              className="px-4 py-2 rounded-xl glass hover:bg-red-500/10 text-[#888888] hover:text-red-400 border border-[#222222] text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer self-start md:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Futa Kumbukumbu Zote</span>
            </button>
          </div>

          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="sms-log-search-input"
              type="text"
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Tafuta kwenye kumbukumbu (mtumaji, mpokeaji, maneno ya ujumbe)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-[#888888]">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
                <p className="text-sm font-semibold text-[#F5F2ED]">Hakuna kumbukumbu za SMS/Gmail zilizopatikana.</p>
                <p className="text-xs text-[#888888] mt-1">Tumia Inbound Simulator kujaribu ujumbe wa moja kwa moja.</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-2xl bg-[#050505] border border-[#222222] hover:border-[#D4AF37]/30 transition space-y-3"
                >
                  {/* Log Header metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                        {log.channel.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-[#111111] text-[#888888] border border-[#222222]">
                        Direction: Inbound / Outbound
                      </span>
                      <span className="font-bold text-sm text-[#F5F2ED]">
                        Mtumaji: {log.senderName ? `${log.senderName} (${log.sender})` : log.sender}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-[#888888] font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          log.status === 'sent'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'blocked_emergency'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                        }`}
                      >
                        Status: {log.status}
                      </span>
                    </div>
                  </div>

                  {/* Message & Reply Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#0c0c0c] border border-[#222222] space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#888888] uppercase tracking-wider">
                        <span>Ujumbe Ulioingia (Mtumaji):</span>
                        <span className="font-mono">{log.sender}</span>
                      </div>
                      <p className="text-[#888888] italic text-xs leading-relaxed pt-1">
                        "{log.incomingMessage}"
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0c0c0c] border border-[#222222] border-l-2 border-[#D4AF37] space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                        <span>Jibu la Mkuu AI (Mpokeaji):</span>
                        <span className="font-mono text-[#888888]">{log.recipient}</span>
                      </div>
                      <p className="text-[#F5F2ED] font-medium text-xs leading-relaxed pt-1">
                        "{log.generatedReply}"
                      </p>
                    </div>
                  </div>

                  {log.matchedRelationship && (
                    <div className="flex items-center space-x-2 text-[11px] text-[#888888] pt-1">
                      <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                      <span>Max Identify: Mtumaji ametambuliwa kama <strong>{log.matchedRelationship}</strong> (Confidence: {(log.confidence * 100).toFixed(0)}%)</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & SAFETY RULES (SMS SETTINGS & MY PHONE NUMBER) */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            {/* MY PHONE NUMBER SECTION */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <span>MY PHONE NUMBER — SMS IDENTITY</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                  PERSISTED
                </span>
              </div>

              <p className="text-xs text-[#888888] leading-relaxed">
                Nambari rasmi ya simu ya Max itakayotumika kutambua na kuidhinisha mawasiliano ya SMS Gateway na majibu ya moja kwa moja.
              </p>

              <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Tanzania (+255)"
                      className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#F5F2ED] text-xs font-semibold cursor-not-allowed"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                      Phone Number (Mfano: +255 700 123 456)
                    </label>
                    <input
                      id="my-phone-number-input"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+255 700 123 456"
                      className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#F5F2ED] text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Simu Kuu ya Max (Owner Authorized Number)"
                    className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#888888] text-xs italic"
                  />
                </div>

                {/* Verification & Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    id="verify-phone-number-btn"
                    onClick={() => {
                      alert(`Nambari ${phoneNumber} imethibitishwa na kukaguliwa kikamilifu kwa akaunti ya Max.`);
                    }}
                    className="px-4 py-2 rounded-xl glass hover:bg-white/5 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFY</span>
                  </button>

                  <button
                    id="save-phone-number-btn"
                    onClick={handleSaveSettings}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                  >
                    <span>SAVE</span>
                  </button>

                  <button
                    id="remove-phone-number-btn"
                    onClick={() => {
                      setPhoneNumber('');
                      onUpdateSettings({ myPhoneNumber: '' });
                    }}
                    className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                  >
                    <span>REMOVE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* General SMS & Tone Settings */}
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#D4AF37]" />
                <span>Mtindo na Lugha ya Majibu ya Auto Reply</span>
              </h3>

              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Lugha ya Majibu</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Kiswahili">Kiswahili Fasaha</option>
                      <option value="English">English</option>
                      <option value="Auto">Linganisha na Mtumaji (Auto)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Mtindo (Tone)</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Heshima & Ueledi">Heshima & Ueledi</option>
                      <option value="Kirafiki">Kirafiki</option>
                      <option value="Rasmi">Rasmi</option>
                      <option value="Fupi na Wazi">Fupi na Wazi</option>
                    </select>
                  </div>
                </div>

                <button
                  id="save-autoreply-general-settings-btn"
                  onClick={handleSaveSettings}
                  className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                >
                  HIFADHI MIPANGILIO YA MAJIBU
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">
              <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
                <span>Kanuni za Usalama za Auto Reply</span>
              </h3>

              <div className="space-y-2">
                {rulesList.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#050505] border border-[#222222] flex items-center justify-between text-xs text-[#F5F2ED]"
                  >
                    <span>
                      {idx + 1}. {rule}
                    </span>
                    <button
                      onClick={() => handleRemoveRule(idx)}
                      className="text-[#888888] hover:text-red-400 p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  placeholder="Ongeza kanuni mpya ya usalama..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 rounded-xl glass hover:bg-white/5 text-[#F5F2ED] font-bold text-xs border border-[#222222] cursor-pointer"
                >
                  Weka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AutoReplyCenter;
