import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RippleButton } from '@/components/ui/ripple-button';
import { Input } from '@/components/ui/input';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { buildWavePath } from '@/lib/waveform';

const NotebookGrid = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { notebooks, isLoading, createNotebook, isCreating } = useNotebooks();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');

  const orderedNotebooks = useMemo(() => {
    const data = notebooks ? [...notebooks] : [];
    return data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [notebooks]);

  const miniWavePath = useMemo(() => {
    return buildWavePath({
      width: 180,
      height: 34,
      amplitude: 6,
      frequency: 2,
      phase: 0,
      points: 48,
    });
  }, []);

  const handleCreateNotebook = (event: FormEvent) => {
    event.preventDefault();

    createNotebook(
      {
        title: newNotebookTitle.trim() || 'Untitled notebook',
        description: '',
      },
      {
        onSuccess: (data) => {
          setIsCreateModalOpen(false);
          setNewNotebookTitle('');
          navigate(`/notebook/${data.id}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Loading notebooks...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <motion.button
          type="button"
          className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-saffron)] bg-[color:rgba(245,240,232,0.65)] dark:bg-slate-900/60 p-6 text-center"
          onClick={() => setIsCreateModalOpen(true)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="mb-4 rounded-full border border-[color:rgba(232,137,12,0.45)] bg-[color:rgba(232,137,12,0.1)] p-4 transition-transform duration-300 group-hover:scale-105">
            <Plus className="h-8 w-8 text-[var(--color-saffron)]" />
          </div>
          <h3 className="text-2xl text-[var(--color-ink)] dark:text-slate-100">New Notebook</h3>
          <p className="mt-2 text-sm text-[color:rgba(26,26,46,0.64)] dark:text-slate-400">Start a fresh conversation from your own sources.</p>
        </motion.button>

        {orderedNotebooks.map((notebook, index) => (
          <motion.article
            key={notebook.id}
            className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-[var(--color-mist)] dark:border-gray-700 bg-white dark:bg-slate-900 p-6 shadow-[0_24px_60px_rgba(26,26,46,0.08)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
          >
            <div>
              <h3 className="line-clamp-2 text-3xl text-[var(--color-ink)] dark:text-slate-100">{notebook.title}</h3>
              <p className="mt-2 line-clamp-1 text-sm text-[color:rgba(26,26,46,0.66)] dark:text-slate-400">
                {notebook.description?.trim() || 'Continue exploring this notebook conversation.'}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <svg viewBox="0 0 180 34" className="h-8 w-full" aria-hidden="true">
                <path d={miniWavePath} fill="none" stroke="rgba(232,137,12,0.88)" strokeWidth="2" strokeLinecap="round" />
              </svg>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[color:rgba(26,26,46,0.58)] dark:text-slate-500">
                  Updated {new Date(notebook.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <RippleButton size="sm" className="bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[color:rgba(26,26,46,0.92)]" onClick={() => navigate(`/notebook/${notebook.id}`)}>
                  Continue
                </RippleButton>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            className="fixed inset-0 z-[80] bg-[color:rgba(13,17,23,0.55)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCreateModalOpen(false)}
          >
            {isMobile ? (
              <motion.div
                className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[var(--color-paper)] dark:bg-slate-900 p-6"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={handleCreateNotebook} className="space-y-4">
                  <h2 className="text-3xl text-[var(--color-ink)]">Create notebook</h2>
                  <Input
                    value={newNotebookTitle}
                    onChange={(event) => setNewNotebookTitle(event.target.value)}
                    placeholder="Notebook name"
                    className="border-[var(--color-mist)]"
                  />
                  <div className="flex justify-end gap-2">
                    <RippleButton type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </RippleButton>
                    <RippleButton type="submit" disabled={isCreating} className="bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]">
                      {isCreating ? 'Creating...' : 'Create'}
                    </RippleButton>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--color-mist)] dark:border-gray-700 bg-[var(--color-paper)] dark:bg-slate-900 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.28)]"
                initial={{ opacity: 0, y: 22, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 22, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={handleCreateNotebook} className="space-y-5">
                  <h2 className="text-4xl text-[var(--color-ink)] dark:text-slate-100">Create notebook</h2>
                  <Input
                    value={newNotebookTitle}
                    onChange={(event) => setNewNotebookTitle(event.target.value)}
                    placeholder="Notebook name"
                    className="border-[var(--color-mist)]"
                  />
                  <div className="flex justify-end gap-2">
                    <RippleButton type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </RippleButton>
                    <RippleButton type="submit" disabled={isCreating} className="bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]">
                      {isCreating ? 'Creating...' : 'Create'}
                    </RippleButton>
                  </div>
                </form>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NotebookGrid;
