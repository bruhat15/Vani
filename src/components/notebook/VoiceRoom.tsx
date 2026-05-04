import { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
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

const VoiceRoom = ({ notebookId }: VoiceRoomProps) => {
  const voiceStatus = useVaniAppStore((state) => state.voiceStatus);
  const setVoiceStatus = useVaniAppStore((state) => state.setVoiceStatus);
  const { toast } = useToast();

  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (voiceStatus === 'idle') {
      setTokenData(null);
    }
  }, [voiceStatus]);

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
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
};

export default VoiceRoom;
