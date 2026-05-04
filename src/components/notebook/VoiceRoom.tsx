import { useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, RoomEvent } from 'livekit-client';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useVaniAppStore } from '@/stores/appStore';

interface VoiceRoomProps {
  notebookId?: string;
}

interface LiveKitTokenResponse {
  token: string;
  url: string;
  room: string;
  identity: string;
}

interface TranscriptPayload {
  type?: string;
  user?: string;
  agent?: string;
}

const TranscriptListener = ({ onTranscript }: { onTranscript: (payload: TranscriptPayload) => void }) => {
  const room = useRoomContext();

  useEffect(() => {
    const handleData = (payload: Uint8Array, _participant?: unknown, kind?: DataPacket_Kind) => {
      if (kind !== DataPacket_Kind.RELIABLE) {
        return;
      }

      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text) as TranscriptPayload;

        if (parsed?.type === 'transcript') {
          onTranscript(parsed);
        }
      } catch {
        // Ignore non-JSON data packets.
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [onTranscript, room]);

  return null;
};

const VoiceRoom = ({ notebookId }: VoiceRoomProps) => {
  const voiceStatus = useVaniAppStore((state) => state.voiceStatus);
  const setVoiceStatus = useVaniAppStore((state) => state.setVoiceStatus);
  const { toast } = useToast();

  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [transcript, setTranscript] = useState<{ user: string; agent: string } | null>(null);

  useEffect(() => {
    if (voiceStatus === 'idle') {
      setTokenData(null);
      setTranscript(null);
    }
  }, [voiceStatus]);

  const handleTranscript = useMemo(() => {
    return (payload: TranscriptPayload) => {
      setTranscript({
        user: payload.user || '',
        agent: payload.agent || '',
      });
    };
  }, []);

  useEffect(() => {
    if (voiceStatus === 'idle') {
      return;
    }

    if (!notebookId) {
      toast({
        title: 'Voice mode unavailable',
        description: 'Open a notebook to start a voice session.',
        variant: 'destructive',
      });
      setVoiceStatus('idle');
      return;
    }

    if (tokenData || isRequesting) {
      return;
    }

    setIsRequesting(true);
    supabase.functions
      .invoke<LiveKitTokenResponse>('livekit-token', {
        body: { notebook_id: notebookId },
      })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        if (!data?.token || !data?.url) {
          throw new Error('Invalid LiveKit token response');
        }

        setTokenData(data);
      })
      .catch((error) => {
        console.error('Failed to start voice room:', error);
        toast({
          title: 'Voice connection failed',
          description: error?.message || 'Unable to get a LiveKit token.',
          variant: 'destructive',
        });
        setVoiceStatus('idle');
      })
      .finally(() => {
        setIsRequesting(false);
      });
  }, [voiceStatus, notebookId, tokenData, isRequesting, setVoiceStatus, toast]);

  if (voiceStatus === 'idle' || !tokenData) {
    return null;
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.url}
      connect={voiceStatus !== 'idle'}
      audio={true}
      video={false}
      onDisconnected={() => setVoiceStatus('idle')}
    >
      <TranscriptListener onTranscript={handleTranscript} />
      <RoomAudioRenderer />
      {transcript ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur">
          <div className="mb-1 text-[11px] uppercase tracking-[0.24em] text-cyan-300/80">Live Transcript</div>
          <div className="space-y-1">
            {transcript.user ? <div><span className="text-slate-400">You:</span> {transcript.user}</div> : null}
            {transcript.agent ? <div><span className="text-cyan-300">Vani:</span> {transcript.agent}</div> : null}
          </div>
        </div>
      ) : null}
    </LiveKitRoom>
  );
};

export default VoiceRoom;
