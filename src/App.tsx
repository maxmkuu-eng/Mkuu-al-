import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  ChatMessage,
  Memory,
  Person,
  GeneratedFileSummary,
  AutoReplySettings,
  AutoReplyLog,
  UserProfile,
  AttachmentItem,
} from './types';
import { Navigation } from './components/Navigation';
import { ChatView } from './components/ChatView';
import { VoiceModal } from './components/VoiceModal';
import { MemoryCenter } from './components/MemoryCenter';
import { PeopleCenter } from './components/PeopleCenter';
import { AutoReplyCenter } from './components/AutoReplyCenter';
import { FilesCenter } from './components/FilesCenter';
import { SecurityCenter } from './components/SecurityCenter';
import { RightSidebar } from './components/RightSidebar';
import { FileGeneratorModal } from './components/FileGeneratorModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>('conv_main_max');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [files, setFiles] = useState<GeneratedFileSummary[]>([]);
  const [autoReplySettings, setAutoReplySettings] = useState<AutoReplySettings>({
    userId: 'user_max_owner',
    enabled: true,
    emergencyStop: false,
    mode: 'automatic',
    language: 'Kiswahili',
    tone: 'Heshima & Ueledi',
    workingHours: { enabled: true, start: '08:00', end: '20:00' },
    myPhoneNumber: '+255 754 000 111',
    smsEnabled: true,
    gmailEnabled: true,
    safetyRules: [
      'Kamwe usitoe nenosiri, siri za kibenki, au taarifa binafsi za Max.',
      'Mjibu kila mtu kwa heshima na uadilifu kulingana na daraja lake katika Watu wa Karibu.',
      'Kwa masuala nyeti au ya dharura sana, mjulishe mtumaji kwamba Max atampigia mwenyewe.',
    ],
    whitelistedNumbers: [],
    blacklistedNumbers: [],
  });
  const [autoReplyLogs, setAutoReplyLogs] = useState<AutoReplyLog[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isFileGeneratorModalOpen, setIsFileGeneratorModalOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<GeneratedFileSummary | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Safe JSON fetch helper
  const fetchJson = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) return null;
      return (await res.json()) as T;
    } catch (e) {
      console.warn(`Fetch error for ${url}:`, e);
      return null;
    }
  };

  // Initial Data Fetching from Server
  const fetchAllData = async () => {
    try {
      // User Profile
      const userData = await fetchJson<any>('/api/me');
      if (userData) {
        setUser(userData.user || userData);
      }

      // Memories
      const memData = await fetchJson<Memory[]>('/api/memories');
      if (memData && Array.isArray(memData)) {
        setMemories(memData);
      }

      // People
      const peopleData = await fetchJson<Person[]>('/api/people');
      if (peopleData && Array.isArray(peopleData)) {
        setPeople(peopleData);
      }

      // Files
      const filesData = await fetchJson<GeneratedFileSummary[]>('/api/files');
      if (filesData && Array.isArray(filesData)) {
        setFiles(filesData);
      }

      // Auto Reply Settings
      const settingsData = await fetchJson<AutoReplySettings>('/api/autoreply/settings');
      if (settingsData && settingsData.userId) {
        setAutoReplySettings(settingsData);
      }

      // Auto Reply Logs
      const logsData = await fetchJson<AutoReplyLog[]>('/api/autoreply/logs');
      if (logsData && Array.isArray(logsData)) {
        setAutoReplyLogs(logsData);
      }

      // Existing Conversation Messages
      const convData = await fetchJson<any>('/api/conversations/conv_main_max');
      if (convData && convData.messages && convData.messages.length > 0) {
        setMessages(convData.messages);
      }
    } catch (e) {
      console.error('Failed to fetch initial data:', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Send Message to MKUU AI with multimodal attachment support
  const handleSendMessage = async (text: string, isVoice = false, attachments: AttachmentItem[] = []) => {
    if (!text.trim() && attachments.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      isVoice,
      attachments,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
          isVoice,
          attachments,
        }),
      });

      if (!res.ok) {
        throw new Error('Hitilafu ya seva');
      }

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        isVoice,
        generatedFiles: data.generatedFiles,
        memoryExtracted: data.memoriesExtracted?.map((m: any) => m.content || m),
        personRecognized: data.peopleRecognized?.map((p: any) => p.name || p),
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If new files or memories were created during chat, refresh their state
      if (data.generatedFiles && data.generatedFiles.length > 0) {
        const filesRes = await fetch('/api/files');
        if (filesRes.ok) setFiles(await filesRes.json());
      }

      if (data.memoriesExtracted && data.memoriesExtracted.length > 0) {
        const memRes = await fetch('/api/memories');
        if (memRes.ok) setMemories(await memRes.json());
      }

      return {
        reply: data.reply,
        cleanSpeechText: data.cleanSpeechText || data.reply,
      };
    } catch (e: any) {
      console.error('Chat error:', e);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `Samahani Max, kumetokea hitilafu ya mawasiliano: ${e.message}. Tafadhali jaribu tena.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      return {
        reply: errorMsg.content,
        cleanSpeechText: errorMsg.content,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Emergency Stop Toggle
  const handleEmergencyStopToggle = async () => {
    try {
      const newStatus = !autoReplySettings.emergencyStop;
      const res = await fetch('/api/autoreply/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setAutoReplySettings(data.settings);
      }
    } catch (e) {
      console.error('Emergency stop toggle failed:', e);
    }
  };

  // Start New Conversation
  const handleNewChat = () => {
    setConversationId(`conv_${Date.now()}`);
    setMessages([]);
  };

  // Memory Handlers
  const handleAddMemory = async (memory: {
    content: string;
    category: Memory['category'];
    importance: Memory['importance'];
    tags: string[];
  }) => {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    if (res.ok) {
      const newMem = await res.json();
      setMemories((prev) => [newMem, ...prev]);
    }
  };

  const handleEditMemory = async (id: string, updates: Partial<Memory>) => {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updatedMem = await res.json();
      setMemories((prev) => prev.map((m) => (m.id === id ? updatedMem : m)));
    }
  };

  const handleDeleteMemory = async (id: string) => {
    const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleTestMemoryQuery = async (query: string): Promise<string> => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Swali kuhusu kumbukumbu za Max: ${query}`,
        }),
      });
      const data = await res.json();
      return data.reply;
    } catch (e: any) {
      return `Hitilafu ya ukaguzi: ${e.message}`;
    }
  };

  // People Handlers
  const handleAddPerson = async (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personData),
    });
    if (res.ok) {
      const newPerson = await res.json();
      setPeople((prev) => [newPerson, ...prev]);
    }
  };

  const handleEditPerson = async (id: string, updates: Partial<Person>) => {
    const res = await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updatedPerson = await res.json();
      setPeople((prev) => prev.map((p) => (p.id === id ? updatedPerson : p)));
    }
  };

  const handleDeletePerson = async (id: string) => {
    const res = await fetch(`/api/people/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPeople((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleAskAboutPerson = (name: string) => {
    setActiveTab('chat');
    handleSendMessage(`Nieleze kuhusu ${name} kutoka kwenye orodha yangu ya Watu wa Karibu.`);
  };

  // Auto Reply Handlers
  const handleUpdateAutoReplySettings = async (newSettings: Partial<AutoReplySettings>) => {
    try {
      const res = await fetch('/api/autoreply/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const updated = await res.json();
        setAutoReplySettings(updated);
        return updated;
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Haikuweza kusasisha mipangilio.');
      }
    } catch (err) {
      console.error('Error updating auto reply settings:', err);
      throw err;
    }
  };

  const handleSimulateInbound = async (params: {
    sender: string;
    message: string;
    channel: 'sms' | 'gmail';
  }): Promise<AutoReplyLog> => {
    try {
      const res = await fetch('/api/autoreply/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: params.sender,
          content: params.message,
          channel: params.channel,
        }),
      });
      const data = await res.json();

      // Refresh logs
      const logsRes = await fetch('/api/autoreply/logs');
      if (logsRes.ok) {
        const freshLogs = await logsRes.json();
        setAutoReplyLogs(freshLogs);
      }

      return data.log || {
        id: `sim_${Date.now()}`,
        userId: 'user_max_owner',
        timestamp: new Date().toISOString(),
        channel: params.channel,
        sender: params.sender,
        recipient: 'Max (+255 754 000 111)',
        incomingMessage: params.message,
        generatedReply: data.replyContent || 'Jibu lililozalishwa',
        status: data.autoReplied ? 'sent' : 'blocked_emergency',
        confidence: 0.95,
      };
    } catch (e: any) {
      return {
        id: `sim_err_${Date.now()}`,
        userId: 'user_max_owner',
        timestamp: new Date().toISOString(),
        channel: params.channel,
        sender: params.sender,
        recipient: 'Max (+255 754 000 111)',
        incomingMessage: params.message,
        generatedReply: '',
        status: 'failed',
        confidence: 0,
      };
    }
  };

  const handleClearLogs = async () => {
    const res = await fetch('/api/autoreply/logs/clear', { method: 'POST' });
    if (res.ok) {
      setAutoReplyLogs([]);
    }
  };

  // Files Handlers
  const handleDeleteFile = async (id: string) => {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (previewingFile?.id === id) {
        setPreviewingFile(null);
      }
    } else {
      throw new Error('Faili haikuweza kufutwa.');
    }
  };

  const handleGenerateFile = async (params: {
    title: string;
    fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
    contentPrompt: string;
  }): Promise<GeneratedFileSummary> => {
    const res = await fetch('/api/files/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: params.title,
        fileType: params.fileType,
        contentPrompt: params.contentPrompt,
      }),
    });

    if (!res.ok) {
      throw new Error('Haikuweza kutengeneza faili.');
    }

    const newFile = await res.json();
    setFiles((prev) => [newFile, ...prev]);
    return newFile;
  };

  // Security / Settings Handlers
  const handleUpdatePin = async (newPin: string) => {
    const res = await fetch('/api/user/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user || data);
    }
  };

  const handleExportAllData = () => {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      owner: user,
      memories,
      people,
      files,
      autoReplySettings,
      autoReplyLogs,
      conversations: messages,
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MKUU_AI_MAX_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    const res = await fetch('/api/system/reset', { method: 'POST' });
    if (res.ok) {
      await fetchAllData();
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#07090e] text-slate-100 font-sans">
      {/* Left Navigation Sidebar & Mobile Header */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        emergencyStop={autoReplySettings.emergencyStop}
        onEmergencyStopToggle={handleEmergencyStopToggle}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        memoryCount={memories.length}
        peopleCount={people.length}
        filesCount={files.length}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 w-full overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onNewChat={handleNewChat}
            onOpenMemoryModal={() => setActiveTab('memory')}
            onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
            onPreviewDocument={(file) => setPreviewingFile(file)}
            memories={memories}
            people={people}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryCenter
            memories={memories}
            onAddMemory={handleAddMemory}
            onEditMemory={handleEditMemory}
            onDeleteMemory={handleDeleteMemory}
            onTestQuery={handleTestMemoryQuery}
          />
        )}

        {activeTab === 'people' && (
          <PeopleCenter
            people={people}
            onAddPerson={handleAddPerson}
            onEditPerson={handleEditPerson}
            onDeletePerson={handleDeletePerson}
            onSimulateMessage={(sender, msg) => {
              setActiveTab('autoreply');
            }}
            onAskAboutPerson={handleAskAboutPerson}
          />
        )}

        {activeTab === 'autoreply' && (
          <AutoReplyCenter
            settings={autoReplySettings}
            logs={autoReplyLogs}
            people={people}
            onUpdateSettings={handleUpdateAutoReplySettings}
            onEmergencyStopToggle={handleEmergencyStopToggle}
            onSimulateInbound={handleSimulateInbound}
            onClearLogs={handleClearLogs}
          />
        )}

        {activeTab === 'files' && (
          <FilesCenter
            files={files}
            onDeleteFile={handleDeleteFile}
            onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
            onPreviewDocument={(file) => setPreviewingFile(file)}
            onFileUploadSuccess={(newFile) => setFiles((prev) => [newFile, ...prev])}
            onAskChatAboutFile={(filename) => {
              setActiveTab('chat');
              handleSendMessage(`Tafadhali nisaidie kuchambua na kueleza muhtasari wa faili la "${filename}".`);
            }}
          />
        )}

        {activeTab === 'security' && (
          <SecurityCenter
            user={user}
            memories={memories}
            people={people}
            autoReplySettings={autoReplySettings}
            onExportAllData={handleExportAllData}
            onUpdatePin={handleUpdatePin}
            onClearAllData={handleClearAllData}
          />
        )}
      </main>

      {/* Right Desktop Sidebar */}
      <RightSidebar
        memories={memories}
        people={people}
        files={files}
        autoReplySettings={autoReplySettings}
        setActiveTab={setActiveTab}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
      />

      {/* Voice Assistant Full Modal (Live STT/TTS & Soundwave Animation) */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendMessage={async (msg, isVoice) => {
          const res = await handleSendMessage(msg, isVoice);
          return res || { reply: '', cleanSpeechText: '' };
        }}
        memories={memories}
        people={people}
      />

      {/* Real File Generator Modal */}
      <FileGeneratorModal
        isOpen={isFileGeneratorModalOpen}
        onClose={() => setIsFileGeneratorModalOpen(false)}
        onGenerateFile={handleGenerateFile}
      />

      {/* In-App Real Document & Image Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewingFile}
        onClose={() => setPreviewingFile(null)}
        file={previewingFile}
        onDelete={handleDeleteFile}
      />
    </div>
  );
};
export default App;
