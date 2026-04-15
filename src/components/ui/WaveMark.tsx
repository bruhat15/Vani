import { motion } from "framer-motion";

interface WaveMarkProps {
  className?: string;
}

const WaveMark = ({ className }: WaveMarkProps) => {
  return (
    <motion.svg
      className={className}
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="34" height="34" rx="10" stroke="rgba(232,232,240,0.35)" />
      <path
        d="M4 18C6.2 18 6.2 11.5 8.4 11.5C10.6 11.5 10.6 24.5 12.8 24.5C15 24.5 15 11.5 17.2 11.5C19.4 11.5 19.4 24.5 21.6 24.5C23.8 24.5 23.8 11.5 26 11.5C28.2 11.5 28.2 24.5 30.4 24.5C32.6 24.5 32.6 18 34 18"
        stroke="var(--color-saffron)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
};

export default WaveMark;
