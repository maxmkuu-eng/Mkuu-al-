import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  ChatMessage,
  Conversation,
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
import { ChatHistoryView } from './components/ChatHistoryView';
import { VoiceModal } from './components/VoiceModal';
import { MemoryCenter } from './components/MemoryCenter';
import { PeopleCenter } from './components/PeopleCenter';
import { AutoReplyCenter } from './components/AutoReplyCenter';
import { FilesCenter } from './components/FilesCenter';
import { SecurityCenter } from './components/SecurityCenter';
import { RightSidebar } from './components/RightSidebar';
import { FileGeneratorModal } from './components/FileGeneratorModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { localChatStorage } from './services/localChatStorage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>('conv_main_max');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
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

  // Monitor network online / offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // 1. Initial Local Database Hydration (Immediate & Offline-Ready)
  useEffect(() => {
    const initLocalData = async () => {
      await localChatStorage.init();
      const localConvs = await localChatStorage.getAllConversations();
      
      if (localConvs && localConvs.length > 0) {
        setConversations(localConvs);
        const activeId = localChatStorage.getActiveConversationId();
        const activeConv = localConvs.find((c) => c.id === activeId) || localConvs[0];
        setConversationId(activeConv.id);
        setMessages(activeConv.messages || []);
      } else {
        // Create initial default conversation
        const initialConv: Conversation = {
          id: 'conv_main_max',
          userId: 'user_max_owner',
          title: 'Mazungumzo ya Awali',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        await localChatStorage.saveConversation(initialConv);
        setConversations([initialConv]);
        setConversationId(initialConv.id);
        setMessages([]);
      }
    };

    initLocalData();
  }, []);

  // 2. Initial Remote Data Fetching & Synchronization
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

      // Fetch conversations from server and merge into local DB
      const remoteConvs = await fetchJson<Conversation[]>('/api/conversations');
      if (remoteConvs && Array.isArray(remoteConvs)) {
        for (const rConv of remoteConvs) {
          await localChatStorage.saveConversation(rConv);
        }
        const updatedLocal = await localChatStorage.getAllConversations();
        setConversations(updatedLocal);
      }
    } catch (e) {
      console.warn('Network sync notice (running with local cache):', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Send Message with Offline-First Local Persistence
  const handleSendMessage = async (text: string, isVoice = false, attachments: AttachmentItem[] = []) => {
    if (!text.trim() && attachments.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      isVoice,
      attachments,
      savedOffline: true,
    };

    // 1. Immediately persist user message to local IndexedDB & LocalStorage
    const updatedConv = await localChatStorage.addMessage(conversationId, userMsg);
    setMessages(updatedConv.messages);
    
    // Refresh conversation list in state
    const allConvs = await localChatStorage.getAllConversations();
    setConversations(allConvs);

    setIsLoading(true);

    // 2. If browser reports offline immediately, inform user and keep message stored safely
    if (!navigator.onLine) {
      setIsLoading(false);
      const offlineAiNotice: ChatMessage = {
        id: `msg_offline_${Date.now()}`,
        role: 'assistant',
        content: `Samahani Max, kwa sasa kifaa chako kipo **Offline** (hakuna intaneti). Ujumbe wako umehifadhiwa salama kwenye kumbukumbu ya ndani ya kifaa hiki. Pindi utakapounganishwa na intaneti, MKUU AI ataweza kuchakata na kutoa majibu mapya.`,
        timestamp: new Date().toISOString(),
        savedOffline: true,
      };

      const finalConv = await localChatStorage.addMessage(conversationId, offlineAiNotice);
      setMessages(finalConv.messages);
      const refreshedConvs = await localChatStorage.getAllConversations();
      setConversations(refreshedConvs);
      return {
        reply: offlineAiNotice.content,
        cleanSpeechText: offlineAiNotice.content,
      };
    }

    // 3. Attempt online API call
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
        throw new Error(`Hitilafu ya mawasiliano na seva (${res.status})`);
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
        savedOffline: true,
      };

      // Persist AI response to local DB
      const finalConv = await localChatStorage.addMessage(conversationId, aiMsg);
      setMessages(finalConv.messages);

      const refreshedConvs = await localChatStorage.getAllConversations();
      setConversations(refreshedConvs);

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
      console.warn('Chat request failed; preserving local history:', e);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `Samahani Max, mawasiliano na seva ya AI yamekatika au hakuna mtandao: ${e.message}. Ujumbe wako umehifadhiwa salama kwenye kumbukumbu ya ndani ya kifaa chako.`,
        timestamp: new Date().toISOString(),
        savedOffline: true,
      };

      const finalConv = await localChatStorage.addMessage(conversationId, errorMsg);
      setMessages(finalConv.messages);
      const refreshedConvs = await localChatStorage.getAllConversations();
      setConversations(refreshedConvs);

      return {
        reply: errorMsg.content,
        cleanSpeechText: errorMsg.content,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Start New Conversation
  const handleNewChat = async () => {
    const newId = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      userId: 'user_max_owner',
      title: 'Mazungumzo Mapya',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    await localChatStorage.saveConversation(newConv);
    localChatStorage.setActiveConversationId(newId);
    setConversationId(newId);
    setMessages([]);
    const all = await localChatStorage.getAllConversations();
    setConversations(all);
    setActiveTab('chat');
  };

  // Select Conversation from Chat History
  const handleSelectConversation = async (id: string) => {
    const conv = await localChatStorage.getConversation(id);
    if (conv) {
      setConversationId(conv.id);
      setMessages(conv.messages || []);
      localChatStorage.setActiveConversationId(conv.id);
      setActiveTab('chat');
    }
  };

  // Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    const conv = await localChatStorage.getConversation(id);
    if (conv) {
      conv.title = newTitle;
      await localChatStorage.saveConversation(conv);
      const all = await localChatStorage.getAllConversations();
      setConversations(all);
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    await localChatStorage.deleteConversation(id);
    const all = await localChatStorage.getAllConversations();
    setConversations(all);

    // If active conversation was deleted, switch to next available or create new
    if (conversationId === id) {
      if (all.length > 0) {
        setConversationId(all[0].id);
        setMessages(all[0].messages || []);
        localChatStorage.setActiveConversationId(all[0].id);
      } else {
        await handleNewChat();
      }
    }

    // Also attempt delete on server
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    } catch {
      // Ignore offline delete error
    }
  };

  // Delete Single Message
  const handleDeleteMessage = async (msgId: string) => {
    const updated = await localChatStorage.deleteMessage(conversationId, msgId);
    if (updated) {
      setMessages(updated.messages);
      const all = await localChatStorage.getAllConversations();
      setConversations(all);
    }
  };

  // Export History
  const handleExportHistory = async () => {
    const jsonStr = await localChatStorage.exportDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MKUU_AI_CHAT_HISTORY_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Active conversation title resolver
  const activeConversationTitle = conversations.find((c) => c.id === conversationId)?.title || 'Mkuu Chat';

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

  const handleExportAllData = async () => {
    const allConvs = await localChatStorage.getAllConversations();
    const fullBackup = {
      exportDate: new Date().toISOString(),
      owner: user,
      memories,
      people,
      files,
      autoReplySettings,
      autoReplyLogs,
      conversations: allConvs,
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MKUU_AI_MAX_FULL_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    await localChatStorage.clearAllConversations();
    const res = await fetch('/api/system/reset', { method: 'POST' });
    if (res.ok) {
      await fetchAllData();
      setMessages([]);
      setConversations([]);
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
        conversationCount={conversations.length}
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
            conversationTitle={activeConversationTitle}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onNewChat={handleNewChat}
            onOpenHistory={() => setActiveTab('history')}
            onDeleteMessage={handleDeleteMessage}
            onOpenMemoryModal={() => setActiveTab('memory')}
            onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
            onPreviewDocument={(file) => setPreviewingFile(file)}
            memories={memories}
            people={people}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'history' && (
          <ChatHistoryView
            conversations={conversations}
            activeConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewChat}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            onExportHistory={handleExportHistory}
            isOnline={isOnline}
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

