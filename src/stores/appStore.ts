import { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { Citation } from "@/types/message";

export type VoiceAgentStatus = "idle" | "listening" | "speaking";
export type ThemeMode = "dark" | "light";

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem("vani-theme");
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
};

export interface CitationHighlightEvent {
  citation: Citation;
  timestamp: number;
}

interface VaniAppState {
  session: Session | null;
  user: User | null;
  currentNotebookId: string | null;
  activeNotebookTab: number;
  voiceStatus: VoiceAgentStatus;
  theme: ThemeMode;
  citationHighlightEvent: CitationHighlightEvent | null;
  setAuthSession: (session: Session | null) => void;
  clearAuthSession: () => void;
  setCurrentNotebookId: (notebookId: string | null) => void;
  setActiveNotebookTab: (tabIndex: number) => void;
  setVoiceStatus: (status: VoiceAgentStatus) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  triggerCitationHighlight: (citation: Citation) => void;
  clearCitationHighlight: () => void;
}

export const useVaniAppStore = create<VaniAppState>((set) => ({
  session: null,
  user: null,
  currentNotebookId: null,
  activeNotebookTab: 1,
  voiceStatus: "idle",
  theme: resolveInitialTheme(),
  citationHighlightEvent: null,
  setAuthSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },
  clearAuthSession: () => {
    set({
      session: null,
      user: null,
    });
  },
  setCurrentNotebookId: (notebookId) => {
    set({ currentNotebookId: notebookId });
  },
  setActiveNotebookTab: (tabIndex) => {
    set({ activeNotebookTab: tabIndex });
  },
  setVoiceStatus: (status) => {
    set({ voiceStatus: status });
  },
  setTheme: (theme) => {
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark",
    }));
  },
  triggerCitationHighlight: (citation) => {
    set({
      citationHighlightEvent: {
        citation,
        timestamp: Date.now(),
      },
    });
  },
  clearCitationHighlight: () => {
    set({ citationHighlightEvent: null });
  },
}));
