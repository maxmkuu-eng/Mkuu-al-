import React, { useState } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
  Clock,
  AlertTriangle,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Memory } from '../types';

interface MemoryCenterProps {
  memories: Memory[];
  onAddMemory: (memory: { content: string; category: Memory['category']; importance: Memory['importance']; tags: string[] }) => Promise<void>;
  onEditMemory: (id: string, updates: Partial<Memory>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onTestQuery: (query: string) => Promise<string>;
}

export const MemoryCenter: React.FC<MemoryCenterProps> = ({
  memories,
  onAddMemory,
  onEditMemory,
  onDeleteMemory,
  onTestQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form state
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<Memory['category']>('General');
  const [newImportance, setNewImportance] = useState<Memory['importance']>('high');
  const [newTags, setNewTags] = useState('');

  // Interactive Test State
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const categories = ['All', 'Preferences', 'Work', 'Family', 'Health', 'Finance', 'Rules', 'General'];

  const filteredMemories = memories.filter((mem) => {
    const matchesSearch =
      mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || mem.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const tagsArray = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await onAddMemory({
      content: newContent.trim(),
      category: newCategory,
      importance: newImportance,
      tags: tagsArray,
    });

    setNewContent('');
    setNewTags('');
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory || !editingMemory.content.trim()) return;

    await onEditMemory(editingMemory.id, {
      content: editingMemory.content,
      category: editingMemory.category,
      importance: editingMemory.importance,
    });

    setEditingMemory(null);
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || isTesting) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const answer = await onTestQuery(testInput);
      setTestResult(answer);
    } catch (e: any) {
      setTestResult(`Hitilafu: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
              <Brain className="w-3.5 h-3.5" />
              <span>MAX MEMORY ENGINE • SERVER PERSISTED</span>
            </div>
            <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
              Kumbukumbu za Kudumu za Max
            </h2>
            <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
              Kumbukumbu hizi zimehifadhiwa kwenye database ya kudumu ya seva. Zinabaki milele hata ukifungua
              mazungumzo mapya au ukizima kifaa. MKUU AI huzitumia kutoa majibu ya kibinafsi kwa Max.
            </p>
          </div>

          <button
            id="add-memory-top-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>HIFADHI KUMBUKUMBU</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Jumla ya Kumbukumbu</div>
          <div className="serif text-2xl font-bold text-[#F5F2ED] mt-1">{memories.length}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Kipaumbele cha Juu</div>
          <div className="serif text-2xl font-bold text-[#D4AF37] mt-1">
            {memories.filter((m) => m.importance === 'high').length}
          </div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Hifadhi ya Kudumu</div>
          <div className="serif text-2xl font-bold text-emerald-400 mt-1">100% Salama</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Mmiliki Pekee</div>
          <div className="serif text-2xl font-bold text-[#D4AF37] mt-1">MAX</div>
        </div>
      </div>

      {/* Interactive Memory Test Playground */}
      <div className="glass p-5 rounded-2xl border border-[#222222] border-l-2 border-[#D4AF37] shadow-xl space-y-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="serif text-sm font-bold text-[#F5F2ED]">
            Jaribu Urejesho wa Kumbukumbu (Memory Retrieval Test)
          </h3>
        </div>
        <p className="text-xs text-[#888888]">
          Uliza swali lolote la kibinafsi (mfano: "Unakumbuka napenda nini?") ili kuthibitisha kwamba MKUU AI anatafuta
          kwanza kwenye Max Memory kabla ya kujibu.
        </p>

        <form onSubmit={handleRunTest} className="flex flex-col sm:flex-row gap-2">
          <input
            id="memory-test-input"
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Mfano: Unakumbuka napenda lugha gani?"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
          />
          <button
            id="memory-test-submit-btn"
            type="submit"
            disabled={!testInput.trim() || isTesting}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-50 transition cursor-pointer"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>JARIBU RETRIEVAL</span>
          </button>
        </form>

        {testResult && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#111111] border border-[#D4AF37]/40 text-xs text-[#F5F2ED] serif italic">
            <div className="font-bold text-[#D4AF37] mb-1 flex items-center gap-1.5 not-italic font-sans text-[11px] uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Jibu la MKUU AI kutoka Max Memory:</span>
            </div>
            <p>"{testResult}"</p>
          </div>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="memory-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta kumbukumbu au lebo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'glass text-[#888888] border border-[#222222] hover:text-[#F5F2ED]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#888888]">
            <Brain className="w-12 h-12 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
            <p className="text-sm font-semibold text-[#F5F2ED]">Hakuna kumbukumbu iliyopatikana.</p>
            <p className="text-xs text-[#888888] mt-1">
              Gusa 'Hifadhi Kumbukumbu' au andika kwenye mazungumzo "Kumbuka hii...".
            </p>
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="3d-card glass p-4 rounded-2xl border border-[#222222] hover:border-[#D4AF37]/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                    {mem.category}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      mem.importance === 'high'
                        ? 'text-[#D4AF37] bg-[#D4AF37]/10'
                        : 'text-[#888888] bg-[#111111]'
                    }`}
                  >
                    Kipaumbele: {mem.importance}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#F5F2ED] leading-relaxed font-medium">
                  {mem.content}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#222222] flex items-center justify-between text-[11px] text-[#888888]">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3 h-3 text-[#888888]" />
                  <span>{new Date(mem.createdAt).toLocaleDateString('sw-TZ')}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setEditingMemory(mem)}
                    className="p-1.5 rounded-lg text-[#888888] hover:text-[#D4AF37] hover:bg-white/5 transition cursor-pointer"
                    title="Hariri Kumbukumbu"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingId(mem.id)}
                    className="p-1.5 rounded-lg text-[#888888] hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Futa Kabisa Kwenye Database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border border-[#222222] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="serif font-bold text-base text-[#F5F2ED] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#D4AF37]" />
                <span>Weka Kumbukumbu Mpya ya Kudumu</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#888888] hover:text-[#F5F2ED] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                  Maelezo ya Kumbukumbu (Content)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Mfano: Max anapenda chai ya maziwa asubuhi na ripoti za kiufundi kwa Kiswahili."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Kitengo</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="General">General</option>
                    <option value="Preferences">Preferences</option>
                    <option value="Work">Work</option>
                    <option value="Family">Family</option>
                    <option value="Health">Health</option>
                    <option value="Finance">Finance</option>
                    <option value="Rules">Rules</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Kipaumbele</label>
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="high">High (Kuu)</option>
                    <option value="medium">Medium (Kawaida)</option>
                    <option value="low">Low (Chini)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
                  Lebo (Tags, tenga kwa koma)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="upendeleo, lugha, ofisi"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  HIFADHI KWENYE DATABASE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border border-red-900/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-white text-base">Futa Kumbukumbu ya Kudumu?</h3>
                <p className="text-xs text-[#888888]">Kitendo hiki kitafuta rekodi moja kwa moja kwenye seva.</p>
              </div>
            </div>

            <p className="text-xs text-[#888888] leading-relaxed">
              Baada ya kufuta, MKUU AI hataweza tena kuipata au kuikumbuka taarifa hii hata ukimwuliza kwenye
              mazungumzo mapya.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={async () => {
                  await onDeleteMemory(deletingId);
                  setDeletingId(null);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                NDIYO, FUTA KABISA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MemoryCenter;
