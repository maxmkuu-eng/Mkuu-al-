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

export interface AttachmentItem {
  id?: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md' | 'png' | 'jpg' | 'jpeg' | 'webp' | string;
  mimeType: string;
  size: number;
  base64Data?: string;
  previewUrl?: string;
  downloadUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isVoice?: boolean;
  attachments?: AttachmentItem[];
  generatedFiles?: GeneratedFileSummary[];
  memoryExtracted?: string[];
  personRecognized?: string[];
  savedOffline?: boolean;
  status?: 'sent' | 'pending' | 'failed_offline';
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned?: boolean;
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

export type ActiveTab = 'chat' | 'history' | 'memory' | 'people' | 'autoreply' | 'files' | 'security';

export type VoiceState = 'ready' | 'listening' | 'thinking' | 'speaking' | 'error';
