import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Bot,
  Zap,
  Shield,
  KeyRound,
  Lock,
  CheckCircle2,
  QrCode,
  Smartphone,
  RefreshCw,
  LogOut,
  CircleDot,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';
import {
  AccountProfile,
  WaCompanionSessionState,
  ChatThread,
  StatusPostRecord,
  CallLogRecord,
  ScheduledMessageJob,
  AutoReplyRule,
  QuickTemplate,
} from '../types/whatsapp';
import { apiTransport } from '../services/tauriTransport';
import { AvatarView } from './AvatarView';

/* ============================================================================
 * 1. LINK WHATSAPP ACCOUNT (LIVE QR CODE + 8-CHARACTER PHONE PAIRING CODE)
 * ============================================================================ */
interface CompanionPairingProps {
  account: AccountProfile;
  waSession: WaCompanionSessionState;
  onSessionUpdate: (state: WaCompanionSessionState) => void;
}

export const CompanionQrPairingStageView: React.FC<CompanionPairingProps> = ({
  account,
  waSession,
  onSessionUpdate,
}) => {
  const [linkMode, setLinkMode] = useState<'qr' | 'phone'>('qr');
  const [phoneInput, setPhoneInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartQr = async () => {
    setIsLoading(true);
    try {
      const next = await apiTransport.startCompanionQrSession(account.id);
      onSessionUpdate(next);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    setIsLoading(true);
    try {
      const next = await apiTransport.requestCompanionPairingCode(
        account.id,
        phoneInput.trim()
      );
      onSessionUpdate(next);
    } catch (err: any) {
      onSessionUpdate({
        ...waSession,
        lastError: err?.message || 'Unable to generate pairing code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const next = await apiTransport.disconnectCompanionSession(account.id);
    onSessionUpdate(next);
  };

  useEffect(() => {
    if (waSession.status === 'disconnected' && linkMode === 'qr') {
      handleStartQr();
    }
  }, [account.id]);

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-8 grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          {/* Left 3 Columns: Instructions & Mode Toggle */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00A884]">
              <Smartphone className="w-4 h-4" />
              <span>LINK YOUR WHATSAPP ACCOUNT</span>
            </div>

            <h2 className="text-2xl font-display font-bold text-[#E9EDEF]">
              Use WhatsApp on Your Computer
            </h2>

            <p className="text-sm text-[#8696A0] leading-relaxed">
              Scan the QR code with your phone or link with your phone number. Your chats, groups, and contacts will sync automatically.
            </p>

            <ol className="space-y-2.5 text-sm text-[#E9EDEF]/90 pt-1">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00A884]/20 text-[#00A884] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Open <strong>WhatsApp</strong> on your phone</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00A884]/20 text-[#00A884] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Tap <strong>Menu ⋮</strong> on Android, or <strong>Settings ⚙️</strong> on iPhone
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00A884]/20 text-[#00A884] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Tap <strong>Linked devices</strong> and then <strong>Link a device</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00A884]/20 text-[#00A884] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <span>
                  Point your phone at this screen to scan the QR code
                </span>
              </li>
            </ol>

            {/* Switch between QR Scan and Phone Pairing Code */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setLinkMode('qr');
                  handleStartQr();
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                  linkMode === 'qr'
                    ? 'bg-[#00A884] text-[#111B21]'
                    : 'bg-[#111B21] text-[#8696A0] border border-[#2A3942]'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Scan QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setLinkMode('phone')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                  linkMode === 'phone'
                    ? 'bg-[#00A884] text-[#111B21]'
                    : 'bg-[#111B21] text-[#8696A0] border border-[#2A3942]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Link with Phone Number Instead</span>
              </button>
            </div>

            {waSession.lastError && (
              <div className="p-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-xs text-[#F59E0B]">
                {waSession.lastError}
              </div>
            )}
          </div>

          {/* Right 2 Columns: Live QR Code / Pairing Code / Connected Badge */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center">
            {waSession.status === 'connected' ? (
              <div className="w-full rounded-2xl bg-[#111B21] border border-[#00A884]/50 p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#00A884]/20 text-[#00A884] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#00A884]">
                    CONNECTED
                  </span>
                  <h3 className="text-base font-display font-bold text-[#E9EDEF] mt-1">
                    {waSession.pushName || account.name}
                  </h3>
                  <p className="text-xs text-[#8696A0] mt-0.5">
                    {waSession.connectedJid?.split('@')[0] || account.phone}
                  </p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-2.5 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out from This Device</span>
                </button>
              </div>
            ) : linkMode === 'phone' ? (
              <div className="w-full rounded-2xl bg-[#111B21] border border-[#2A3942] p-6 space-y-4">
                <h3 className="text-sm font-display font-bold text-[#E9EDEF]">
                  Link with Phone Number
                </h3>
                <p className="text-xs text-[#8696A0]">
                  Enter your phone number with country code (for example, +14155550199)
                </p>
                <form onSubmit={handleRequestPhoneCode} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+14155550199"
                    className="w-full bg-[#202C33] border border-[#2A3942] rounded-xl px-3.5 py-2.5 text-sm text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs"
                  >
                    {isLoading ? 'Generating Code...' : 'Next'}
                  </button>
                </form>

                {waSession.pairingCode && (
                  <div className="pt-3 border-t border-[#2A3942] text-center space-y-1.5">
                    <span className="text-[11px] text-[#8696A0]">
                      Enter this code on your phone:
                    </span>
                    <div className="p-3 rounded-xl bg-[#202C33] border border-[#00A884] font-mono text-2xl font-bold tracking-widest text-[#00A884] select-all">
                      {waSession.pairingCode}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-64 h-64 rounded-2xl bg-white p-3 shadow-2xl flex items-center justify-center relative">
                  {waSession.qrDataUrl ? (
                    <img
                      src={waSession.qrDataUrl}
                      alt="WhatsApp QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center space-y-2 p-4">
                      <RefreshCw className="w-7 h-7 text-[#00A884] animate-spin mx-auto" />
                      <p className="text-xs font-medium text-[#111B21]">
                        Loading QR code...
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartQr}
                  className="px-3.5 py-1.5 rounded-lg bg-[#111B21] hover:bg-[#2A3942] text-xs text-[#00A884] border border-[#2A3942] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload QR Code</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. STATUS UPDATES (STORIES) STAGE VIEW
 * ============================================================================ */
interface StatusStageProps {
  accountId: string;
  accountName: string;
  statusPosts: StatusPostRecord[];
  onRefresh: () => void;
}

const STATUS_GRADIENTS = [
  'linear-gradient(135deg, #005C4B 0%, #0B141A 100%)',
  'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
  'linear-gradient(135deg, #4C1D95 0%, #111827 100%)',
  'linear-gradient(135deg, #7C2D12 0%, #0B141A 100%)',
];

export const StatusStoriesStageView: React.FC<StatusStageProps> = ({
  accountId,
  accountName,
  statusPosts,
  onRefresh,
}) => {
  const [content, setContent] = useState('');
  const [bgIdx, setBgIdx] = useState(0);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await apiTransport.createStatusPost({
      accountId,
      authorName: accountName,
      authorPhone: 'My Status',
      content: content.trim(),
      bgColor: STATUS_GRADIENTS[bgIdx],
    });
    setContent('');
    onRefresh();
  };

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div
          className="rounded-2xl border border-[#2A3942] p-6 space-y-4"
          style={{ background: STATUS_GRADIENTS[bgIdx] }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <CircleDot className="w-5 h-5 text-[#00A884]" />
              <span>Share a Status Update</span>
            </h2>
            <button
              type="button"
              onClick={() => setBgIdx((i) => (i + 1) % STATUS_GRADIENTS.length)}
              className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-xs text-white"
            >
              Change Background Color
            </button>
          </div>

          <form onSubmit={handlePublish} className="space-y-3">
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type a status update that disappears after 24 hours..."
              className="w-full bg-black/25 border border-white/15 rounded-xl p-4 text-base text-white placeholder:text-white/50 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs"
              >
                Share Status
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusPosts.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl bg-[#202C33] border border-[#2A3942] p-8 text-center text-xs text-[#8696A0]">
              No status updates yet. Share a status update above or link your phone to view contact statuses.
            </div>
          ) : (
            statusPosts.map((st) => (
              <div
                key={st.id}
                className="rounded-2xl border border-[#2A3942] p-6 flex flex-col justify-between min-h-[200px] relative"
                style={{ background: st.bg_color }}
              >
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="font-semibold text-white">{st.author_name}</span>
                  <div className="flex items-center gap-2">
                    <span>
                      {new Date(st.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={async () => {
                        await apiTransport.deleteStatusPost(st.id);
                        onRefresh();
                      }}
                      className="text-white/60 hover:text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-lg font-display font-semibold text-white my-auto py-4 whitespace-pre-wrap">
                  {st.content}
                </p>
                <div className="text-[11px] text-white/60">
                  {st.views} views
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. VOICE & VIDEO CALLS VIEW
 * ============================================================================ */
interface CallLogsStageProps {
  chats: ChatThread[];
  callLogs: CallLogRecord[];
  onStartCall: (chat: ChatThread, mode: 'voice' | 'video') => void;
}

export const CallLogsStageView: React.FC<CallLogsStageProps> = ({
  chats,
  callLogs,
  onStartCall,
}) => {
  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-[#E9EDEF] flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#00A884]" />
              <span>Voice &amp; Video Calls</span>
            </h2>
            <p className="text-xs text-[#8696A0] mt-0.5">
              Start an end-to-end encrypted voice, video, or screen-sharing call with any contact or group
            </p>
          </div>
        </div>

        {/* Quick Call Launchers from Contacts */}
        {chats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chats.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-[#202C33] border border-[#2A3942] p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarView
                    alt={c.name}
                    fallback={c.name.slice(0, 2).toUpperCase()}
                    color={c.avatarColor}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-display font-semibold text-[#E9EDEF] truncate">
                      {c.name}
                    </h4>
                    <p className="text-xs text-[#8696A0] truncate">
                      {c.recipientPhone || (c.type === 'group' ? 'Group' : 'Contact')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onStartCall(c, 'voice')}
                    className="p-2 rounded-lg bg-[#111B21] hover:bg-[#2A3942] text-[#00A884]"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartCall(c, 'video')}
                    className="p-2 rounded-lg bg-[#00A884] text-[#111B21] hover:bg-[#029072]"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A3942]">
            <h3 className="text-sm font-display font-semibold text-[#E9EDEF]">
              Recent Calls ({callLogs.length})
            </h3>
          </div>
          {callLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8696A0]">
              No recent calls. Select a contact above or click the call icon inside any chat.
            </div>
          ) : (
            <div className="divide-y divide-[#2A3942]">
              {callLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-6 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {log.direction === 'incoming' ? (
                      <PhoneIncoming className="w-4 h-4 text-[#00A884]" />
                    ) : log.direction === 'missed' ? (
                      <PhoneMissed className="w-4 h-4 text-[#EF4444]" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4 text-[#00A884]" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#E9EDEF]">
                        {log.contact_name}
                      </p>
                      <p className="text-xs text-[#8696A0]">
                        {log.call_type === 'video' ? 'Video call' : 'Voice call'} · {log.duration}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[#8696A0]">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. SCHEDULED MESSAGES VIEW
 * ============================================================================ */
interface SchedulerViewProps {
  accountId: string;
  chats: ChatThread[];
  scheduled: ScheduledMessageJob[];
  onRefresh: () => void;
}

export const SchedulerStageView: React.FC<SchedulerViewProps> = ({
  accountId,
  chats,
  scheduled,
  onRefresh,
}) => {
  const [targetChatId, setTargetChatId] = useState(chats[0]?.id || '');
  const [content, setContent] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('15');
  const [customDateTime, setCustomDateTime] = useState('');
  const [useQuickDelay, setUseQuickDelay] = useState(true);

  useEffect(() => {
    if (!targetChatId && chats[0]?.id) {
      setTargetChatId(chats[0].id);
    }
  }, [chats, targetChatId]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetChatId || !content.trim()) return;

    let scheduledIso = '';
    if (useQuickDelay) {
      const secs = Math.max(3, parseInt(delaySeconds, 10) || 10);
      scheduledIso = new Date(Date.now() + secs * 1000).toISOString();
    } else {
      if (!customDateTime) return;
      scheduledIso = new Date(customDateTime).toISOString();
    }

    await apiTransport.createSchedule({
      accountId,
      chatId: targetChatId,
      content: content.trim(),
      scheduledFor: scheduledIso,
    });
    setContent('');
    onRefresh();
  };

  const handleCancelJob = async (id: string) => {
    await apiTransport.cancelSchedule(id);
    onRefresh();
  };

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-[#E9EDEF] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00A884]" />
                <span>Schedule Messages</span>
              </h2>
              <p className="text-xs text-[#8696A0] mt-0.5">
                Write a message now and have it sent automatically at your chosen time.
              </p>
            </div>
          </div>

          {chats.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#111B21] border border-[#2A3942] text-xs text-[#8696A0]">
              Link your WhatsApp account or add a contact in Chats first before scheduling a message.
            </div>
          ) : (
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#8696A0] block mb-1.5">
                    Select Chat
                  </label>
                  <select
                    value={targetChatId}
                    onChange={(e) => setTargetChatId(e.target.value)}
                    className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2.5 text-sm text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                  >
                    {chats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-[#8696A0]">When to Send</label>
                    <button
                      type="button"
                      onClick={() => setUseQuickDelay((v) => !v)}
                      className="text-xs text-[#00A884] hover:underline"
                    >
                      {useQuickDelay ? 'Pick Date & Time' : 'Quick Timer'}
                    </button>
                  </div>
                  {useQuickDelay ? (
                    <div className="flex items-center gap-2">
                      {[
                        { val: '15', label: 'In 15s' },
                        { val: '60', label: 'In 1m' },
                        { val: '300', label: 'In 5m' },
                        { val: '3600', label: 'In 1h' },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setDelaySeconds(item.val)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                            delaySeconds === item.val
                              ? 'bg-[#00A884] text-[#111B21] font-semibold'
                              : 'bg-[#111B21] text-[#8696A0] border border-[#2A3942]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8696A0] block mb-1.5">
                  Message
                </label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl p-3.5 text-sm text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Message</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Scheduled Messages List */}
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A3942]">
            <h3 className="text-sm font-display font-semibold text-[#E9EDEF]">
              Scheduled Messages ({scheduled.length})
            </h3>
          </div>

          {scheduled.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8696A0]">
              No scheduled messages yet.
            </div>
          ) : (
            <div className="divide-y divide-[#2A3942]">
              {scheduled.map((job) => {
                const chat = chats.find((c) => c.id === job.chat_id);
                return (
                  <div
                    key={job.id}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#E9EDEF]">
                          {chat?.name || 'Chat'}
                        </span>
                        <span className="text-[#8696A0]">·</span>
                        <span className="text-[#8696A0] tabular-nums">
                          {new Date(job.scheduled_for).toLocaleString()}
                        </span>
                        <span className="text-[#8696A0]">·</span>
                        <span
                          className={`font-semibold ${
                            job.status === 'sent'
                              ? 'text-[#00A884]'
                              : job.status === 'pending'
                              ? 'text-[#F59E0B]'
                              : 'text-[#8696A0]'
                          }`}
                        >
                          {job.status === 'sent'
                            ? 'Sent'
                            : job.status === 'pending'
                            ? 'Scheduled'
                            : 'Cancelled'}
                        </span>
                      </div>
                      <p className="text-sm text-[#E9EDEF] mt-1 truncate">
                        {job.content}
                      </p>
                    </div>
                    {job.status === 'pending' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-xs font-medium shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. AUTO-REPLY & AWAY MESSAGES VIEW
 * ============================================================================ */
interface AutoRulesViewProps {
  accountId: string;
  rules: AutoReplyRule[];
  onRefresh: () => void;
}

export const AutoRulesStageView: React.FC<AutoRulesViewProps> = ({
  accountId,
  rules,
  onRefresh,
}) => {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<
    'contains' | 'keyword' | 'all_incoming'
  >('contains');
  const [triggerValue, setTriggerValue] = useState('');
  const [replyContent, setReplyContent] = useState('');

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !replyContent.trim()) return;
    await apiTransport.createAutoRule({
      accountId,
      name: name.trim(),
      triggerType,
      triggerValue: triggerValue.trim(),
      replyContent: replyContent.trim(),
    });
    setName('');
    setTriggerValue('');
    setReplyContent('');
    onRefresh();
  };

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6">
          <h2 className="text-lg font-display font-bold text-[#E9EDEF] flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#00A884]" />
            <span>Auto-Reply &amp; Away Messages</span>
          </h2>
          <p className="text-xs text-[#8696A0] mt-1 mb-4">
            Automatically reply when you are busy or when a message contains specific words.
          </p>

          <form onSubmit={handleCreateRule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-[#8696A0] block mb-1">Label</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. In a Meeting"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  When to Reply
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                >
                  <option value="contains">Message contains word</option>
                  <option value="keyword">Exact word match</option>
                  <option value="all_incoming">All incoming messages (Away mode)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  Word or Phrase {triggerType === 'all_incoming' && '(Optional)'}
                </label>
                <input
                  type="text"
                  disabled={triggerType === 'all_incoming'}
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder="e.g. urgent, meeting, price"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF] disabled:opacity-40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8696A0] block mb-1">
                Auto-Reply Message
              </label>
              <textarea
                rows={2}
                required
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Hi, I'm currently away and will get back to you shortly."
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl p-3 text-sm text-[#E9EDEF]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Save Auto-Reply</span>
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A3942]">
            <h3 className="text-sm font-display font-semibold text-[#E9EDEF]">
              Saved Auto-Replies ({rules.length})
            </h3>
          </div>

          {rules.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8696A0]">
              No auto-replies set up yet.
            </div>
          ) : (
            <div className="divide-y divide-[#2A3942]">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="px-6 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#E9EDEF]">{r.name}</span>
                      <span className="text-[#8696A0]">·</span>
                      <span className="text-[#00A884]">
                        {r.trigger_type === 'all_incoming'
                          ? 'Replies to all messages'
                          : `When message matches "${r.trigger_value}"`}
                      </span>
                    </div>
                    <p className="text-xs text-[#8696A0] mt-1">{r.reply_content}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await apiTransport.toggleAutoRule(r.id);
                        onRefresh();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        r.enabled
                          ? 'bg-[#00A884]/20 text-[#00A884]'
                          : 'bg-[#111B21] text-[#8696A0]'
                      }`}
                    >
                      {r.enabled ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={async () => {
                        await apiTransport.deleteAutoRule(r.id);
                        onRefresh();
                      }}
                      className="p-2 rounded-lg text-[#8696A0] hover:text-[#EF4444]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. QUICK REPLIES MANAGER
 * ============================================================================ */
interface TemplatesViewProps {
  accountId: string;
  templates: QuickTemplate[];
  onRefresh: () => void;
}

export const TemplatesStageView: React.FC<TemplatesViewProps> = ({
  accountId,
  templates,
  onRefresh,
}) => {
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcut.trim() || !body.trim()) return;
    await apiTransport.createTemplate({
      accountId,
      shortcut: shortcut.trim(),
      title: title.trim() || shortcut.trim(),
      body: body.trim(),
    });
    setShortcut('');
    setTitle('');
    setBody('');
    onRefresh();
  };

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6">
          <h2 className="text-lg font-display font-bold text-[#E9EDEF] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00A884]" />
            <span>Quick Replies</span>
          </h2>
          <p className="text-xs text-[#8696A0] mt-1 mb-4">
            Save frequent messages and type <code className="text-[#00A884] font-semibold">/</code> in any chat to insert them immediately.
          </p>

          <form onSubmit={handleAddTemplate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  Shortcut
                </label>
                <input
                  type="text"
                  required
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder="/thanks or /onmyway"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8696A0] block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="On My Way"
                  className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8696A0] block mb-1">
                Message Text
              </label>
              <textarea
                rows={3}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi {{name}}, I'm on my way and will be there shortly!"
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl p-3 text-sm text-[#E9EDEF]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Save Quick Reply</span>
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] divide-y divide-[#2A3942]">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="px-6 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#00A884] bg-[#111B21] px-2.5 py-1 rounded-md border border-[#2A3942]">
                    {tpl.shortcut}
                  </span>
                  <span className="text-sm font-semibold text-[#E9EDEF]">
                    {tpl.title}
                  </span>
                </div>
                <p className="text-xs text-[#8696A0] mt-1.5 whitespace-pre-wrap">
                  {tpl.body}
                </p>
              </div>
              <button
                onClick={async () => {
                  await apiTransport.deleteTemplate(tpl.id);
                  onRefresh();
                }}
                className="p-2 text-[#8696A0] hover:text-[#EF4444]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 7. PRIVACY, STEALTH & APP LOCK SETTINGS VIEW
 * ============================================================================ */
interface SettingsStageProps {
  account: AccountProfile;
  onAccountUpdated: (updated: AccountProfile) => void;
  onLockNow: () => void;
  onOpenQrLink: () => void;
}

export const AccountSettingsStageView: React.FC<SettingsStageProps> = ({
  account,
  onAccountUpdated,
  onLockNow,
  onOpenQrLink,
}) => {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [newPin, setNewPin] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    setName(account.name);
    setPhone(account.phone);
  }, [account]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await apiTransport.updateAccount(account.id, {
      name,
      phone,
      newLockPin: newPin.trim() ? newPin.trim() : undefined,
    });
    setNewPin('');
    onAccountUpdated(updated);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleToggleStealthFlag = async (
    field: 'stealthReadReceipts' | 'stealthPresence' | 'blurPreviews',
    val: boolean
  ) => {
    const updated = await apiTransport.updateAccount(account.id, {
      [field]: val,
    });
    onAccountUpdated(updated);
  };

  return (
    <div className="flex-1 bg-[#0B141A] overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-bold text-[#E9EDEF] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00A884]" />
                <span>Privacy &amp; Stealth Controls</span>
              </h2>
              <p className="text-xs text-[#8696A0]">
                Control your read receipts, online visibility, and screen privacy
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenQrLink}
                className="px-4 py-2 rounded-xl bg-[#00A884] text-[#111B21] text-xs font-semibold flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Linked Device Status</span>
              </button>
              {account.hasLockPin && (
                <button
                  onClick={onLockNow}
                  className="px-4 py-2 rounded-xl bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock App (Ctrl+L)</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() =>
                handleToggleStealthFlag(
                  'stealthReadReceipts',
                  !account.stealthReadReceipts
                )
              }
              className={`p-4 rounded-xl border text-left transition-colors ${
                account.stealthReadReceipts
                  ? 'bg-[#00A884]/15 border-[#00A884]'
                  : 'bg-[#111B21] border-[#2A3942]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#E9EDEF]">
                <span>Hide Blue Read Ticks</span>
                <span className="text-[#00A884]">
                  {account.stealthReadReceipts ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-[#8696A0] mt-1.5">
                Read messages privately without letting others see blue checkmarks.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                handleToggleStealthFlag('stealthPresence', !account.stealthPresence)
              }
              className={`p-4 rounded-xl border text-left transition-colors ${
                account.stealthPresence
                  ? 'bg-[#00A884]/15 border-[#00A884]'
                  : 'bg-[#111B21] border-[#2A3942]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#E9EDEF]">
                <span>Hide Online &amp; Typing Status</span>
                <span className="text-[#00A884]">
                  {account.stealthPresence ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-[#8696A0] mt-1.5">
                Stay invisible while browsing chats or typing replies.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                handleToggleStealthFlag('blurPreviews', !account.blurPreviews)
              }
              className={`p-4 rounded-xl border text-left transition-colors ${
                account.blurPreviews
                  ? 'bg-[#00A884]/15 border-[#00A884]'
                  : 'bg-[#111B21] border-[#2A3942]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#E9EDEF]">
                <span>Blur Chat List Previews</span>
                <span className="text-[#00A884]">
                  {account.blurPreviews ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-[#8696A0] mt-1.5">
                Blur message previews in the sidebar until you hover over them.
              </p>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl bg-[#202C33] border border-[#2A3942] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-[#E9EDEF] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#00A884]" />
              <span>Account Profile &amp; App Lock Passcode</span>
            </h3>
            {savedBanner && (
              <span className="text-xs text-[#00A884] flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings Saved</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8696A0] block mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
            </div>
            <div>
              <label className="text-xs text-[#8696A0] block mb-1">
                Phone Number or Status Note
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#2A3942] items-end">
            <div>
              <label className="text-xs text-[#8696A0] block mb-1">
                Screen Lock PIN
              </label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder={
                  account.hasLockPin
                    ? 'PIN is enabled — enter a new PIN to change'
                    : 'Set a PIN to lock your app with Ctrl+L'
                }
                className="w-full bg-[#111B21] border border-[#2A3942] rounded-xl px-3.5 py-2 text-sm text-[#E9EDEF]"
              />
            </div>
            <div className="flex justify-end gap-2">
              {account.hasLockPin && (
                <button
                  type="button"
                  onClick={async () => {
                    const updated = await apiTransport.updateAccount(account.id, {
                      clearLockPin: true,
                    });
                    onAccountUpdated(updated);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#2A3942] text-xs text-[#E9EDEF]"
                >
                  Remove PIN
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#029072] text-[#111B21] font-semibold text-xs"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
