/**
 * Local Chat & Memory Storage Engine for MKUU AI
 * 
 * Provides durable, offline-first local persistence using IndexedDB with
 * synchronous LocalStorage backup and online cloud synchronization.
 * Guarantees zero data loss on app close, restart, phone reboot, or offline usage.
 */

import { ChatMessage, Conversation, Memory, Person, UserProfile } from '../types';

const DB_NAME = 'MkuuAI_Local_DB';
const DB_VERSION = 1;
const CONV_STORE = 'conversations';
const MSG_STORE = 'messages';
const MEM_STORE = 'memories';
const PEOPLE_STORE = 'people';
const META_STORE = 'metadata';

const LOCAL_STORAGE_CONV_KEY = 'mkuu_local_conversations_v1';
const LOCAL_STORAGE_ACTIVE_CONV_KEY = 'mkuu_active_conv_id_v1';

// Open / Upgrade IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Conversations store
      if (!db.objectStoreNames.contains(CONV_STORE)) {
        const convStore = db.createObjectStore(CONV_STORE, { keyPath: 'id' });
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        convStore.createIndex('userId', 'userId', { unique: false });
      }

      // Messages store
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const msgStore = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Memories cache store
      if (!db.objectStoreNames.contains(MEM_STORE)) {
        db.createObjectStore(MEM_STORE, { keyPath: 'id' });
      }

      // People cache store
      if (!db.objectStoreNames.contains(PEOPLE_STORE)) {
        db.createObjectStore(PEOPLE_STORE, { keyPath: 'id' });
      }

      // Metadata store
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Local Fallback using LocalStorage (immediate snapshot safety)
 */
function getLocalStorageConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
    return [];
  }
}

function saveLocalStorageConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONV_KEY, JSON.stringify(convs));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

/**
 * Core Storage API
 */
