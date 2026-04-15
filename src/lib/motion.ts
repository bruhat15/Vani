import { Transition, Variants } from "framer-motion";

export const breathEase: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const transitionTokens = {
  slow: {
    duration: 0.8,
    ease: breathEase,
  } satisfies Transition,
  medium: {
    duration: 0.4,
    ease: breathEase,
  } satisfies Transition,
  fast: {
    duration: 0.15,
    ease: breathEase,
  } satisfies Transition,
};

export const viewportOnce = {
  once: true,
  amount: 0.25,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitionTokens.medium,
  },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionTokens.medium,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitionTokens.medium,
  },
};

export const createStaggerContainer = (staggerChildren = 0.08): Variants => ({
  hidden: {},
  visible: {
    transition: {
      ...transitionTokens.medium,
      staggerChildren,
    },
  },
});

export const slideInFromLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionTokens.medium,
  },
};

export const slideInFromBottom: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionTokens.medium,
  },
};
