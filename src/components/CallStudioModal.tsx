import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Minimize2,
  Maximize2,
  Lock,
} from 'lucide-react';
import { ActiveRtcCall } from '../types/whatsapp';
import { AvatarView } from './AvatarView';

interface CallStudioModalProps {
  call: ActiveRtcCall;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleMinimize: () => void;
  onEndCall: (durationFormatted: string) => void;
}

export const CallStudioModal: React.FC<CallStudioModalProps> = ({
  call,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleMinimize,
  onEndCall,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [mediaStatus, setMediaStatus] = useState<string>('Connected');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - call.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [call.startedAt]);

  useEffect(() => {
    const syncHardwareStreams = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (call.isScreenSharing && navigator.mediaDevices?.getDisplayMedia) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          streamRef.current = displayStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = displayStream;
          }
          setMediaStatus('Sharing your screen');
          return;
        } catch {
          setMediaStatus('Screen sharing cancelled');
        }
      }

      if (call.isCameraOn && navigator.mediaDevices?.getUserMedia) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: !call.isMuted,
          });
          streamRef.current = camStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = camStream;
          }
          setMediaStatus('Video Call');
          return;
        } catch {
          setMediaStatus('Voice Call');
        }
      } else {
        setMediaStatus('Voice Call');
      }
    };

    syncHardwareStreams();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [call.isScreenSharing, call.isCameraOn, call.isMuted]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const initials = call.contactName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (call.isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 w-80 bg-[#202C33] border border-[#2A3942] rounded-xl shadow-2xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AvatarView
            alt={call.contactName}
            fallback={initials || 'WA'}
            color={call.avatarColor}
            size="md"
            online
          />
          <div className="min-w-0">
            <p className="text-sm font-display font-semibold text-[#E9EDEF] truncate">
              {call.contactName}
            </p>
            <p className="text-xs font-mono tabular-nums text-[#00A884]">
              {formatDuration(elapsedSec)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg transition-colors ${
              call.isMuted
                ? 'bg-[#EF4444]/20 text-[#EF4444]'
                : 'bg-[#2A3942] text-[#E9EDEF]'
            }`}
          >
            {call.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleMinimize}
            className="p-2 rounded-lg bg-[#2A3942] text-[#E9EDEF]"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEndCall(formatDuration(elapsedSec))}
            className="p-2 rounded-lg bg-[#EF4444] text-white"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-4xl h-[78vh] bg-[#111B21] border border-[#2A3942] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-3.5 bg-[#202C33] border-b border-[#2A3942] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#8696A0]">
            <Lock className="w-3.5 h-3.5 text-[#00A884]" />
            <span>End-to-end encrypted</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-[#E9EDEF] bg-[#111B21] px-3 py-1 rounded-md border border-[#2A3942]">
              {formatDuration(elapsedSec)}
            </span>
            <button
              onClick={onToggleMinimize}
              className="p-1.5 rounded-lg text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]"
              title="Minimize Call Window"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#0B141A] relative flex flex-col items-center justify-center p-6 overflow-hidden">
          {call.isScreenSharing || call.isCameraOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain rounded-xl border border-[#2A3942] bg-black"
            />
          ) : (
            <div className="flex flex-col items-center text-center">
              <AvatarView
                alt={call.contactName}
                fallback={initials || 'WA'}
                color={call.avatarColor}
                size="xl"
                online
              />
              <h3 className="text-xl font-display font-semibold text-[#E9EDEF] mt-4">
                {call.contactName}
              </h3>
              <p className="text-xs text-[#8696A0] mt-1">
                {mediaStatus}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#202C33] border-t border-[#2A3942] flex items-center justify-center gap-4">
          <button
            onClick={onToggleMute}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-colors ${
              call.isMuted
                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                : 'bg-[#2A3942] text-[#E9EDEF] hover:bg-[#374854]'
            }`}
          >
            {call.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{call.isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            onClick={onToggleCamera}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-colors ${
              call.isCameraOn
                ? 'bg-[#00A884] text-[#111B21] font-semibold'
                : 'bg-[#2A3942] text-[#E9EDEF] hover:bg-[#374854]'
            }`}
          >
            {call.isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            <span>{call.isCameraOn ? 'Turn Off Video' : 'Turn On Video'}</span>
          </button>

          <button
            onClick={onToggleScreenShare}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-colors ${
              call.isScreenSharing
                ? 'bg-[#00A884] text-[#111B21] font-semibold'
                : 'bg-[#2A3942] text-[#E9EDEF] hover:bg-[#374854]'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
            <span>{call.isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>

          <button
            onClick={() => onEndCall(formatDuration(elapsedSec))}
            className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold text-xs flex items-center gap-2 transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
