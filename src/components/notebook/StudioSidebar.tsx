import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AudioLines,
  Bot,
  Brain,
  CheckCircle2,
  ChevronLeft,
  Edit,
  FolderKanban,
  Loader2,
  Plus,
  Sparkles,
  User,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAudioOverview } from '@/hooks/useAudioOverview';
import { useNotebooks } from '@/hooks/useNotebooks';
import { Note, useNotes } from '@/hooks/useNotes';
import { useSources } from '@/hooks/useSources';
import AudioPlayer from './AudioPlayer';
import NoteEditor from './NoteEditor';
import { Citation } from '@/types/message';

type StudioFeatureKey = 'audio' | 'summary' | 'mind-map' | 'quiz' | 'concepts';

interface StudioFeatureCard {
  key: StudioFeatureKey;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface HoverTooltip {
  text: string;
  x: number;
  y: number;
}

interface StudioSidebarProps {
  notebookId?: string;
  isExpanded?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

const featureCards: StudioFeatureCard[] = [
  {
    key: 'audio',
    title: 'Audio Overview',
    description: 'Generate narrated summaries from sources and replay key learning moments.',
    icon: AudioLines,
  },
  {
    key: 'summary',
    title: 'Summary',
    description: 'Condense notebook content into concise insights for faster revision sessions.',
    icon: Sparkles,
  },
  {
    key: 'mind-map',
    title: 'Mind Map',
    description: 'Visualize topic relationships as connected nodes for structured conceptual understanding.',
    icon: Brain,
  },
  {
    key: 'quiz',
    title: 'Quiz Me',
    description: 'Create quick question drills to test retention before important exams.',
    icon: FolderKanban,
  },
  {
    key: 'concepts',
    title: 'Key Concepts',
    description: 'Extract essential terms and definitions to strengthen long-term memory recall.',
    icon: Sparkles,
  },
];

const StudioSidebar = ({ notebookId, onCitationClick }: StudioSidebarProps) => {
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [activeFeature, setActiveFeature] = useState<StudioFeatureKey | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  const { notes, isLoading, createNote, updateNote, deleteNote, isCreating, isUpdating, isDeleting } = useNotes(notebookId);
  const { notebooks } = useNotebooks();
  const { sources } = useSources(notebookId);

  const {
    generateAudioOverview,
    refreshAudioUrl,
    autoRefreshIfExpired,
    isGenerating,
    isAutoRefreshing,
    generationStatus,
    checkAudioExpiry,
  } = useAudioOverview(notebookId);

  const queryClient = useQueryClient();
  const notebook = notebooks?.find((item) => item.id === notebookId);
  const hasValidAudio = Boolean(notebook?.audio_overview_url) && !checkAudioExpiry(notebook?.audio_url_expires_at ?? null);
  const currentStatus = generationStatus || notebook?.audio_overview_generation_status;
  const hasProcessedSource = sources?.some((source) => source.processing_status === 'completed') || false;

  const isAudioRunning = currentStatus === 'generating' || isGenerating || isAutoRefreshing;
  const isAudioReady = hasValidAudio && !isAudioRunning;
  const hasAudioTask = isAudioRunning || isAudioReady || currentStatus === 'failed';

  useEffect(() => {
    if (!notebookId || !notebook?.audio_overview_url) {
      return;
    }

    const checkAndRefresh = async () => {
      if (checkAudioExpiry(notebook.audio_url_expires_at)) {
        await autoRefreshIfExpired(notebookId, notebook.audio_url_expires_at);
      }
    };

    checkAndRefresh();
    const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshIfExpired, checkAudioExpiry, notebook?.audio_overview_url, notebook?.audio_url_expires_at, notebookId]);

  const handleCreateNote = () => {
    setIsCreatingNote(true);
    setEditingNote(null);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsCreatingNote(false);
  };

  const handleSaveNote = (title: string, content: string) => {
    if (editingNote) {
      if (editingNote.source_type === 'user') {
        updateNote({
          id: editingNote.id,
          title,
          content,
        });
      }
    } else {
      createNote({
        title,
        content,
        source_type: 'user',
      });
    }

    setEditingNote(null);
    setIsCreatingNote(false);
  };

  const handleDeleteNote = () => {
    if (editingNote) {
      deleteNote(editingNote.id);
      setEditingNote(null);
    }
  };

  const handleCancel = () => {
    setEditingNote(null);
    setIsCreatingNote(false);
  };

  const handleGenerateAudio = () => {
    if (notebookId) {
      generateAudioOverview(notebookId);
      setAudioError(false);
    }
  };

  const handleAudioError = () => {
    setAudioError(true);
  };

  const handleAudioRetry = () => {
    handleGenerateAudio();
  };

  const handleAudioDeleted = () => {
    if (notebookId) {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    }

    setAudioError(false);
  };

  const handleUrlRefresh = (id: string) => {
    refreshAudioUrl(id);
  };

  const handleFeatureClick = (feature: StudioFeatureKey) => {
    if (feature === 'audio') {
      if (isAudioReady) {
        setActiveFeature('audio');
        return;
      }

      if (!isAudioRunning) {
        handleGenerateAudio();
      }

      return;
    }

    setActiveFeature(feature);
  };

  const getPreviewText = (note: Note) => {
    if (note.source_type === 'ai_response') {
      if (note.extracted_text) {
        return note.extracted_text;
      }

      try {
        const parsed = JSON.parse(note.content) as { segments?: Array<{ text?: string }> };

        if (parsed.segments && parsed.segments[0]?.text) {
          return parsed.segments[0].text;
        }
      } catch {
        return note.content;
      }
    }

    return note.content.length > 100 ? `${note.content.substring(0, 100)}...` : note.content;
  };

  const activityText = useMemo(() => {
    if (isAutoRefreshing) {
      return {
        title: 'Refreshing Audio Overview...',
        subtitle: 'Updating secure URL for playback access',
      };
    }

    if (isAudioRunning) {
      return {
        title: 'Generating Audio Overview...',
        subtitle: 'Come back in a few minutes',
      };
    }

    if (currentStatus === 'failed') {
      return {
        title: 'Audio generation failed',
        subtitle: 'Tap to retry generation',
      };
    }

    return {
      title: 'Audio Overview ready',
      subtitle: 'Tap to open playback controls',
    };
  }, [currentStatus, isAudioRunning, isAutoRefreshing]);

  const isEditingMode = Boolean(editingNote) || isCreatingNote;

  if (isEditingMode) {
    return (
      <div className="w-full border-l border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-slate-900 flex flex-col h-full overflow-hidden">
        <NoteEditor
          note={editingNote || undefined}
          onSave={handleSaveNote}
          onDelete={editingNote ? handleDeleteNote : undefined}
          onCancel={handleCancel}
          isLoading={isCreating || isUpdating || isDeleting}
          onCitationClick={onCitationClick}
        />
      </div>
    );
  }

  const renderAudioFeature = () => {
    return (
      <div className="flex h-full flex-col overflow-hidden p-4">
        <Card className="border border-gray-200 dark:border-gray-700 dark:bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg text-gray-900 dark:text-slate-100">Audio Overview</h3>
            {isAudioReady && <Badge className="bg-[var(--color-sage)] text-white">Ready</Badge>}
          </div>

          {hasValidAudio && !audioError && !isAudioRunning ? (
            <AudioPlayer
              audioUrl={notebook?.audio_overview_url || ''}
              title="Deep Dive Conversation"
              notebookId={notebookId}
              expiresAt={notebook?.audio_url_expires_at}
              onError={handleAudioError}
              onRetry={handleAudioRetry}
              onDeleted={handleAudioDeleted}
              onUrlRefresh={handleUrlRefresh}
            />
          ) : (
            <div className="space-y-3">
              {(isAudioRunning || currentStatus === 'failed') && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-2">
                    {isAudioRunning ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{activityText.title}</p>
                      <p className="text-xs text-gray-600 dark:text-slate-400">{activityText.subtitle}</p>
                    </div>
                  </div>
                </div>
              )}

              {audioError && (
                <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2">
                  <p className="text-sm text-red-700">Audio unavailable. Retry generation.</p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleGenerateAudio}
                disabled={isAudioRunning || !hasProcessedSource}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {isAudioRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Audio Overview'
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderPlaceholderFeature = () => {
    const currentFeature = featureCards.find((feature) => feature.key === activeFeature);

    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full border border-gray-200 dark:border-gray-700 dark:bg-slate-900 p-6 text-center">
          <h3 className="mb-2 text-2xl text-gray-900 dark:text-slate-100">{currentFeature?.title}</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">{currentFeature?.description}</p>
          <Badge className="mt-4 bg-[var(--color-saffron)] text-white">Coming soon</Badge>
        </Card>
      </div>
    );
  };

  return (
    <div className="relative w-full border-l border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          {activeFeature && (
            <button
              type="button"
              onClick={() => setActiveFeature(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-slate-200"
              aria-label="Back to studio overview"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-lg font-medium text-gray-900 dark:text-slate-100">Studio</h2>
        </div>
      </div>

      {activeFeature ? (
        <div className="flex-1 overflow-hidden">{activeFeature === 'audio' ? renderAudioFeature() : renderPlaceholderFeature()}</div>
      ) : (
        <ScrollArea className="flex-1 h-full">
          <div className="space-y-4 p-4 pb-24">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                const isAudioCardRunning = feature.key === 'audio' && isAudioRunning;
                const isAudioCardReady = feature.key === 'audio' && isAudioReady;

                return (
                  <motion.button
                    key={feature.key}
                    type="button"
                    className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    onClick={() => handleFeatureClick(feature.key)}
                    onMouseEnter={(event) => {
                      setHoverTooltip({
                        text: feature.description,
                        x: event.clientX + 12,
                        y: event.clientY + 12,
                      });
                    }}
                    onMouseMove={(event) => {
                      setHoverTooltip({
                        text: feature.description,
                        x: event.clientX + 12,
                        y: event.clientY + 12,
                      });
                    }}
                    onMouseLeave={() => setHoverTooltip(null)}
                  >
                    <div className="mb-2 flex items-center gap-2 text-gray-700 dark:text-slate-300">
                      <Icon className="h-4 w-4" />
                      <span className="text-base text-gray-900 dark:text-slate-100">{feature.title}</span>
                    </div>

                    {feature.key === 'audio' && (
                      <div className="flex items-center gap-2 text-xs">
                        {isAudioCardRunning && (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                            <span className="text-blue-700">Generating...</span>
                          </>
                        )}
                        {isAudioCardReady && (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-700">Ready to open</span>
                          </>
                        )}
                        {currentStatus === 'failed' && (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-red-700">Failed, tap to retry</span>
                          </>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {hasAudioTask && (
              <motion.button
                type="button"
                className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm"
                onClick={() => {
                  if (isAudioReady) {
                    setActiveFeature('audio');
                  }

                  if (currentStatus === 'failed') {
                    handleGenerateAudio();
                  }
                }}
                whileHover={{ y: isAudioReady ? -1 : 0 }}
              >
                {isAudioRunning && (
                  <motion.div
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-100%', '260%'] }}
                    transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
                  />
                )}

                <div className="relative flex items-start gap-3">
                  {isAudioRunning ? (
                    <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-blue-600" />
                  ) : currentStatus === 'failed' ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  )}

                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-slate-100">{activityText.title}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{activityText.subtitle}</p>
                  </div>
                </div>
              </motion.button>
            )}

            <div>
              <h3 className="mb-3 text-sm uppercase tracking-wide text-gray-500 dark:text-slate-400">Notes</h3>

              {isLoading ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Loading notes...</p>
                </div>
              ) : notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card
                      key={note.id}
                      className="cursor-pointer border border-gray-200 dark:border-gray-700 dark:bg-slate-900 p-3 hover:bg-gray-50 dark:hover:bg-slate-800"
                      onClick={() => handleEditNote(note)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center space-x-2">
                            {note.source_type === 'ai_response' ? <Bot className="h-3 w-3 text-blue-600" /> : <User className="h-3 w-3 text-gray-600" />}
                            <span className="text-xs uppercase text-gray-500 dark:text-slate-400">{note.source_type === 'ai_response' ? 'AI Response' : 'Note'}</span>
                          </div>
                          <h4 className="truncate font-medium text-gray-900 dark:text-slate-100">{note.title}</h4>
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-slate-400">{getPreviewText(note)}</p>
                          <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">{new Date(note.updated_at).toLocaleDateString()}</p>
                        </div>
                        {note.source_type === 'user' && (
                          <Button variant="ghost" size="sm" className="ml-2">
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-slate-400">No notes yet. Use Add note to create one.</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}

      {!activeFeature && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
          <Button
            type="button"
            onClick={handleCreateNote}
            className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-6 text-gray-900 dark:text-slate-100 shadow-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add note
          </Button>
        </div>
      )}

      <AnimatePresence>
        {hoverTooltip && !activeFeature && (
          <motion.div
            key="studio-hover-tooltip"
            className="pointer-events-none fixed z-[90] max-w-[260px] rounded-md bg-[var(--color-ink)] px-3 py-2 text-xs text-[var(--color-paper)] shadow-lg"
            style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            {hoverTooltip.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioSidebar;
