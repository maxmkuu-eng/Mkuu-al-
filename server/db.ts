import fs from 'fs';
import path from 'path';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: 'General' | 'Preferences' | 'Work' | 'Family' | 'Health' | 'Finance' | 'Rules';
  importance: 'high' | 'medium' | 'low';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: 'explicit_command' | 'auto_extracted' | 'manual';
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  nickname?: string;
  relationship: string;
  phone?: string;
  email?: string;
  notes?: string;
  avatarColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isVoice?: boolean;
  generatedFiles?: GeneratedFileSummary[];
  memoryExtracted?: string[];
  personRecognized?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface GeneratedFileSummary {
  id: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md' | 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg' | 'zip' | string;
  size: number;
  mimeType: string;
  createdAt: string;
  description?: string;
  downloadUrl: string;
}

export interface AutoReplySettings {
  userId: string;
  enabled: boolean;
  emergencyStop: boolean;
  mode: 'automatic' | 'approval_required';
  language: 'Kiswahili' | 'English' | 'Auto';
  tone: 'Heshima & Ueledi' | 'Kirafiki' | 'Rasmi' | 'Fupi na Wazi';
  workingHours: { enabled: boolean; start: string; end: string };
  myPhoneNumber: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  smsEnabled: boolean;
  gmailEnabled: boolean;
  safetyRules: string[];
  whitelistedNumbers: string[];
  blacklistedNumbers: string[];
}

export interface AutoReplyLog {
  id: string;
  userId: string;
  channel: 'sms' | 'gmail';
  sender: string;
  senderName?: string;
  recipient: string;
  incomingMessage: string;
  generatedReply: string;
  status: 'sent' | 'blocked_emergency' | 'pending_approval' | 'failed' | 'outside_hours';
  timestamp: string;
  matchedPersonId?: string;
  matchedRelationship?: string;
  confidence: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  title: string;
  role: 'owner' | 'guest';
  language: 'Kiswahili' | 'English';
  theme: 'dark' | 'light';
  securityPinSet: boolean;
  securityPin?: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: UserProfile[];
  memories: Memory[];
  people: Person[];
  conversations: Conversation[];
  files: GeneratedFileSummary[];
  autoReplySettings: Record<string, AutoReplySettings>;
  autoReplyLogs: AutoReplyLog[];
}

// Vercel's deployed filesystem is read-only. /tmp is the writable area there.
// Keep the existing local JSON database for normal development/servers, but use
// /tmp for serverless execution so module initialization never crashes the function.
const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'mkuu-data') : path.join(process.cwd(), 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const DB_FILE = path.join(DATA_DIR, 'mkuu_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const DEFAULT_OWNER: UserProfile = {
  id: 'user_max_owner', email: 'maxmkuu@gmail.com', name: 'Max',
  title: 'Mkuu & Mmiliki wa Mfumo', role: 'owner', language: 'Kiswahili',
  theme: 'dark', securityPinSet: false, createdAt: new Date().toISOString(),
};

const DEFAULT_AUTO_REPLY_SETTINGS: AutoReplySettings = {
  userId: 'user_max_owner', enabled: true, emergencyStop: false,
  mode: 'automatic', language: 'Kiswahili', tone: 'Heshima & Ueledi',
  workingHours: { enabled: false, start: '08:00', end: '18:00' },
  myPhoneNumber: '', phoneVerified: false, smsEnabled: false, gmailEnabled: false,
  safetyRules: [], whitelistedNumbers: [], blacklistedNumbers: [],
};

const SEED_MEMORIES: Memory[] = [];
const SEED_PEOPLE: Person[] = [];

class Database {
  private data: DatabaseSchema;
  constructor() { this.data = this.load(); }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) { console.error('Error reading database file, initializing defaults', e); }
    const initialData: DatabaseSchema = {
      users: [DEFAULT_OWNER], memories: SEED_MEMORIES, people: SEED_PEOPLE,
      conversations: [], files: [], autoReplySettings: { user_max_owner: DEFAULT_AUTO_REPLY_SETTINGS },
      autoReplyLogs: [],
    };
    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: DatabaseSchema) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8'); }
    catch (e) { console.error('Failed to write to database file', e); }
  }
  public save() { this.saveData(this.data); }
  public getUser(userId: string) { return this.data.users.find(u => u.id === userId || u.email === userId); }
  public getOwner() { return this.data.users.find(u => u.role === 'owner') || DEFAULT_OWNER; }
  public getMemories(userId: string) { return this.data.memories.filter(m => m.userId === userId); }
  public addMemory(memory: Omit<Memory, 'id'|'createdAt'|'updatedAt'>) {
    const now = new Date().toISOString(); const newMem = { ...memory, id: `mem_${Date.now()}`, createdAt: now, updatedAt: now };
    this.data.memories.unshift(newMem); this.save(); return newMem;
  }
  public updateMemory(id: string, userId: string, updates: Partial<Memory>) {
    const idx = this.data.memories.findIndex(m => m.id === id && m.userId === userId); if (idx < 0) return null;
    this.data.memories[idx] = { ...this.data.memories[idx], ...updates, updatedAt: new Date().toISOString() }; this.save(); return this.data.memories[idx];
  }
  public deleteMemory(id: string, userId: string) { const n = this.data.memories.length; this.data.memories = this.data.memories.filter(m => !(m.id === id && m.userId === userId)); this.save(); return this.data.memories.length < n; }
  public getPeople(userId: string) { return this.data.people.filter(p => p.userId === userId); }
  public getFiles(userId: string) { return this.data.files.filter(f => f.id.startsWith(`${userId}_`) || f.description?.includes(userId)); }
  public getConversations(userId: string) { return this.data.conversations.filter(c => c.userId === userId); }
  public getConversation(id: string, userId: string) { return this.data.conversations.find(c => c.id === id && c.userId === userId); }
}

export const db = new Database();
export { DATA_DIR, FILES_DIR, DB_FILE };