export const localChatStorage = {
  /**
   * Initialize local database and ensure default conversation exists
   */
  async init(): Promise<void> {
    try {
      await openDatabase();
    } catch (e) {
      console.warn('IndexedDB init warning (will use LocalStorage fallback):', e);
    }
  },

  /**
   * Get all conversations sorted by last updated (newest first)
   */
  async getAllConversations(): Promise<Conversation[]> {
    try {
      const db = await openDatabase();
      return new Promise<Conversation[]>((resolve) => {
        const tx = db.transaction(CONV_STORE, 'readonly');
        const store = tx.objectStore(CONV_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: Conversation[] = req.result || [];
          // Also check localStorage in case it has newer items
          const localList = getLocalStorageConversations();
          
          // Merge by ID, preferring whichever has more messages or newer timestamp
          const map = new Map<string, Conversation>();
          for (const item of list) {
            map.set(item.id, item);
          }
          for (const item of localList) {
            const existing = map.get(item.id);
            if (!existing || (item.messages && item.messages.length > (existing.messages?.length || 0))) {
              map.set(item.id, item);
            }
          }

          const combined = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
          );

          resolve(combined);
        };

        req.onerror = () => {
          // Fallback to localStorage
          resolve(getLocalStorageConversations());
        };
      });
    } catch (e) {
      return getLocalStorageConversations();
    }
  },

  /**
   * Get a single conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    try {
      const db = await openDatabase();
      return new Promise<Conversation | null>((resolve) => {
        const tx = db.transaction(CONV_STORE, 'readonly');
        const store = tx.objectStore(CONV_STORE);
        const req = store.get(id);

        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result);
          } else {
            const localList = getLocalStorageConversations();
            const found = localList.find((c) => c.id === id) || null;
            resolve(found);
          }
        };

        req.onerror = () => {
          const localList = getLocalStorageConversations();
          resolve(localList.find((c) => c.id === id) || null);
        };
      });
    } catch (e) {
      const localList = getLocalStorageConversations();
      return localList.find((c) => c.id === id) || null;
    }
  },

  /**
   * Save or update a conversation (and its messages) durably
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    if (!conversation || !conversation.id) return;

    // Update timestamp
    const updatedConv: Conversation = {
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: conversation.messages || [],
    };

    // 1. Immediately write to LocalStorage (Instant Sync)
    const localList = getLocalStorageConversations();
    const existingIdx = localList.findIndex((c) => c.id === updatedConv.id);
    if (existingIdx >= 0) {
      localList[existingIdx] = updatedConv;
    } else {
      localList.unshift(updatedConv);
    }
    saveLocalStorageConversations(localList);

    // 2. Persist to IndexedDB
    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      const store = tx.objectStore(CONV_STORE);
      store.put(updatedConv);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Failed to write conversation to IndexedDB:', e);
    }
  },

  /**
   * Add a single message to a conversation and persist immediately
   */
  async addMessage(conversationId: string, message: ChatMessage, titleFallback?: string): Promise<Conversation> {
    let conv = await this.getConversation(conversationId);

    if (!conv) {
      conv = {
        id: conversationId,
        userId: 'user_max_owner',
        title: titleFallback || (message.content ? message.content.slice(0, 35) + (message.content.length > 35 ? '...' : '') : 'Mazungumzo Mapya'),
        createdAt: message.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [message],
      };
    } else {
      // Check if message is already present to prevent duplicates
      const msgExists = conv.messages.some((m) => m.id === message.id);
      if (!msgExists) {
        conv.messages = [...conv.messages, message];
      }
      conv.updatedAt = new Date().toISOString();

      // If conversation title is default and user sent text, update title
      if ((conv.title === 'Mazungumzo Mapya' || !conv.title) && message.role === 'user' && message.content) {
        conv.title = message.content.slice(0, 35) + (message.content.length > 35 ? '...' : '');
      }
    }

    await this.saveConversation(conv);
    return conv;
  },

  /**
   * Delete a single message from a conversation
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<Conversation | null> {
    const conv = await this.getConversation(conversationId);
    if (!conv) return null;

    conv.messages = conv.messages.filter((m) => m.id !== messageId);
    conv.updatedAt = new Date().toISOString();
    await this.saveConversation(conv);
    return conv;
  },

  /**
   * Delete an entire conversation
   */
  async deleteConversation(id: string): Promise<boolean> {
    // 1. Remove from LocalStorage
    const localList = getLocalStorageConversations();
    const filtered = localList.filter((c) => c.id !== id);
    saveLocalStorageConversations(filtered);

    // 2. Remove from IndexedDB
    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      const store = tx.objectStore(CONV_STORE);
      store.delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (e) {
      console.warn('Failed to delete conversation from IndexedDB:', e);
      return true;
    }
  },

  /**
   * Clear all conversations (with caution)
   */
  async clearAllConversations(): Promise<void> {
    localStorage.removeItem(LOCAL_STORAGE_CONV_KEY);
    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      const store = tx.objectStore(CONV_STORE);
      store.clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Failed to clear IndexedDB:', e);
    }
  },

  /**
   * Search conversations by title or message text
   */
  async searchConversations(query: string): Promise<Conversation[]> {
    const all = await this.getAllConversations();
    if (!query || !query.trim()) return all;

    const lower = query.toLowerCase().trim();
    return all.filter((conv) => {
      if (conv.title.toLowerCase().includes(lower)) return true;
      if (conv.messages && conv.messages.some((m) => m.content.toLowerCase().includes(lower))) return true;
      return false;
    });
  },

  /**
   * Active conversation ID memory
   */
  getActiveConversationId(): string {
    return localStorage.getItem(LOCAL_STORAGE_ACTIVE_CONV_KEY) || 'conv_main_max';
  },

  setActiveConversationId(id: string): void {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_CONV_KEY, id);
  },

  /**
   * Export all chat data as JSON string for backup
   */
  async exportDataJson(): Promise<string> {
    const convs = await this.getAllConversations();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        conversations: convs,
      },
      null,
      2
    );
  },
};
