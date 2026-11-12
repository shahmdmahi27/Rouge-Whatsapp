import {
  AccountProfile,
  WaCompanionSessionState,
  CustomFolder,
  ChatThread,
  MessageItem,
  StatusPostRecord,
  CallLogRecord,
  ScheduledMessageJob,
  AutoReplyRule,
  QuickTemplate,
  TauriSourceFile,
} from '../types/whatsapp';

export function isNativeTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface BootstrapPayload {
  accounts: AccountProfile[];
  activeAccountId: string;
  waSession: WaCompanionSessionState;
  folders: CustomFolder[];
  chats: ChatThread[];
  messages: MessageItem[];
  statusPosts: StatusPostRecord[];
  callLogs: CallLogRecord[];
  scheduled: ScheduledMessageJob[];
  autoRules: AutoReplyRule[];
  templates: QuickTemplate[];
}

export const apiTransport = {
  async getBootstrap(accountId?: string): Promise<BootstrapPayload> {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const res = await fetch(`/api/bootstrap${query}`);
    if (!res.ok) throw new Error('Failed to load workspace bootstrap');
    return res.json();
  },

  async startCompanionQrSession(accountId: string): Promise<WaCompanionSessionState> {
    const res = await fetch('/api/wa/connect-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    if (!res.ok) throw new Error('Failed to start WhatsApp QR session');
    return res.json();
  },

  async requestCompanionPairingCode(
    accountId: string,
    phoneNumber: string
  ): Promise<WaCompanionSessionState> {
    const res = await fetch('/api/wa/pair-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, phoneNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to request pairing code');
    return data;
  },

  async disconnectCompanionSession(accountId: string): Promise<WaCompanionSessionState> {
    const res = await fetch('/api/wa/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    return res.json();
  },

  async createAccount(data: {
    name: string;
    phone: string;
    avatarColor: string;
  }): Promise<AccountProfile> {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create account');
    return res.json();
  },

  async updateAccount(
    id: string,
    patch: Partial<{
      name: string;
      phone: string;
      stealthReadReceipts: boolean;
      stealthPresence: boolean;
      blurPreviews: boolean;
      newLockPin: string;
      clearLockPin: boolean;
    }>
  ): Promise<AccountProfile> {
    const res = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update account');
    return res.json();
  },

  async verifyPin(accountId: string, pin: string): Promise<{ valid: boolean }> {
    const res = await fetch(
      `/api/accounts/${encodeURIComponent(accountId)}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      }
    );
    return res.json();
  },

  async createFolder(data: {
    accountId: string;
    name: string;
    color: string;
  }): Promise<CustomFolder> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
  },

  async deleteFolder(id: string): Promise<void> {
    await fetch(`/api/folders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createChat(data: {
    accountId: string;
    type: 'direct' | 'group';
    name: string;
    recipientPhone: string;
    about: string;
    avatarColor: string;
    folderId?: string;
  }): Promise<ChatThread> {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create chat');
    return res.json();
  },

  async updateChat(
    id: string,
    patch: Partial<{
      pinned: boolean;
      archived: boolean;
      muted: boolean;
      folderId: string;
      disappearingTimer: string;
      clearUnread: boolean;
      about: string;
      name: string;
    }>
  ): Promise<ChatThread> {
    const res = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update chat');
    return res.json();
  },

  async deleteChat(id: string): Promise<void> {
    await fetch(`/api/chats/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async sendMessage(data: {
    accountId: string;
    chatId: string;
    senderId: string;
    senderName: string;
    type: string;
    content: string;
    mediaDataUrl?: string;
    fileName?: string;
    fileSize?: string;
    voiceDuration?: number;
    replyToId?: string;
    forwarded?: boolean;
    poll?: unknown;
  }): Promise<MessageItem> {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  async sendIncomingWebhookMessage(data: {
    accountId: string;
    chatId: string;
    senderName: string;
    content: string;
  }): Promise<MessageItem> {
    const res = await fetch('/api/webhook/incoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to dispatch incoming message');
    return res.json();
  },

  async updateMessage(
    id: string,
    patch: {
      emoji?: string;
      toggleStar?: boolean;
      voteOptionId?: string;
      editedContent?: string;
    }
  ): Promise<MessageItem> {
    const res = await fetch(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },

  async deleteMessage(id: string): Promise<void> {
    await fetch(`/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createStatusPost(data: {
    accountId: string;
    authorName: string;
    authorPhone: string;
    content: string;
    bgColor: string;
  }): Promise<StatusPostRecord> {
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteStatusPost(id: string): Promise<void> {
    await fetch(`/api/status/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createCallLog(data: {
    accountId: string;
    chatId: string;
    contactName: string;
    callType: 'voice' | 'video';
    direction: 'incoming' | 'outgoing' | 'missed';
    duration: string;
    safetyFingerprint: string;
  }): Promise<CallLogRecord> {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async searchMessagesFts(accountId: string, query: string): Promise<MessageItem[]> {
    const res = await fetch(
      `/api/search?accountId=${encodeURIComponent(accountId)}&q=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    return res.json();
  },

  async createSchedule(data: {
    accountId: string;
    chatId: string;
    content: string;
    scheduledFor: string;
  }): Promise<ScheduledMessageJob> {
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to schedule message');
    return res.json();
  },

  async cancelSchedule(id: string): Promise<ScheduledMessageJob> {
    const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async createAutoRule(data: {
    accountId: string;
    name: string;
    triggerType: string;
    triggerValue: string;
    replyContent: string;
  }): Promise<AutoReplyRule> {
    const res = await fetch('/api/autorules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create auto-reply rule');
    return res.json();
  },

  async toggleAutoRule(id: string): Promise<AutoReplyRule> {
    const res = await fetch(`/api/autorules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
    });
    return res.json();
  },

  async deleteAutoRule(id: string): Promise<void> {
    await fetch(`/api/autorules/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createTemplate(data: {
    accountId: string;
    shortcut: string;
    title: string;
    body: string;
  }): Promise<QuickTemplate> {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create template');
    return res.json();
  },

  async deleteTemplate(id: string): Promise<void> {
    await fetch(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async runSqlQuery(sql: string): Promise<{
    rows: Record<string, unknown>[];
    durationMs: number;
    rowCount: number;
    error?: string;
  }> {
    const res = await fetch('/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'SQL query failed');
    }
    return data;
  },

  async getTauriSourceFiles(): Promise<TauriSourceFile[]> {
    const res = await fetch('/api/tauri-files');
    if (!res.ok) return [];
    return res.json();
  },
};
