export type WorkspaceTab =
  | 'chats'
  | 'status'
  | 'calls'
  | 'starred'
  | 'archived'
  | 'companion_qr'
  | 'scheduler'
  | 'autorules'
  | 'templates'
  | 'settings';

export interface WaCompanionSessionState {
  accountId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected';
  qrDataUrl?: string;
  rawQrString?: string;
  pairingCode?: string;
  connectedJid?: string;
  pushName?: string;
  lastError?: string;
  updatedAt: string;
}

export interface AccountProfile {
  id: string;
  name: string;
  phone: string;
  waJid: string;
  avatarColor: string;
  stealthReadReceipts: boolean;
  stealthPresence: boolean;
  blurPreviews: boolean;
  hasLockPin: boolean;
  createdAt: string;
}

export interface CustomFolder {
  id: string;
  account_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
  votedByMe: boolean;
}

export interface ChatThread {
  id: string;
  accountId: string;
  waJid: string;
  type: 'direct' | 'group';
  name: string;
  recipientPhone: string;
  about: string;
  avatarColor: string;
  folderId: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  unreadCount: number;
  disappearingTimer: 'off' | '24h' | '7d' | '90d';
  safetyNumber: string;
  identityKeyHex: string;
  ratchetStep: number;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  chatId: string;
  accountId: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'code' | 'voice' | 'image' | 'file' | 'poll';
  content: string;
  mediaDataUrl?: string;
  fileName?: string;
  fileSize?: string;
  voiceDuration?: number;
  replyToId?: string;
  forwarded?: boolean;
  edited?: boolean;
  reactions: Record<string, string[]>;
  poll?: {
    question: string;
    options: PollOption[];
  };
  starred: boolean;
  status: 'sent' | 'delivered' | 'read';
  cipherHex: string;
  ratchetStep: number;
  externalWaId?: string;
  createdAt: string;
}

export interface StatusPostRecord {
  id: string;
  account_id: string;
  author_name: string;
  author_phone: string;
  content: string;
  bg_color: string;
  media_data_url?: string;
  views: number;
  created_at: string;
}

export interface CallLogRecord {
  id: string;
  account_id: string;
  chat_id: string;
  contact_name: string;
  call_type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  duration: string;
  safety_fingerprint: string;
  created_at: string;
}

export interface ScheduledMessageJob {
  id: string;
  account_id: string;
  chat_id: string;
  content: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
}

export interface AutoReplyRule {
  id: string;
  account_id: string;
  name: string;
  trigger_type: 'keyword' | 'contains' | 'regex' | 'all_incoming';
  trigger_value: string;
  reply_content: string;
  enabled: number | boolean;
  hit_count: number;
  created_at: string;
}

export interface QuickTemplate {
  id: string;
  account_id: string;
  shortcut: string;
  title: string;
  body: string;
  created_at: string;
}

export interface TauriSourceFile {
  path: string;
  content: string;
}

export interface ActiveRtcCall {
  chatId: string;
  contactName: string;
  recipientPhone: string;
  avatarColor: string;
  mode: 'voice' | 'video';
  startedAt: number;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  safetyFingerprint: string;
}
