import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { buildWavePath } from '@/lib/waveform';
import { useVaniAppStore } from '@/stores/appStore';

const VoiceButton = () => {
  const voiceStatus = useVaniAppStore((state) => state.voiceStatus);
  const setVoiceStatus = useVaniAppStore((state) => state.setVoiceStatus);

  const [amplitude, setAmplitude] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const frameRef = useRef<number | null>(null);

  const stopListeningPipeline = () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    analyserRef.current = null;
    dataArrayRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAmplitude(0);
  };

  useEffect(() => {
    if (voiceStatus !== 'listening') {
      stopListeningPipeline();
      return;
    }

    let isCancelled = false;

    const startListeningPipeline = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        streamRef.current = stream;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;

        const tick = () => {
          if (!analyserRef.current || !dataArrayRef.current) {
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          const total = dataArrayRef.current.reduce((sum, value) => sum + value, 0);
          const normalized = total / (dataArrayRef.current.length * 255);
          setAmplitude(normalized);

          frameRef.current = window.requestAnimationFrame(tick);
        };

        frameRef.current = window.requestAnimationFrame(tick);
      } catch (error) {
        console.error('Microphone access failed:', error);
        setVoiceStatus('idle');
      }
    };

    startListeningPipeline();

    return () => {
      isCancelled = true;
      stopListeningPipeline();
    };
  }, [setVoiceStatus, voiceStatus]);

  const handleVoiceClick = () => {
    if (voiceStatus === 'idle') {
      setVoiceStatus('listening');
      return;
    }

    setVoiceStatus('idle');
  };

  const waveAmplitude = useMemo(() => {
    if (voiceStatus === 'listening') {
      return 4 + amplitude * 14;
    }

    if (voiceStatus === 'speaking') {
      return 8;
    }

    return 4;
  }, [amplitude, voiceStatus]);

  const wavePath = useMemo(
    () =>
      buildWavePath({
        width: 44,
        height: 18,
        amplitude: waveAmplitude,
        frequency: 2,
        phase: 0,
        points: 34,
      }),
    [waveAmplitude]
  );

  const buttonClasses = {
    idle: 'bg-[var(--color-navy)] border-[color:rgba(232,232,240,0.5)]',
    listening: 'bg-[var(--color-sage)] border-[color:rgba(245,240,232,0.65)]',
    speaking: 'bg-[var(--color-saffron)] border-[color:rgba(245,240,232,0.65)]',
  };

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0 z-20 bg-[var(--color-navy)]"
        initial={false}
        animate={{ opacity: voiceStatus === 'listening' ? 0.15 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />

      <motion.button
        type="button"
        className={`absolute bottom-[124px] left-1/2 z-30 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border ${buttonClasses[voiceStatus]}`}
        onClick={handleVoiceClick}
        animate={{ scale: voiceStatus === 'listening' ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 1, repeat: voiceStatus === 'listening' ? Infinity : 0, ease: [0.4, 0, 0.2, 1] }}
        aria-label={`Voice state: ${voiceStatus}`}
      >
        <svg viewBox="0 0 44 18" className="h-5 w-11" aria-hidden="true">
          <path d={wavePath} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.button>
    </>
  );
};

export default VoiceButton;
