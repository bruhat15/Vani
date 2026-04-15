import { useCallback, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useAnimatedWavePath } from "@/hooks/useAnimatedWavePath";

const LandingHeroSection = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mouseLeanRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const waveWidth = useTransform(scrollYProgress, [0, 1], [600, 32]);
  const waveHeight = useTransform(scrollYProgress, [0, 1], [120, 32]);
  const waveTop = useTransform(scrollYProgress, [0, 1], ["50%", "1rem"]);
  const waveLeft = useTransform(scrollYProgress, [0, 1], ["50%", "1rem"]);
  const waveX = useTransform(scrollYProgress, [0, 1], [-300, 0]);
  const waveY = useTransform(scrollYProgress, [0, 1], [-60, 0]);
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const heroTextY = useTransform(scrollYProgress, [0, 0.35], [0, -36]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseLeanRef.current = Math.max(-1, Math.min(1, normalizedX));
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const getPhaseOffset = useCallback(() => {
    return mouseLeanRef.current * 0.3;
  }, []);

  const wavePath = useAnimatedWavePath({
    width: 600,
    height: 120,
    amplitude: 18,
    frequency: 2,
    points: 100,
    phaseStep: 0.02,
    getPhaseOffset,
  });

  return (
    <section ref={sectionRef} className="relative min-h-[160svh] bg-[var(--color-navy)] text-[var(--color-paper)]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(232,137,12,0.24),_transparent_55%)]" aria-hidden="true" />

        <motion.div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center" style={{ opacity: heroTextOpacity, y: heroTextY }}>
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[var(--color-saffron)]">Voice-first knowledge studio</p>
          <h1 className="mb-5 max-w-4xl text-5xl leading-tight md:text-7xl">Talk with the ideas inside your own documents.</h1>
          <p className="max-w-2xl text-base text-[color:rgba(245,240,232,0.78)] md:text-lg">
            Upload notes, books, and papers, then learn through grounded conversation.
          </p>
        </motion.div>

        <motion.svg
          viewBox="0 0 600 120"
          className="pointer-events-none fixed z-[55]"
          role="img"
          aria-label="Animated Vani waveform"
          style={{
            width: waveWidth,
            height: waveHeight,
            top: waveTop,
            left: waveLeft,
            x: waveX,
            y: waveY,
          }}
        >
          <path
            d={wavePath}
            fill="none"
            stroke="var(--color-saffron)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </motion.svg>
      </div>
    </section>
  );
};

export default LandingHeroSection;
