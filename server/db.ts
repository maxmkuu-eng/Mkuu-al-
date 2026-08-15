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
  relationship: string; // e.g. 'Mke wangu', 'Mama yangu', 'Rafiki', 'Boss', etc.
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
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md' | 'png' | 'zip';
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
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
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

const DATA_DIR = path.join(process.cwd(), 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const DB_FILE = path.join(DATA_DIR, 'mkuu_db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

const DEFAULT_OWNER: UserProfile = {
  id: 'user_max_owner',
  email: 'maxmkuu@gmail.com',
  name: 'Max',
  title: 'Mkuu & Mmiliki wa Mfumo',
  role: 'owner',
  language: 'Kiswahili',
  theme: 'dark',
  securityPinSet: false,
  createdAt: new Date().toISOString(),
};

const DEFAULT_AUTO_REPLY_SETTINGS: AutoReplySettings = {
  userId: 'user_max_owner',
  enabled: true,
  emergencyStop: false,
  mode: 'automatic',
  language: 'Kiswahili',
  tone: 'Heshima & Ueledi',
  workingHours: {
    enabled: false,
    start: '08:00',
    end: '18:00',
  },
  myPhoneNumber: '+255 700 123 456',
  phoneVerified: true,
  phoneVerifiedAt: new Date().toISOString(),
  smsEnabled: true,
  gmailEnabled: true,
  safetyRules: [
    'Heshimu kila mtu kulingana na uhusiano wao na Max',
    'Usitoe taarifa za siri za kibenki au nywila',
    'Kama ni ujumbe wa dharura kutoka kwa Watu wa Karibu, mjulishe Max mara moja',
    'Jibu kwa Kiswahili fasaha au lugha iliyotumika na mtumaji'
  ],
  whitelistedNumbers: [],
  blacklistedNumbers: [],
};

// Initial Seed data for Max
const SEED_MEMORIES: Memory[] = [
  {
    id: 'mem_1',
    userId: 'user_max_owner',
    content: 'Max anapendelea lugha ya Kiswahili fasaha kwa mawasiliano yote na MKUU AI.',
    category: 'Preferences',
    importance: 'high',
    tags: ['lugha', 'kiswahili', 'upendeleo'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    source: 'explicit_command',
  },
  {
    id: 'mem_2',
    userId: 'user_max_owner',
    content: 'Max ni mmiliki na msimamizi mkuu wa mifumo yote ya MKUU AI.',
    category: 'General',
    importance: 'high',
    tags: ['mmiliki', 'max', 'utambulisho'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    source: 'manual',
  },
  {
    id: 'mem_3',
    userId: 'user_max_owner',
    content: 'Miradi mikuu ya Max kwa mwaka huu inahusu ujenzi wa teknolojia za kijasusi za AI na mifumo ya kiotomatiki.',
    category: 'Work',
    importance: 'medium',
    tags: ['kazi', 'miradi', 'teknolojia'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    source: 'auto_extracted',
  }
];

const SEED_PEOPLE: Person[] = [
  {
    id: 'person_1',
    userId: 'user_max_owner',
    name: 'Mary',
    nickname: 'Mama Nani',
    relationship: 'Mke wangu',
    phone: '+255 754 889 001',
    email: 'mary.mkuu@example.com',
    notes: 'Mke mpendwa wa Max. Mtu wa kwanza wa karibu zaidi. Siku ya kumbukumbu ni 12 Desemba.',
    avatarColor: 'rose',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'person_2',
    userId: 'user_max_owner',
    name: 'Mama Zawadi',
    relationship: 'Mama yangu',
    phone: '+255 713 554 221',
    notes: 'Mama mzazi wa Max. Anapenda kupigiwa simu asubuhi na kujulishwa maendeleo.',
    avatarColor: 'amber',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'person_3',
    userId: 'user_max_owner',
    name: 'Mhandisi Juma',
    nickname: 'Boss Juma',
    relationship: 'Boss',
    phone: '+255 788 112 334',
    email: 'juma.tech@example.com',
    notes: 'Mkurugenzi wa Teknolojia. Mawasiliano naye yawe rasmi na ya kina kuhusu ripoti za kazi.',
    avatarColor: 'blue',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'person_4',
    userId: 'user_max_owner',
    name: 'Baraka',
    nickname: 'Braza',
    relationship: 'Kaka yangu',
    phone: '+255 765 990 123',
    notes: 'Kaka mkubwa wa Max. Mjasiriamali wa kilimo na biashara.',
    avatarColor: 'emerald',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  }
];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading database file, initializing defaults', e);
    }

    const initialData: DatabaseSchema = {
      users: [DEFAULT_OWNER],
      memories: SEED_MEMORIES,
      people: SEED_PEOPLE,
      conversations: [],
      files: [],
      autoReplySettings: {
        user_max_owner: DEFAULT_AUTO_REPLY_SETTINGS,
      },
      autoReplyLogs: [
        {
          id: 'log_seed_1',
          userId: 'user_max_owner',
          channel: 'sms',
          sender: '+255 754 889 001',
          senderName: 'Mary (Mke wangu)',
          recipient: '+255 700 123 456',
          incomingMessage: 'Mume wangu, umekumbuka kuagiza vifaa vya nyumbani?',
          generatedReply: 'Habari mke wangu Mary, Max yuko kwenye kikao lakini ameniagiza nikujulishe kwamba ataagiza mara moja akimaliza.',
          status: 'sent',
          timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
          matchedPersonId: 'person_1',
          matchedRelationship: 'Mke wangu',
          confidence: 0.98,
        }
      ],
    };

    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write to database file', e);
    }
  }

  public save() {
    this.saveData(this.data);
  }

  // Users
  public getUser(userId: string): UserProfile | undefined {
    return this.data.users.find((u) => u.id === userId || u.email === userId);
  }

  public getOwner(): UserProfile {
    let owner = this.data.users.find((u) => u.role === 'owner');
    if (!owner) {
      owner = DEFAULT_OWNER;
      this.data.users.push(owner);
      this.save();
    }
    return owner;
  }

  public updateUser(userId: string, updates: Partial<UserProfile>): UserProfile {
    const idx = this.data.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
      return this.data.users[idx];
    }
    throw new Error('User not found');
  }

  // Memories
  public getMemories(userId: string): Memory[] {
    return this.data.memories.filter((m) => m.userId === userId);
  }

  public addMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Memory {
    const newMem: Memory = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.memories.unshift(newMem);
    this.save();
    return newMem;
  }

  public updateMemory(id: string, userId: string, updates: Partial<Memory>): Memory | null {
    const idx = this.data.memories.findIndex((m) => m.id === id && m.userId === userId);
    if (idx !== -1) {
      this.data.memories[idx] = {
        ...this.data.memories[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
      return this.data.memories[idx];
    }
    return null;
  }

  public deleteMemory(id: string, userId: string): boolean {
    const initialLen = this.data.memories.length;
    this.data.memories = this.data.memories.filter((m) => !(m.id === id && m.userId === userId));
    const deleted = this.data.memories.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // People (Watu Wangu wa Karibu)
  public getPeople(userId: string): Person[] {
    return this.data.people.filter((p) => p.userId === userId);
  }

  public addPerson(person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>): Person {
    const newPerson: Person = {
      ...person,
      id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.people.unshift(newPerson);
    this.save();
    return newPerson;
  }

  public updatePerson(id: string, userId: string, updates: Partial<Person>): Person | null {
    const idx = this.data.people.findIndex((p) => p.id === id && p.userId === userId);
    if (idx !== -1) {
      this.data.people[idx] = {
        ...this.data.people[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
      return this.data.people[idx];
    }
    return null;
  }

  public deletePerson(id: string, userId: string): boolean {
    const initialLen = this.data.people.length;
    this.data.people = this.data.people.filter((p) => !(p.id === id && p.userId === userId));
    const deleted = this.data.people.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // Conversations
  public getConversations(userId: string): Conversation[] {
    return this.data.conversations.filter((c) => c.userId === userId);
  }

  public getConversation(id: string, userId: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === id && c.userId === userId);
  }

  public saveConversation(conversation: Conversation): Conversation {
    const idx = this.data.conversations.findIndex((c) => c.id === conversation.id);
    if (idx !== -1) {
      this.data.conversations[idx] = { ...conversation, updatedAt: new Date().toISOString() };
    } else {
      this.data.conversations.unshift({
        ...conversation,
        createdAt: conversation.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.save();
    return conversation;
  }

  public deleteConversation(id: string, userId: string): boolean {
    const initialLen = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => !(c.id === id && c.userId === userId));
    const deleted = this.data.conversations.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // Files
  public getFiles(userId: string): GeneratedFileSummary[] {
    return this.data.files.filter((f) => f.id);
  }

  public addFile(file: GeneratedFileSummary): GeneratedFileSummary {
    this.data.files.unshift(file);
    this.save();
    return file;
  }

  public deleteFile(id: string, userId: string): boolean {
    const file = this.data.files.find((f) => f.id === id);
    if (file) {
      // Remove disk file if exists
      const diskPath = path.join(FILES_DIR, `${file.id}_${file.filename}`);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (e) {
          console.error('Failed to unlink file', e);
        }
      }
      this.data.files = this.data.files.filter((f) => f.id !== id);
      this.save();
      return true;
    }
    return false;
  }

  // Auto Reply Settings
  public getAutoReplySettings(userId: string): AutoReplySettings {
    if (!this.data.autoReplySettings[userId]) {
      this.data.autoReplySettings[userId] = { ...DEFAULT_AUTO_REPLY_SETTINGS, userId };
      this.save();
    }
    return this.data.autoReplySettings[userId];
  }

  public updateAutoReplySettings(userId: string, updates: Partial<AutoReplySettings>): AutoReplySettings {
    const current = this.getAutoReplySettings(userId);
    this.data.autoReplySettings[userId] = { ...current, ...updates };
    this.save();
    return this.data.autoReplySettings[userId];
  }

  // Auto Reply Logs
  public getAutoReplyLogs(userId: string): AutoReplyLog[] {
    return this.data.autoReplyLogs.filter((l) => l.userId === userId);
  }

  public addAutoReplyLog(log: Omit<AutoReplyLog, 'id' | 'timestamp'>): AutoReplyLog {
    const newLog: AutoReplyLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.autoReplyLogs.unshift(newLog);
    this.save();
    return newLog;
  }

  public clearAutoReplyLogs(userId: string): boolean {
    this.data.autoReplyLogs = this.data.autoReplyLogs.filter((l) => l.userId !== userId);
    this.save();
    return true;
  }

  public resetSystem(): DatabaseSchema {
    this.data = {
      users: [{ ...DEFAULT_OWNER }],
      memories: [...SEED_MEMORIES],
      people: [...SEED_PEOPLE],
      conversations: [],
      files: [],
      autoReplySettings: {
        user_max_owner: { ...DEFAULT_AUTO_REPLY_SETTINGS },
      },
      autoReplyLogs: [
        {
          id: 'log_seed_1',
          userId: 'user_max_owner',
          channel: 'sms',
          sender: '+255 754 889 001',
          senderName: 'Mary (Mke wangu)',
          recipient: '+255 700 123 456',
          incomingMessage: 'Mume wangu, umekumbuka kuagiza vifaa vya nyumbani?',
          generatedReply: 'Habari mke wangu Mary, Max yuko kwenye kikao lakini ameniagiza nikujulishe kwamba ataagiza mara moja akimaliza.',
          status: 'sent',
          timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
          matchedPersonId: 'person_1',
          matchedRelationship: 'Mke wangu',
          confidence: 0.98,
        }
      ],
    };
    this.saveData(this.data);
    return this.data;
  }
}

export const db = new Database();
export { FILES_DIR };
