import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  CircleDot,
  Phone,
  Star,
  Archive,
  QrCode,
  Clock,
  Bot,
  Zap,
  Settings,
  Plus,
  Search,
  Video,
  Info,
  Paperclip,
  Mic,
  Send,
  Smile,
  CheckCheck,
  Pin,
  Lock,
  Reply,
  Trash2,
  FileText,
  BarChart2,
  X,
  ShieldCheck,
  Square,
  FolderPlus,
  Download,
  Shield,
  UserPlus,
  Edit3,
  Forward,
  Command,
} from 'lucide-react';
import {
  WorkspaceTab,
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
  ActiveRtcCall,
} from './types/whatsapp';
import { apiTransport } from './services/tauriTransport';
import { AvatarView } from './components/AvatarView';
import { CallStudioModal } from './components/CallStudioModal';
import {
  CompanionQrPairingStageView,
  StatusStoriesStageView,
  CallLogsStageView,
  SchedulerStageView,
  AutoRulesStageView,
  TemplatesStageView,
  AccountSettingsStageView,
} from './components/PowerUserHubViews';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function App() {
  // Primary Navigation & Active Account State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chats');
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('acc_primary');
  const [waSession, setWaSession] = useState<WaCompanionSessionState>({
    accountId: 'acc_primary',
    status: 'disconnected',
    updatedAt: '',
  });
  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  // Entities for Active Account
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [statusPosts, setStatusPosts] = useState<StatusPostRecord[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogRecord[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledMessageJob[]>([]);
  const [autoRules, setAutoRules] = useState<AutoReplyRule[]>([]);
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);

  // Active Selection & Search
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<MessageItem[]>([]);

  // Composer & Message Actions
  const [composerText, setComposerText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MessageItem | null>(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Quick Switcher (Ctrl+K / Cmd+K)
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Microphone Voice Note Recording (MediaRecorder)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Modals (New Contact/Group, New Account, New Folder, Poll, App Lock)
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [newChatName, setNewChatName] = useState('');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatAbout, setNewChatAbout] = useState('');
  const [newChatFolderId, setNewChatFolderId] = useState('');

  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPhone, setNewAccountPhone] = useState('');

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  // Lock Screen State
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  // Active Call Studio
  const [activeCall, setActiveCall] = useState<ActiveRtcCall | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadWorkspaceBootstrap = async (targetAccountId?: string) => {
    try {
      const data = await apiTransport.getBootstrap(targetAccountId);
      setAccounts(data.accounts);
      setActiveAccountId(data.activeAccountId);
      setWaSession(data.waSession);
      setFolders(data.folders);
      setChats(data.chats);
      setMessages(data.messages);
      setStatusPosts(data.statusPosts || []);
      setCallLogs(data.callLogs || []);
      setScheduled(data.scheduled);
      setAutoRules(data.autoRules);
      setTemplates(data.templates);

      if (data.chats.length > 0 && !data.chats.some((c) => c.id === selectedChatId)) {
        setSelectedChatId(data.chats[0].id);
      } else if (data.chats.length === 0) {
        setSelectedChatId('');
      }
    } catch (err) {
      console.error('Bootstrap error:', err);
    }
  };

  useEffect(() => {
    loadWorkspaceBootstrap();
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K Quick Switcher, Ctrl+L Lock, Alt+1..9 Switch Account)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLocked(true);
      } else if (e.altKey && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (accounts[idx]) {
          e.preventDefault();
          loadWorkspaceBootstrap(accounts[idx].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [accounts]);

  // Real-Time WebSocket Sync
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000);
      };
      socket.onmessage = (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);
          if (event === 'wa:session') {
            const st = payload as WaCompanionSessionState;
            setWaSession((prev) =>
              st.accountId === prev.accountId ? st : prev
            );
          } else if (event === 'message:created') {
            const { message, chat } = payload as {
              message: MessageItem;
              chat: ChatThread;
            };
            setMessages((prev) =>
              prev.some((m) => m.id === message.id) ? prev : [...prev, message]
            );
            setChats((prev) => {
              const exists = prev.some((c) => c.id === chat.id);
              return exists
                ? prev.map((c) => (c.id === chat.id ? chat : c))
                : [chat, ...prev];
            });
          } else if (event === 'message:updated') {
            const updated = payload as MessageItem;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          } else if (event === 'message:deleted') {
            const { id } = payload as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== id));
          } else if (event === 'chat:created') {
            const created = payload as ChatThread;
            setChats((prev) =>
              prev.some((c) => c.id === created.id) ? prev : [created, ...prev]
            );
          } else if (event === 'chat:updated') {
            const updated = payload as ChatThread;
            setChats((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          } else if (event === 'chat:deleted') {
            const { id } = payload as { id: string };
            setChats((prev) => prev.filter((c) => c.id !== id));
          } else if (event === 'status:created') {
            const st = payload as StatusPostRecord;
            setStatusPosts((prev) =>
              prev.some((s) => s.id === st.id) ? prev : [st, ...prev]
            );
          } else if (event === 'call:created') {
            const cl = payload as CallLogRecord;
            setCallLogs((prev) =>
              prev.some((c) => c.id === cl.id) ? prev : [cl, ...prev]
            );
          } else if (event === 'schedule:updated') {
            const job = payload as ScheduledMessageJob;
            setScheduled((prev) => {
              const exists = prev.some((j) => rMatch(j.id, job.id));
              return exists
                ? prev.map((j) => (j.id === job.id ? job : j))
                : [job, ...prev];
            });
          } else if (event === 'autorule:updated') {
            const rule = payload as AutoReplyRule;
            setAutoRules((prev) => {
              const exists = prev.some((r) => r.id === rule.id);
              return exists
                ? prev.map((r) => (r.id === rule.id ? rule : r))
                : [rule, ...prev];
            });
          } else if (event === 'account:updated') {
            const acc = payload as AccountProfile;
            setAccounts((prev) =>
              prev.map((a) => (a.id === acc.id ? acc : a))
            );
          }
        } catch {}
      };
    };

    const rMatch = (a: string, b: string) => a === b;
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  // Message Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits([]);
      return;
    }
    const timer = setTimeout(() => {
      apiTransport.searchMessagesFts(activeAccountId, q).then(setSearchHits);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, activeAccountId]);

  // Recording Timer
  useEffect(() => {
    if (!isRecordingAudio) {
      setRecordingSec(0);
      return;
    }
    const t = setInterval(() => setRecordingSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecordingAudio]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || accounts[0],
    [accounts, activeAccountId]
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || chats[0] || null,
    [chats, selectedChatId]
  );

  const activeChatMessages = useMemo(
    () => (activeChat ? messages.filter((m) => m.chatId === activeChat.id) : []),
    [messages, activeChat]
  );

  const starredMessages = useMemo(
    () => messages.filter((m) => m.starred),
    [messages]
  );

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chats
      .filter((c) => {
        if (activeTab === 'archived') {
          return c.archived;
        }
        if (c.archived) return false;
        if (selectedFolderFilter === 'unread' && c.unreadCount === 0) return false;
        if (selectedFolderFilter === 'groups' && c.type !== 'group') return false;
        if (
          selectedFolderFilter !== 'all' &&
          selectedFolderFilter !== 'unread' &&
          selectedFolderFilter !== 'groups' &&
          c.folderId !== selectedFolderFilter
        ) {
          return false;
        }
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.recipientPhone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [chats, activeTab, selectedFolderFilter, searchQuery]);

  // Quick Reply (/) Matches
  const matchingTemplates = useMemo(() => {
    if (!composerText.startsWith('/')) return [];
    const q = composerText.toLowerCase();
    return templates.filter((t) => t.shortcut.toLowerCase().startsWith(q));
  }, [composerText, templates]);

  const handleApplySlashTemplate = (tpl: QuickTemplate) => {
    const contactName = activeChat?.name || 'there';
    const expanded = tpl.body
      .replace(/\{\{name\}\}/g, contactName)
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      .replace(
        /\{\{time\}\}/g,
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    setComposerText(expanded);
  };

  const handleSelectChat = async (chatId: string) => {
    setSelectedChatId(chatId);
    if (activeTab !== 'chats' && activeTab !== 'archived') {
      setActiveTab('chats');
    }
    const target = chats.find((c) => c.id === chatId);
    if (target && target.unreadCount > 0 && !activeAccount?.stealthReadReceipts) {
      await apiTransport.updateChat(chatId, { clearUnread: true });
    }
  };

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !composerText.trim()) return;
    const text = composerText.trim();
    setComposerText('');

    if (editingMessage) {
      const targetId = editingMessage.id;
      setEditingMessage(null);
      await apiTransport.updateMessage(targetId, { editedContent: text });
      return;
    }

    const replyId = replyingTo?.id;
    setReplyingTo(null);

    await apiTransport.sendMessage({
      accountId: activeAccountId,
      chatId: activeChat.id,
      senderId: 'me',
      senderName: activeAccount?.name || 'You',
      type: 'text',
      content: text,
      replyToId: replyId,
    });
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleForwardMessageToChat = async (targetChatId: string) => {
    if (!forwardingMessage) return;
    const msg = forwardingMessage;
    setForwardingMessage(null);
    await apiTransport.sendMessage({
      accountId: activeAccountId,
      chatId: targetChatId,
      senderId: 'me',
      senderName: activeAccount?.name || 'You',
      type: msg.type,
      content: msg.content,
      mediaDataUrl: msg.mediaDataUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      forwarded: true,
    });
    setSelectedChatId(targetChatId);
    setActiveTab('chats');
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const isImage = file.type.startsWith('image/');
      const sizeKb = `${Math.max(1, Math.round(file.size / 1024))} KB`;

      await apiTransport.sendMessage({
        accountId: activeAccountId,
        chatId: activeChat.id,
        senderId: 'me',
        senderName: activeAccount?.name || 'You',
        type: isImage ? 'image' : 'file',
        content: isImage ? `Photo: ${file.name}` : `Document: ${file.name}`,
        mediaDataUrl: dataUrl,
        fileName: file.name,
        fileSize: sizeKb,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleStartAudioRecording = async () => {
    if (!activeChat) return;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (evt) => {
          if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio =
              typeof reader.result === 'string' ? reader.result : '';
            await apiTransport.sendMessage({
              accountId: activeAccountId,
              chatId: activeChat.id,
              senderId: 'me',
              senderName: activeAccount?.name || 'You',
              type: 'voice',
              content: `Voice message (${recordingSec || 2}s)`,
              mediaDataUrl: base64Audio,
              voiceDuration: Math.max(1, recordingSec),
            });
          };
          reader.readAsDataURL(blob);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecordingAudio(true);
        return;
      } catch {}
    }
    setIsRecordingAudio(true);
  };

  const handleStopAndSendAudioRecording = async () => {
    if (!activeChat) return;
    const dur = Math.max(1, recordingSec);
    setIsRecordingAudio(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else {
      await apiTransport.sendMessage({
        accountId: activeAccountId,
        chatId: activeChat.id,
        senderId: 'me',
        senderName: activeAccount?.name || 'You',
        type: 'voice',
        content: `Voice message (${dur}s)`,
        voiceDuration: dur,
      });
    }
  };

  const handleCreateChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim()) return;
    const created = await apiTransport.createChat({
      accountId: activeAccountId,
      type: newChatType,
      name: newChatName.trim(),
      recipientPhone: newChatPhone.trim(),
      about: newChatAbout.trim() || 'Hey there! I am using WhatsApp.',
      avatarColor: newChatType === 'group' ? '#0284C7' : '#00A884',
      folderId: newChatFolderId,
    });
    setNewChatName('');
    setNewChatPhone('');
    setNewChatAbout('');
    setShowNewChatModal(false);
    setSelectedChatId(created.id);
    setActiveTab('chats');
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    const created = await apiTransport.createAccount({
      name: newAccountName.trim(),
      phone: newAccountPhone.trim() || 'Click QR to link phone',
      avatarColor: '#0284C7',
    });
    setNewAccountName('');
    setNewAccountPhone('');
    setShowNewAccountModal(false);
    await loadWorkspaceBootstrap(created.id);
    setActiveTab('companion_qr');
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder = await apiTransport.createFolder({
      accountId: activeAccountId,
      name: newFolderName.trim(),
      color: '#00A884',
    });
    setFolders((prev) => [...prev, folder]);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim())
      return;
    await apiTransport.sendMessage({
      accountId: activeAccountId,
      chatId: activeChat.id,
      senderId: 'me',
      senderName: activeAccount?.name || 'You',
      type: 'poll',
      content: pollQuestion.trim(),
      poll: {
        question: pollQuestion.trim(),
        options: [
          { id: 'opt_1', label: pollOpt1.trim(), votes: 1, votedByMe: true },
          { id: 'opt_2', label: pollOpt2.trim(), votes: 0, votedByMe: false },
        ],
      },
    });
    setPollQuestion('');
    setPollOpt1('');
    setPollOpt2('');
    setShowPollModal(false);
  };

  const handleExportThreadHistory = () => {
    if (!activeChat) return;
    const content =
      `WhatsApp Chat with ${activeChat.name} (${activeChat.recipientPhone || activeChat.type})\n\n` +
      activeChatMessages
        .map(
          (m) =>
            `[${new Date(m.createdAt).toLocaleString()}] ${m.senderName}: ${m.content}`
        )
        .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WhatsApp Chat - ${activeChat.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUnlockVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const res = await apiTransport.verifyPin(activeAccount.id, unlockPinInput);
    if (res.valid) {
      setIsLocked(false);
      setUnlockPinInput('');
      setUnlockError(false);
    } else {
      setUnlockError(true);
    }
  };

  if (isLocked) {
    return (
      <div className="h-screen w-screen bg-[#0B141A] flex items-center justify-center p-6 select-none">
        <form
          onSubmit={handleUnlockVerify}
          className="w-full max-w-sm rounded-2xl bg-[#202C33] border border-[#2A3942] p-8 text-center space-y-5 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#00A884]/20 text-[#00A884] flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-[#E9EDEF]">
              WhatsApp Locked
            </h1>
            <p className="text-xs text-[#8696A0] mt-1">
              Enter your passcode for {activeAccount?.name}
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={unlockPinInput}
            onChange={(e) => setUnlockPinInput(e.target.value)}
            placeholder="Enter PIN..."
            className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-4 py-3 text-center text-base text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
          />
          {unlockError && (
            <p className="text-xs text-[#EF4444]">Incorrect PIN. Please try again.</p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B141A] text-[#E9EDEF] select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUploadChange}
        className="hidden"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN 1: Multi-Account Switcher & Primary Navigation Rail (64px) */}
        <aside className="w-16 bg-[#202C33] border-r border-[#2A3942] flex flex-col items-center justify-between py-3 shrink-0 z-20 overflow-y-auto">
          {/* Top: Multi-Account Switcher (Alt+1..9) */}
          <div className="flex flex-col items-center gap-2 border-b border-[#2A3942] pb-3 w-full">
            {accounts.map((acc, idx) => {
              const initials = acc.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const isCurrent = acc.id === activeAccountId;
              return (
                <button
                  key={acc.id}
                  onClick={() => loadWorkspaceBootstrap(acc.id)}
                  title={`${acc.name} (Alt+${idx + 1})`}
                  className={`relative rounded-full transition-transform ${
                    isCurrent
                      ? 'ring-2 ring-[#00A884] ring-offset-2 ring-offset-[#202C33] scale-105'
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  <AvatarView
                    alt={acc.name}
                    fallback={initials || 'WA'}
                    color={acc.avatarColor}
                    size="sm"
                    online={isCurrent && waSession.status === 'connected'}
                  />
                </button>
              );
            })}
            <button
              onClick={() => setShowNewAccountModal(true)}
              title="Add Another WhatsApp Account"
              className="w-8 h-8 rounded-full bg-[#111B21] hover:bg-[#2A3942] text-[#8696A0] hover:text-[#00A884] border border-[#2A3942] flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Middle: Main Navigation Tabs */}
          <div className="flex flex-col items-center gap-1.5 my-auto py-2">
            {/* Link Phone (QR / Phone Code) */}
            <button
              onClick={() => setActiveTab('companion_qr')}
              title="Link a Device (Scan QR Code or Phone Number)"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'companion_qr'
                  ? 'bg-[#00A884] text-[#111B21]'
                  : waSession.status === 'connected'
                  ? 'text-[#00A884] hover:bg-[#2A3942]/50'
                  : 'bg-[#111B21] text-[#00A884] border border-[#00A884]/40 hover:bg-[#2A3942]'
              }`}
            >
              <QrCode className="w-5 h-5" />
            </button>

            {/* Chats */}
            <button
              onClick={() => setActiveTab('chats')}
              title="Chats"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'chats'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Status Updates */}
            <button
              onClick={() => setActiveTab('status')}
              title="Status Updates"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'status'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <CircleDot className="w-5 h-5" />
            </button>

            {/* Calls */}
            <button
              onClick={() => setActiveTab('calls')}
              title="Calls"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'calls'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Phone className="w-5 h-5" />
            </button>

            {/* Starred Messages */}
            <button
              onClick={() => setActiveTab('starred')}
              title="Starred Messages"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'starred'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Star className="w-5 h-5" />
            </button>

            {/* Archived Chats */}
            <button
              onClick={() => setActiveTab('archived')}
              title="Archived Chats"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'archived'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Archive className="w-5 h-5" />
            </button>

            <div className="w-6 h-[1px] bg-[#2A3942] my-1" />

            {/* Scheduled Messages */}
            <button
              onClick={() => setActiveTab('scheduler')}
              title="Scheduled Messages"
              className={`relative p-2.5 rounded-xl transition-colors ${
                activeTab === 'scheduler'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Clock className="w-5 h-5" />
              {scheduled.filter((s) => s.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#F59E0B] text-[#111B21] text-[10px] font-bold flex items-center justify-center">
                  {scheduled.filter((s) => s.status === 'pending').length}
                </span>
              )}
            </button>

            {/* Auto-Reply */}
            <button
              onClick={() => setActiveTab('autorules')}
              title="Auto-Reply & Away Messages"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'autorules'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Bot className="w-5 h-5" />
            </button>

            {/* Quick Replies */}
            <button
              onClick={() => setActiveTab('templates')}
              title="Quick Replies (/)"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'templates'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom: Quick Switcher & Settings */}
          <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-[#2A3942] w-full">
            <button
              onClick={() => setShowCommandPalette(true)}
              title="Quick Search & Jump (Ctrl+K)"
              className="p-2 rounded-xl text-[#AEBAC1] hover:text-[#00A884] hover:bg-[#2A3942]/50"
            >
              <Command className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              title="Privacy & Settings"
              className={`p-2.5 rounded-xl transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#2A3942] text-[#00A884]'
                  : 'text-[#AEBAC1] hover:bg-[#2A3942]/50 hover:text-[#E9EDEF]'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* COLUMN 2: Chat List Pane (Chats, Archived, or Starred) */}
        {(activeTab === 'chats' ||
          activeTab === 'archived' ||
          activeTab === 'starred') && (
          <section className="w-[355px] bg-[#111B21] border-r border-[#222E35] flex flex-col shrink-0 overflow-hidden">
            {/* Account Header */}
            <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base font-display font-bold text-[#E9EDEF] truncate">
                  {activeTab === 'archived'
                    ? 'Archived'
                    : activeTab === 'starred'
                    ? 'Starred Messages'
                    : activeAccount?.name || 'Chats'}
                </h1>
                <p className="text-[11px] text-[#8696A0] truncate">
                  {waSession.status === 'connected'
                    ? `Connected · ${waSession.connectedJid?.split('@')[0] || 'WhatsApp'}`
                    : 'Not linked · Click QR to link phone'}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {waSession.status !== 'connected' && (
                  <button
                    onClick={() => setActiveTab('companion_qr')}
                    title="Scan QR Code to Link Phone"
                    className="px-2.5 py-1.5 rounded-lg bg-[#202C33] hover:bg-[#2A3942] text-[#00A884] text-[11px] font-semibold border border-[#00A884]/40 flex items-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Link Phone</span>
                  </button>
                )}
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  title="New Chat Folder"
                  className="p-2 rounded-lg text-[#AEBAC1] hover:text-[#E9EDEF] hover:bg-[#202C33]"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  title="New Chat"
                  className="p-2 rounded-lg bg-[#00A884] hover:bg-[#029072] text-[#111B21]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-3 pb-2.5">
              <div className="flex items-center bg-[#202C33] rounded-lg px-3 py-1.5 border border-transparent focus-within:border-[#00A884]/60">
                <Search className="w-4 h-4 text-[#8696A0] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat (Ctrl+K)"
                  className="w-full bg-transparent text-xs text-[#E9EDEF] placeholder:text-[#8696A0] pl-2.5 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-[#8696A0] hover:text-[#E9EDEF]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Custom Chat Folders Filter Bar */}
            {activeTab === 'chats' && (
              <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'groups', label: 'Groups' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedFolderFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedFolderFilter === tab.id
                        ? 'bg-[#00A884]/20 text-[#00A884] font-semibold'
                        : 'bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                {folders.map((fld) => (
                  <div
                    key={fld.id}
                    className="inline-flex items-center rounded-lg bg-[#202C33] shrink-0"
                  >
                    <button
                      onClick={() => setSelectedFolderFilter(fld.id)}
                      className={`px-2.5 py-1 rounded-l-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        selectedFolderFilter === fld.id
                          ? 'bg-[#00A884]/20 text-[#00A884] font-semibold'
                          : 'text-[#8696A0] hover:text-[#E9EDEF]'
                      }`}
                    >
                      {fld.name}
                    </button>
                    <button
                      onClick={async () => {
                        await apiTransport.deleteFolder(fld.id);
                        setFolders((prev) => prev.filter((f) => f.id !== fld.id));
                        if (selectedFolderFilter === fld.id) {
                          setSelectedFolderFilter('all');
                        }
                      }}
                      title="Delete folder"
                      className="px-1.5 py-1 text-[#8696A0] hover:text-[#EF4444] text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Chat or Starred List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#222E35]/60">
              {activeTab === 'starred' ? (
                starredMessages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8696A0]">
                    No starred messages yet. Hover over any message to star it.
                  </div>
                ) : (
                  starredMessages.map((msg) => {
                    const parentChat = chats.find((c) => c.id === msg.chatId);
                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectChat(msg.chatId)}
                        className="p-3.5 hover:bg-[#202C33] cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#00A884]">
                            {msg.senderName} · {parentChat?.name || 'Chat'}
                          </span>
                          <span className="text-[11px] text-[#8696A0]">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#E9EDEF] line-clamp-2">
                          {msg.content}
                        </p>
                      </div>
                    );
                  })
                )
              ) : filteredChats.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs text-[#8696A0] leading-relaxed">
                    {activeTab === 'archived'
                      ? 'No archived chats.'
                      : 'Link your WhatsApp phone via QR code to sync your conversations, or start a new chat below.'}
                  </p>
                  {activeTab !== 'archived' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setActiveTab('companion_qr')}
                        className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] text-xs font-semibold"
                      >
                        Link WhatsApp Phone (QR / Code)
                      </button>
                      <button
                        onClick={() => setShowNewChatModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-xs font-semibold text-[#E9EDEF] border border-[#2A3942]"
                      >
                        + Start New Chat
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const chatMsgs = messages.filter((m) => m.chatId === chat.id);
                  const lastMsg = chatMsgs[chatMsgs.length - 1];
                  const isSelected = activeChat?.id === chat.id;
                  const initials = chat.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={`group px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#2A3942]' : 'hover:bg-[#202C33]'
                      }`}
                    >
                      <AvatarView
                        alt={chat.name}
                        fallback={initials || 'WA'}
                        color={chat.avatarColor}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-display font-semibold text-[#E9EDEF] truncate">
                            {chat.name}
                          </h3>
                          <span className="text-[11px] text-[#8696A0] tabular-nums shrink-0">
                            {lastMsg
                              ? new Date(lastMsg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p
                            className={`text-xs text-[#8696A0] truncate transition-all ${
                              activeAccount?.blurPreviews
                                ? 'blur-[4px] group-hover:blur-none'
                                : ''
                            }`}
                          >
                            {lastMsg
                              ? `${lastMsg.senderId === 'me' ? 'You: ' : ''}${lastMsg.content}`
                              : chat.recipientPhone || chat.about}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {chat.pinned && (
                              <Pin className="w-3 h-3 text-[#00A884] rotate-45" />
                            )}
                            {chat.unreadCount > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00A884] text-[#111B21] text-[10px] font-bold flex items-center justify-center tabular-nums">
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Message Search Results */}
              {searchQuery.trim() && searchHits.length > 0 && (
                <div>
                  <div className="px-3.5 py-1.5 bg-[#182229] text-[11px] font-semibold text-[#00A884]">
                    MESSAGES ({searchHits.length})
                  </div>
                  {searchHits.map((hit) => {
                    const parentChat = chats.find((c) => c.id === hit.chatId);
                    return (
                      <div
                        key={hit.id}
                        onClick={() => handleSelectChat(hit.chatId)}
                        className="px-3.5 py-2.5 hover:bg-[#202C33] cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#E9EDEF]">
                            {parentChat?.name || hit.senderName}
                          </span>
                          <span className="text-[11px] text-[#8696A0]">
                            {new Date(hit.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[#8696A0] truncate mt-0.5">
                          {hit.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Privacy Status Bar */}
            <div className="px-4 py-2.5 bg-[#111B21] border-t border-[#222E35] flex items-center justify-between text-[11px] text-[#8696A0]">
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 hover:text-[#E9EDEF]"
              >
                <Shield className="w-3.5 h-3.5 text-[#00A884]" />
                <span>
                  {activeAccount?.stealthReadReceipts || activeAccount?.blurPreviews
                    ? 'Stealth Privacy On'
                    : 'Privacy Settings'}
                </span>
              </button>
              <button
                onClick={() => setShowCommandPalette(true)}
                className="text-[#00A884] hover:underline"
              >
                Quick Jump (Ctrl+K)
              </button>
            </div>
          </section>
        )}

        {/* COLUMN 3: Primary Stage */}
        {activeTab === 'companion_qr' && activeAccount ? (
          <CompanionQrPairingStageView
            account={activeAccount}
            waSession={waSession}
            onSessionUpdate={setWaSession}
          />
        ) : activeTab === 'status' ? (
          <StatusStoriesStageView
            accountId={activeAccountId}
            accountName={activeAccount?.name || 'My Status'}
            statusPosts={statusPosts}
            onRefresh={() => loadWorkspaceBootstrap(activeAccountId)}
          />
        ) : activeTab === 'calls' ? (
          <CallLogsStageView
            chats={chats}
            callLogs={callLogs}
            onStartCall={(chat, mode) =>
              setActiveCall({
                chatId: chat.id,
                contactName: chat.name,
                recipientPhone: chat.recipientPhone,
                avatarColor: chat.avatarColor,
                mode,
                startedAt: Date.now(),
                isMuted: false,
                isCameraOn: mode === 'video',
                isScreenSharing: false,
                isMinimized: false,
                safetyFingerprint: chat.safetyNumber.slice(0, 29),
              })
            }
          />
        ) : activeTab === 'scheduler' ? (
          <SchedulerStageView
            accountId={activeAccountId}
            chats={chats}
            scheduled={scheduled}
            onRefresh={() => loadWorkspaceBootstrap(activeAccountId)}
          />
        ) : activeTab === 'autorules' ? (
          <AutoRulesStageView
            accountId={activeAccountId}
            rules={autoRules}
            onRefresh={() => loadWorkspaceBootstrap(activeAccountId)}
          />
        ) : activeTab === 'templates' ? (
          <TemplatesStageView
            accountId={activeAccountId}
            templates={templates}
            onRefresh={() => loadWorkspaceBootstrap(activeAccountId)}
          />
        ) : activeTab === 'settings' && activeAccount ? (
          <AccountSettingsStageView
            account={activeAccount}
            onAccountUpdated={(updated) =>
              setAccounts((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a))
              )
            }
            onLockNow={() => setIsLocked(true)}
            onOpenQrLink={() => setActiveTab('companion_qr')}
          />
        ) : !activeChat ? (
          /* Clean Welcome Screen */
          <main className="flex-1 bg-[#0B141A] wa-chat-bg-dark flex items-center justify-center p-8">
            <div className="max-w-lg w-full rounded-2xl bg-[#202C33] border border-[#2A3942] p-8 space-y-6 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#00A884]/20 text-[#00A884] flex items-center justify-center mx-auto">
                <QrCode className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-display font-bold text-[#E9EDEF]">
                  WhatsApp for Desktop
                </h2>
                <p className="text-xs text-[#8696A0] mt-1.5 leading-relaxed">
                  Send and receive messages, make voice and video calls, and manage multiple accounts right from your computer.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('companion_qr')}
                className="w-full py-3 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <QrCode className="w-4 h-4" />
                <span>Link Your Phone via QR Code or Phone Number</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-[#2A3942]" />
                <span className="shrink mx-3 text-[11px] text-[#8696A0]">
                  OR START A NEW CHAT
                </span>
                <div className="grow border-t border-[#2A3942]" />
              </div>

              <form onSubmit={handleCreateChatSubmit} className="space-y-3 text-left">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChatType('direct')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      newChatType === 'direct'
                        ? 'bg-[#00A884]/20 text-[#00A884] border border-[#00A884]'
                        : 'bg-[#111B21] text-[#8696A0]'
                    }`}
                  >
                    New Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChatType('group')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      newChatType === 'group'
                        ? 'bg-[#00A884]/20 text-[#00A884] border border-[#00A884]'
                        : 'bg-[#111B21] text-[#8696A0]'
                    }`}
                  >
                    New Group
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                    placeholder={
                      newChatType === 'group' ? 'Group Name' : 'Contact Name'
                    }
                    className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2.5 text-sm text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                  />
                  <input
                    type="text"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    placeholder="Phone (+14155550199)"
                    className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2.5 text-sm text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#111B21] hover:bg-[#2A3942] text-[#E9EDEF] border border-[#2A3942] font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4 text-[#00A884]" />
                  <span>Start Conversation</span>
                </button>
              </form>

              <p className="text-[11px] text-[#8696A0] flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3 h-3 text-[#00A884]" />
                <span>Your personal messages are end-to-end encrypted</span>
              </p>
            </div>
          </main>
        ) : (
          /* ACTIVE CONVERSATION STAGE */
          <main className="flex-1 flex flex-col bg-[#0B141A] wa-chat-bg-dark overflow-hidden">
            {/* Chat Header */}
            <header className="px-5 py-3 bg-[#202C33] border-b border-[#2A3942] flex items-center justify-between gap-4 shrink-0">
              <div
                onClick={() => setShowInfoDrawer((v) => !v)}
                className="flex items-center gap-3 min-w-0 cursor-pointer"
              >
                <AvatarView
                  alt={activeChat.name}
                  fallback={activeChat.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                  color={activeChat.avatarColor}
                  size="md"
                  online={!activeAccount?.stealthPresence}
                />
                <div className="min-w-0">
                  <h2 className="text-sm font-display font-semibold text-[#E9EDEF] truncate">
                    {activeChat.name}
                  </h2>
                  <p className="text-xs text-[#8696A0] truncate">
                    {activeChat.recipientPhone || activeChat.about}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() =>
                    setActiveCall({
                      chatId: activeChat.id,
                      contactName: activeChat.name,
                      recipientPhone: activeChat.recipientPhone,
                      avatarColor: activeChat.avatarColor,
                      mode: 'video',
                      startedAt: Date.now(),
                      isMuted: false,
                      isCameraOn: true,
                      isScreenSharing: false,
                      isMinimized: false,
                      safetyFingerprint: activeChat.safetyNumber.slice(0, 29),
                    })
                  }
                  title="Video Call"
                  className="p-2 rounded-lg text-[#AEBAC1] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
                >
                  <Video className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    setActiveCall({
                      chatId: activeChat.id,
                      contactName: activeChat.name,
                      recipientPhone: activeChat.recipientPhone,
                      avatarColor: activeChat.avatarColor,
                      mode: 'voice',
                      startedAt: Date.now(),
                      isMuted: false,
                      isCameraOn: false,
                      isScreenSharing: false,
                      isMinimized: false,
                      safetyFingerprint: activeChat.safetyNumber.slice(0, 29),
                    })
                  }
                  title="Voice Call"
                  className="p-2 rounded-lg text-[#AEBAC1] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
                >
                  <Phone className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowInfoDrawer((v) => !v)}
                  title="Contact Info"
                  className={`p-2 rounded-lg transition-colors ${
                    showInfoDrawer
                      ? 'bg-[#00A884]/20 text-[#00A884]'
                      : 'text-[#AEBAC1] hover:text-[#E9EDEF] hover:bg-[#2A3942]'
                  }`}
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              <div className="max-w-lg mx-auto my-2 px-4 py-2 rounded-xl bg-[#182229]/95 border border-[#2A3942] text-center text-xs text-[#FFD279] flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
                </span>
              </div>

              {activeChatMessages.map((msg) => {
                const isMe = msg.senderId === 'me';
                const quoted = msg.replyToId
                  ? messages.find((m) => m.id === msg.replyToId)
                  : undefined;

                return (
                  <div
                    key={msg.id}
                    className={`group flex flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`relative max-w-xl rounded-2xl px-3.5 py-2.5 shadow-sm border ${
                        isMe
                          ? 'bg-[#005C4B] border-[#007a63]/40 text-[#E9EDEF] rounded-tr-xs'
                          : 'bg-[#202C33] border-[#2A3942] text-[#E9EDEF] rounded-tl-xs'
                      }`}
                    >
                      {msg.forwarded && (
                        <p className="text-[11px] italic text-[#E9EDEF]/70 mb-1 flex items-center gap-1">
                          <Forward className="w-3 h-3" />
                          <span>Forwarded</span>
                        </p>
                      )}

                      {!isMe && activeChat.type === 'group' && (
                        <p className="text-xs font-display font-semibold text-[#00A884] mb-1">
                          {msg.senderName}
                        </p>
                      )}

                      {quoted && (
                        <div className="mb-2 p-2 rounded-lg bg-black/25 border-l-2 border-[#00A884] text-xs">
                          <span className="font-semibold text-[#00A884] block">
                            {quoted.senderName}
                          </span>
                          <span className="text-[#E9EDEF]/80 line-clamp-1">
                            {quoted.content}
                          </span>
                        </div>
                      )}

                      {msg.type === 'image' && msg.mediaDataUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                          <img
                            src={msg.mediaDataUrl}
                            alt={msg.fileName || 'Photo'}
                            referrerPolicy="no-referrer"
                            className="w-full max-h-72 object-contain bg-black"
                          />
                        </div>
                      )}

                      {msg.type === 'file' && (
                        <div className="mb-2 p-3 rounded-xl bg-black/25 border border-white/10 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-5 h-5 text-[#00A884] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#E9EDEF] truncate">
                                {msg.fileName || 'Document'}
                              </p>
                              <p className="text-[11px] text-[#8696A0]">
                                {msg.fileSize || 'File'}
                              </p>
                            </div>
                          </div>
                          {msg.mediaDataUrl && (
                            <a
                              href={msg.mediaDataUrl}
                              download={msg.fileName || 'download'}
                              className="p-1.5 rounded-lg bg-[#2A3942] text-[#00A884] hover:bg-[#374854]"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}

                      {msg.type === 'voice' && (
                        <div className="py-1 space-y-1.5 min-w-[240px]">
                          {msg.mediaDataUrl ? (
                            <audio
                              controls
                              src={msg.mediaDataUrl}
                              className="h-8 w-full"
                            />
                          ) : null}
                          <p className="text-xs text-[#E9EDEF]/90">
                            🎙️ {msg.content}
                          </p>
                        </div>
                      )}

                      {msg.type === 'poll' && msg.poll && (
                        <div className="min-w-[260px] space-y-2 py-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00A884]">
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>{msg.poll.question}</span>
                          </div>
                          {msg.poll.options.map((opt) => {
                            const total = msg.poll!.options.reduce(
                              (acc, o) => acc + o.votes,
                              0
                            );
                            const pct =
                              total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                            return (
                              <button
                                key={opt.id}
                                onClick={() =>
                                  apiTransport.updateMessage(msg.id, {
                                    voteOptionId: opt.id,
                                  })
                                }
                                className="w-full text-left p-2 rounded-lg bg-black/25 hover:bg-black/35 border border-white/10"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span>
                                    {opt.votedByMe ? '✓ ' : ''}
                                    {opt.label}
                                  </span>
                                  <span className="text-[11px] text-[#8696A0] tabular-nums">
                                    {opt.votes} ({pct}%)
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                                  <div
                                    className="h-full bg-[#00A884]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {msg.type !== 'voice' && msg.type !== 'poll' && (
                        <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Timestamp & Read Status Row */}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-[#E9EDEF]/70 tabular-nums">
                        {msg.edited && <span className="italic">edited</span>}
                        {msg.starred && (
                          <Star className="w-3 h-3 text-[#FBBF24] fill-[#FBBF24]" />
                        )}
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMe && (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                        )}
                      </div>

                      {/* Hover Quick Actions (Reply, React, Edit, Forward, Star, Delete) */}
                      <div
                        className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 ${
                          isMe ? '-left-48' : '-right-48'
                        } bg-[#202C33] border border-[#2A3942] rounded-lg px-1.5 py-1 flex items-center gap-1 shadow-lg z-10`}
                      >
                        <button
                          onClick={() => setReplyingTo(msg)}
                          title="Reply"
                          className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#E9EDEF]"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setActiveReactionMsgId((cur) =>
                              cur === msg.id ? null : msg.id
                            )
                          }
                          title="React"
                          className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#E9EDEF]"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        {isMe && msg.type === 'text' && (
                          <button
                            onClick={() => {
                              setEditingMessage(msg);
                              setComposerText(msg.content);
                            }}
                            title="Edit"
                            className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#00A884]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setForwardingMessage(msg)}
                          title="Forward"
                          className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#00A884]"
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            apiTransport.updateMessage(msg.id, { toggleStar: true })
                          }
                          title="Star"
                          className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#FBBF24]"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => apiTransport.deleteMessage(msg.id)}
                          title="Delete"
                          className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#EF4444]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {activeReactionMsgId === msg.id && (
                        <div className="absolute -top-10 right-0 bg-[#202C33] border border-[#2A3942] rounded-xl px-2 py-1 flex items-center gap-1 shadow-xl z-20">
                          {QUICK_REACTIONS.map((em) => (
                            <button
                              key={em}
                              onClick={() => {
                                apiTransport.updateMessage(msg.id, { emoji: em });
                                setActiveReactionMsgId(null);
                              }}
                              className="p-1 hover:scale-125 transition-transform text-sm"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {Object.keys(msg.reactions).length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        {Object.entries(msg.reactions).map(([em, users]) => (
                          <button
                            key={em}
                            onClick={() =>
                              apiTransport.updateMessage(msg.id, { emoji: em })
                            }
                            className="px-2 py-0.5 rounded-full bg-[#202C33] border border-[#2A3942] text-xs flex items-center gap-1"
                          >
                            <span>{em}</span>
                            <span className="text-[11px] text-[#8696A0]">
                              {users.length}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply (/) Popover */}
            {matchingTemplates.length > 0 && (
              <div className="mx-6 mb-2 rounded-xl bg-[#202C33] border border-[#00A884]/60 shadow-2xl overflow-hidden">
                <div className="px-3.5 py-1.5 bg-[#111B21] text-[11px] font-semibold text-[#00A884]">
                  QUICK REPLIES
                </div>
                {matchingTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplySlashTemplate(tpl)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#2A3942] flex items-center justify-between gap-4 border-t border-[#2A3942]"
                  >
                    <div>
                      <span className="text-xs font-semibold text-[#00A884]">
                        {tpl.shortcut}
                      </span>
                      <span className="text-xs text-[#E9EDEF] ml-2 font-medium">
                        {tpl.title}
                      </span>
                    </div>
                    <span className="text-xs text-[#8696A0] truncate max-w-sm">
                      {tpl.body}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Reply or Edit Banner */}
            {(replyingTo || editingMessage) && (
              <div className="px-6 py-2 bg-[#182229] border-t border-[#2A3942] flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#00A884]">
                    {editingMessage
                      ? 'Editing Message'
                      : `Replying to ${replyingTo?.senderName}`}
                  </span>
                  <p className="text-xs text-[#8696A0] truncate">
                    {editingMessage ? editingMessage.content : replyingTo?.content}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMessage(null);
                  }}
                  className="text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Composer Footer */}
            <footer className="relative px-4 py-3 bg-[#202C33] border-t border-[#2A3942] flex items-center gap-2 shrink-0">
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-4 bg-[#202C33] border border-[#2A3942] rounded-xl p-2 shadow-2xl flex items-center gap-2 z-30">
                  {['😀', '😂', '❤️', '🔥', '👍', '🙏', '🎉', '✨'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setComposerText((t) => `${t}${em}`)}
                      className="text-lg hover:scale-125 transition-transform p-1"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Emoji"
                className="p-2 rounded-lg text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Photo or Document"
                className="p-2 rounded-lg text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowPollModal(true)}
                title="Create Poll"
                className="p-2 rounded-lg text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
              >
                <BarChart2 className="w-5 h-5" />
              </button>

              {isRecordingAudio ? (
                <div className="flex-1 bg-[#2A3942] rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#EF4444] tabular-nums">
                    ● Recording voice message · 0:
                    {String(recordingSec).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecordingAudio(false);
                        mediaRecorderRef.current?.stop();
                      }}
                      className="text-xs text-[#8696A0] hover:text-[#E9EDEF]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStopAndSendAudioRecording}
                      className="px-3 py-1 rounded-lg bg-[#00A884] text-[#111B21] font-semibold text-xs flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSendTextMessage}
                  className="flex-1 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Type a message (or / for quick replies)"
                    className="flex-1 bg-[#2A3942] text-sm text-[#E9EDEF] placeholder:text-[#8696A0] px-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  />

                  {composerText.trim() ? (
                    <button
                      type="submit"
                      title={editingMessage ? 'Save Edit' : 'Send'}
                      className="p-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartAudioRecording}
                      title="Record Voice Message"
                      className="p-2.5 rounded-xl bg-[#2A3942] hover:bg-[#374854] text-[#AEBAC1] hover:text-[#00A884]"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </footer>
          </main>
        )}

        {/* COLUMN 4: Contact Info Drawer (320px) */}
        {(activeTab === 'chats' || activeTab === 'archived') &&
          activeChat &&
          showInfoDrawer && (
            <aside className="w-[320px] bg-[#111B21] border-l border-[#222E35] flex flex-col shrink-0 overflow-y-auto">
              <div className="px-4 py-3.5 bg-[#202C33] border-b border-[#2A3942] flex items-center justify-between">
                <h3 className="text-xs font-display font-semibold text-[#E9EDEF]">
                  Contact Info
                </h3>
                <button
                  onClick={() => setShowInfoDrawer(false)}
                  className="p-1 text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col items-center text-center border-b border-[#222E35]">
                <AvatarView
                  alt={activeChat.name}
                  fallback={activeChat.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                  color={activeChat.avatarColor}
                  size="xl"
                />
                <h4 className="text-base font-display font-bold text-[#E9EDEF] mt-3">
                  {activeChat.name}
                </h4>
                <p className="text-xs text-[#8696A0] mt-0.5">
                  {activeChat.recipientPhone || (activeChat.type === 'group' ? 'Group Chat' : 'Personal Chat')}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() =>
                      apiTransport.updateChat(activeChat.id, {
                        pinned: !activeChat.pinned,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      activeChat.pinned
                        ? 'bg-[#00A884]/20 text-[#00A884]'
                        : 'bg-[#202C33] text-[#8696A0]'
                    }`}
                  >
                    {activeChat.pinned ? 'Pinned' : 'Pin Chat'}
                  </button>
                  <button
                    onClick={() =>
                      apiTransport.updateChat(activeChat.id, {
                        archived: !activeChat.archived,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      activeChat.archived
                        ? 'bg-[#00A884]/20 text-[#00A884]'
                        : 'bg-[#202C33] text-[#8696A0]'
                    }`}
                  >
                    {activeChat.archived ? 'Unarchive' : 'Archive Chat'}
                  </button>
                  <button
                    onClick={handleExportThreadHistory}
                    className="px-3 py-1.5 rounded-lg bg-[#202C33] hover:bg-[#2A3942] text-xs text-[#E9EDEF]"
                  >
                    Export Chat
                  </button>
                </div>
              </div>

              {/* Folder Assignment */}
              <div className="p-4 border-b border-[#222E35] space-y-2">
                <label className="text-xs font-display font-semibold text-[#E9EDEF] block">
                  Chat Folder
                </label>
                <select
                  value={activeChat.folderId}
                  onChange={(e) =>
                    apiTransport.updateChat(activeChat.id, {
                      folderId: e.target.value,
                    })
                  }
                  className="w-full bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-2 text-xs text-[#E9EDEF]"
                >
                  <option value="">All Chats</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Disappearing Messages */}
              <div className="p-4 border-b border-[#222E35] space-y-2">
                <label className="text-xs font-display font-semibold text-[#E9EDEF] block">
                  Disappearing Messages
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['off', '24h', '7d', '90d'] as const).map((timer) => (
                    <button
                      key={timer}
                      onClick={() =>
                        apiTransport.updateChat(activeChat.id, {
                          disappearingTimer: timer,
                        })
                      }
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeChat.disappearingTimer === timer
                          ? 'bg-[#00A884] text-[#111B21] font-semibold'
                          : 'bg-[#202C33] text-[#8696A0]'
                      }`}
                    >
                      {timer === 'off' ? 'Off' : timer}
                    </button>
                  ))}
                </div>
              </div>

              {/* End-to-End Encryption Security Code */}
              <div className="p-4 border-b border-[#222E35] space-y-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00A884]" />
                  <span className="text-xs font-display font-semibold text-[#E9EDEF]">
                    Encryption Verification Code
                  </span>
                </div>
                <p className="text-[11px] text-[#8696A0]">
                  Compare this 60-digit security code with {activeChat.name}&apos;s phone to verify end-to-end encryption.
                </p>
                <div className="p-3 rounded-xl bg-[#202C33] border border-[#2A3942] font-mono text-xs text-[#E9EDEF] tracking-wider leading-relaxed tabular-nums select-all">
                  {activeChat.safetyNumber}
                </div>
              </div>

              <div className="p-4 mt-auto">
                <button
                  onClick={async () => {
                    await apiTransport.deleteChat(activeChat.id);
                    setSelectedChatId('');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Chat</span>
                </button>
              </div>
            </aside>
          )}
      </div>

      {/* Quick Switcher (Ctrl+K) */}
      {showCommandPalette && (
        <div
          onClick={() => setShowCommandPalette(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start justify-center pt-24 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-[#202C33] border border-[#2A3942] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#111B21] border-b border-[#2A3942] flex items-center gap-3">
              <Command className="w-4 h-4 text-[#00A884]" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to a chat or action..."
                className="w-full bg-transparent text-sm text-[#E9EDEF] focus:outline-none"
              />
              <button
                onClick={() => setShowCommandPalette(false)}
                className="text-xs text-[#8696A0]"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#2A3942]">
              {[
                {
                  label: 'Link Phone via QR Code or Phone Number',
                  shortcut: 'Link Device',
                  action: () => setActiveTab('companion_qr'),
                },
                {
                  label: 'Start a New Chat or Group',
                  shortcut: 'New Chat',
                  action: () => setShowNewChatModal(true),
                },
                {
                  label: 'Add Another WhatsApp Account',
                  shortcut: 'Multi-Account',
                  action: () => setShowNewAccountModal(true),
                },
                {
                  label: 'Schedule a Message',
                  shortcut: 'Scheduler',
                  action: () => setActiveTab('scheduler'),
                },
                {
                  label: 'Configure Auto-Reply & Away Messages',
                  shortcut: 'Auto-Reply',
                  action: () => setActiveTab('autorules'),
                },
                {
                  label: 'Manage Quick Replies (/)',
                  shortcut: 'Quick Replies',
                  action: () => setActiveTab('templates'),
                },
                {
                  label: 'Privacy & Stealth Settings',
                  shortcut: 'Settings',
                  action: () => setActiveTab('settings'),
                },
                {
                  label: 'Lock App Now',
                  shortcut: 'Ctrl+L',
                  action: () => setIsLocked(true),
                },
              ]
                .filter((item) =>
                  item.label.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.action();
                      setShowCommandPalette(false);
                      setCommandQuery('');
                    }}
                    className="w-full px-5 py-3 text-left hover:bg-[#2A3942] flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-[#E9EDEF]">{item.label}</span>
                    <span className="text-[#00A884] bg-[#111B21] px-2 py-0.5 rounded border border-[#2A3942]">
                      {item.shortcut}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#E9EDEF]">
                Forward Message To
              </h3>
              <button
                onClick={() => setForwardingMessage(null)}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleForwardMessageToChat(c.id)}
                  className="w-full p-3 rounded-xl bg-[#111B21] hover:bg-[#2A3942] text-left flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-[#E9EDEF]">{c.name}</span>
                  <span className="text-[#00A884]">Send →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Contact or Group */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#E9EDEF]">
                New Chat
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChatSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewChatType('direct')}
                  className={`py-2 rounded-xl text-xs font-semibold ${
                    newChatType === 'direct'
                      ? 'bg-[#00A884] text-[#111B21]'
                      : 'bg-[#111B21] text-[#8696A0]'
                  }`}
                >
                  Contact
                </button>
                <button
                  type="button"
                  onClick={() => setNewChatType('group')}
                  className={`py-2 rounded-xl text-xs font-semibold ${
                    newChatType === 'group'
                      ? 'bg-[#00A884] text-[#111B21]'
                      : 'bg-[#111B21] text-[#8696A0]'
                  }`}
                >
                  Group
                </button>
              </div>

              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  {newChatType === 'group' ? 'Group Name' : 'Contact Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  Phone Number (e.g. +14155550199)
                </label>
                <input
                  type="text"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="+14155550199"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2A3942] text-xs text-[#E9EDEF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] font-semibold text-xs"
                >
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Another Account */}
      {showNewAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#E9EDEF]">
                Add Another WhatsApp Account
              </h3>
              <button
                onClick={() => setShowNewAccountModal(false)}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. Work WhatsApp / Personal"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2A3942] text-xs text-[#E9EDEF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] font-semibold text-xs"
                >
                  Continue to QR Scan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Custom Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#E9EDEF]">
                New Chat Folder
              </h3>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Work, Family, Friends"
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2A3942] text-xs text-[#E9EDEF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] font-semibold text-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Poll */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#E9EDEF]">
                Create Poll
              </h3>
              <button
                onClick={() => setShowPollModal(false)}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePollSubmit} className="space-y-3">
              <input
                type="text"
                required
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
              <input
                type="text"
                required
                value={pollOpt1}
                onChange={(e) => setPollOpt1(e.target.value)}
                placeholder="Option 1"
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
              <input
                type="text"
                required
                value={pollOpt2}
                onChange={(e) => setPollOpt2(e.target.value)}
                placeholder="Option 2"
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2A3942] text-xs text-[#E9EDEF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] font-semibold text-xs"
                >
                  Send Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {activeCall && (
        <CallStudioModal
          call={activeCall}
          onToggleMute={() =>
            setActiveCall((c) => (c ? { ...c, isMuted: !c.isMuted } : null))
          }
          onToggleCamera={() =>
            setActiveCall((c) =>
              c ? { ...c, isCameraOn: !c.isCameraOn } : null
            )
          }
          onToggleScreenShare={() =>
            setActiveCall((c) =>
              c ? { ...c, isScreenSharing: !c.isScreenSharing } : null
            )
          }
          onToggleMinimize={() =>
            setActiveCall((c) =>
              c ? { ...c, isMinimized: !c.isMinimized } : null
            )
          }
          onEndCall={async (dur) => {
            await apiTransport.createCallLog({
              accountId: activeAccountId,
              chatId: activeCall.chatId,
              contactName: activeCall.contactName,
              callType: activeCall.mode,
              direction: 'outgoing',
              duration: dur,
              safetyFingerprint: activeCall.safetyFingerprint,
            });
            setActiveCall(null);
            loadWorkspaceBootstrap(activeAccountId);
          }}
        />
      )}
    </div>
  );
}
