
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Trash2, Edit, Loader2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import AddSourcesDialog from './AddSourcesDialog';
import RenameSourceDialog from './RenameSourceDialog';
import SourceContentViewer from '@/components/chat/SourceContentViewer';
import { useSources } from '@/hooks/useSources';
import { useSourceDelete } from '@/hooks/useSourceDelete';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDocumentProcessing } from '@/hooks/useDocumentProcessing';
import { useNotebookGeneration } from '@/hooks/useNotebookGeneration';
import { useToast } from '@/hooks/use-toast';
import { Citation } from '@/types/message';
import { useVaniAppStore } from '@/stores/appStore';

interface SourcesSidebarProps {
  hasSource: boolean;
  notebookId?: string;
  selectedCitation?: Citation | null;
  onCitationClose?: () => void;
  setSelectedCitation?: (citation: Citation | null) => void;
}

interface SourceListItem {
  id: string;
  title: string;
  type: string;
  processing_status: string | null;
  summary: string | null;
  content: string | null;
  url: string | null;
}

const SourcesSidebar = ({
  hasSource,
  notebookId,
  selectedCitation,
  onCitationClose,
  setSelectedCitation
}: SourcesSidebarProps) => {
  const [showAddSourcesDialog, setShowAddSourcesDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceListItem | null>(null);
  const [selectedSourceForViewing, setSelectedSourceForViewing] = useState<SourceListItem | null>(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { toast } = useToast();
  const citationHighlightEvent = useVaniAppStore((state) => state.citationHighlightEvent);

  const {
    sources,
    isLoading,
    addSourceAsync,
    updateSource,
  } = useSources(notebookId);

  const { uploadFile } = useFileUpload();
  const { processDocumentAsync } = useDocumentProcessing();
  const { generateNotebookContentAsync } = useNotebookGeneration();

  const {
    deleteSource,
    isDeleting
  } = useSourceDelete();

  // Get the source content for the selected citation
  const getSourceContent = (citation: Citation) => {
    const source = sources?.find(s => s.id === citation.source_id);
    return source?.content || '';
  };

  // Get the source summary for the selected citation
  const getSourceSummary = (citation: Citation) => {
    const source = sources?.find(s => s.id === citation.source_id);
    return source?.summary || '';
  };

  // Get the source URL for the selected citation
  const getSourceUrl = (citation: Citation) => {
    const source = sources?.find(s => s.id === citation.source_id);
    return source?.url || '';
  };

  // Get the source summary for a selected source
  const getSelectedSourceSummary = () => {
    return selectedSourceForViewing?.summary || '';
  };

  // Get the source content for a selected source  
  const getSelectedSourceContent = () => {
    return selectedSourceForViewing?.content || '';
  };

  // Get the source URL for a selected source
  const getSelectedSourceUrl = () => {
    return selectedSourceForViewing?.url || '';
  };

  
  const renderSourceIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'pdf': '/file-types/PDF.svg',
      'text': '/file-types/TXT.png',
      'website': '/file-types/WEB.svg',
      'youtube': '/file-types/MP3.png',
      'audio': '/file-types/MP3.png',
      'doc': '/file-types/DOC.png',
      'multiple-websites': '/file-types/WEB.svg',
      'copied-text': '/file-types/TXT.png'
    };

    const iconUrl = iconMap[type] || iconMap['text']; // fallback to TXT icon

    return (
      <img 
        src={iconUrl} 
        alt={`${type} icon`} 
        className="w-full h-full object-contain" 
        onError={(e) => {
          // Fallback to a simple text indicator if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.parentElement!.innerHTML = '📄';
        }} 
      />
    );
  };

  const renderProcessingStatus = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-pulse text-gray-500" />;
      default:
        return null;
    }
  };

  const handleRemoveSource = (source: SourceListItem) => {
    setSelectedSource(source);
    setShowDeleteDialog(true);
  };

  const handleRenameSource = (source: SourceListItem) => {
    setSelectedSource(source);
    setShowRenameDialog(true);
  };

  const handleSourceClick = (source: SourceListItem) => {
    console.log('SourcesSidebar: Source clicked from list', {
      sourceId: source.id,
      sourceTitle: source.title
    });

    // Clear any existing citation state first
    if (setSelectedCitation) {
      setSelectedCitation(null);
    }

    // Set the selected source for viewing
    setSelectedSourceForViewing(source);

    // Create a mock citation for the selected source without line data (this prevents auto-scroll)
    const mockCitation: Citation = {
      citation_id: -1, // Use negative ID to indicate this is a mock citation
      source_id: source.id,
      source_title: source.title,
      source_type: source.type,
      chunk_index: 0,
      excerpt: 'Full document view'
      // Deliberately omitting chunk_lines_from and chunk_lines_to to prevent auto-scroll
    };

    console.log('SourcesSidebar: Created mock citation', mockCitation);

    // Set the mock citation after a small delay to ensure state is clean
    setTimeout(() => {
      if (setSelectedCitation) {
        setSelectedCitation(mockCitation);
      }
    }, 50);
  };

  const handleBackToSources = () => {
    console.log('SourcesSidebar: Back to sources clicked');
    setSelectedSourceForViewing(null);
    onCitationClose?.();
  };

  const confirmDelete = () => {
    if (selectedSource) {
      deleteSource(selectedSource.id);
      setShowDeleteDialog(false);
      setSelectedSource(null);
    }
  };

  const highlightedCitationSourceId = citationHighlightEvent?.citation?.source_id;

  useEffect(() => {
    if (!highlightedCitationSourceId) {
      return;
    }

    const nextSourceId = highlightedCitationSourceId;
    setHighlightedSourceId(nextSourceId);

    sourceCardRefs.current[nextSourceId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    const timer = window.setTimeout(() => {
      setHighlightedSourceId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [citationHighlightEvent?.timestamp, highlightedCitationSourceId]);

  const getFileSourceType = (file: File): 'pdf' | 'text' | 'audio' => {
    if (file.type.includes('pdf')) {
      return 'pdf';
    }

    if (file.type.includes('audio')) {
      return 'audio';
    }

    return 'text';
  };

  const processUploadedFile = async (file: File, sourceId: string) => {
    if (!notebookId) {
      return;
    }

    const sourceType = getFileSourceType(file);

    try {
      updateSource({ sourceId, updates: { processing_status: 'uploading' } });

      const filePath = await uploadFile(file, notebookId, sourceId);

      if (!filePath) {
        throw new Error('No file path returned from upload');
      }

      updateSource({
        sourceId,
        updates: {
          file_path: filePath,
          processing_status: 'processing',
        },
      });

      await processDocumentAsync({
        sourceId,
        filePath,
        sourceType,
      });

      await generateNotebookContentAsync({
        notebookId,
        filePath,
        sourceType,
      });

      updateSource({ sourceId, updates: { processing_status: 'completed' } });
    } catch (error) {
      console.error('Quick upload processing failed:', error);
      updateSource({ sourceId, updates: { processing_status: 'failed' } });
    }
  };

  const handleQuickUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!notebookId || !event.target.files?.length) {
      return;
    }

    const files = Array.from(event.target.files);
    setIsQuickUploading(true);

    try {
      const createdSources = await Promise.all(
        files.map((file) =>
          addSourceAsync({
            notebookId,
            title: file.name,
            type: getFileSourceType(file),
            file_size: file.size,
            processing_status: 'pending',
            metadata: {
              fileName: file.name,
              fileType: file.type,
            },
          })
        )
      );

      await Promise.all(
        files.map((file, index) => processUploadedFile(file, createdSources[index].id))
      );

      toast({
        title: 'Upload complete',
        description: `${files.length} file${files.length > 1 ? 's' : ''} added to sources.`,
      });
    } catch (error) {
      console.error('Quick upload failed:', error);
      toast({
        title: 'Upload failed',
        description: 'Unable to add files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsQuickUploading(false);
      event.target.value = '';
    }
  };

  const shouldShowSourceContentViewer = !!selectedCitation && (selectedCitation.citation_id === -1 || !!selectedSourceForViewing);

  if (shouldShowSourceContentViewer && selectedCitation) {
    console.log('SourcesSidebar: Rendering content viewer for citation', {
      citationId: selectedCitation.citation_id,
      sourceId: selectedCitation.source_id,
      hasLineData: !!(selectedCitation.chunk_lines_from && selectedCitation.chunk_lines_to),
      isFromSourceList: selectedCitation.citation_id === -1
    });

    // Determine which citation to display and get appropriate content/summary/url
    const displayCitation = selectedCitation;
    const sourceContent = selectedSourceForViewing ? getSelectedSourceContent() : getSourceContent(selectedCitation);
    const sourceSummary = selectedSourceForViewing ? getSelectedSourceSummary() : getSourceSummary(selectedCitation);
    const sourceUrl = selectedSourceForViewing ? getSelectedSourceUrl() : getSourceUrl(selectedCitation);

    return (
      <div className="w-full border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-slate-900 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="cursor-pointer text-lg font-medium text-gray-900 hover:text-gray-700 dark:text-slate-100 dark:hover:text-slate-300" onClick={handleBackToSources}>
              Sources
            </h2>
            <Button variant="ghost" onClick={handleBackToSources} className="p-2 [&_svg]:!w-6 [&_svg]:!h-6">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                <path d="M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z" />
              </svg>
            </Button>
          </div>
        </div>
        
        <SourceContentViewer 
          citation={displayCitation} 
          sourceContent={sourceContent} 
          sourceSummary={sourceSummary}
          sourceUrl={sourceUrl}
          className="flex-1 overflow-hidden" 
          isOpenedFromSourceList={selectedCitation.citation_id === -1}
        />
      </div>
    );
  }

  return (
    <div className="w-full border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-slate-100">Sources</h2>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isQuickUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isQuickUploading ? 'Uploading...' : 'Upload'}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAddSourcesDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt,.md,.mp3,.wav,.m4a"
            onChange={handleQuickUploadChange}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 h-full">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600 dark:text-slate-400">Loading sources...</p>
            </div>
          ) : sources && sources.length > 0 ? (
            <div className="space-y-4">
              {sources.map((source) => {
                const typedSource = source as SourceListItem;
                const isSourceProcessing = ['pending', 'uploading', 'processing'].includes(source.processing_status || '');
                const isHighlighted =
                  highlightedSourceId === source.id ||
                  (!!selectedCitation && selectedCitation.citation_id !== -1 && selectedCitation.source_id === source.id);

                return (
                  <motion.div
                    key={source.id}
                    ref={(element) => {
                      sourceCardRefs.current[source.id] = element;
                    }}
                    className="rounded-lg"
                    initial={{ x: -20, opacity: 0 }}
                    animate={
                      isHighlighted
                        ? {
                            x: 0,
                            opacity: 1,
                            boxShadow: [
                              '0 0 0 0 rgba(232,137,12,0)',
                              '0 0 0 4px rgba(232,137,12,0.45)',
                              '0 0 0 0 rgba(232,137,12,0)',
                            ],
                          }
                        : {
                            x: 0,
                            opacity: 1,
                            boxShadow: '0 0 0 0 rgba(232,137,12,0)',
                          }
                    }
                    transition={
                      isHighlighted
                        ? { duration: 1.2, ease: [0.4, 0, 0.2, 1], times: [0, 0.5, 1] }
                        : { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
                    }
                  >
                    <ContextMenu>
                      <ContextMenuTrigger>
                        <Card
                          className={`p-3 border border-gray-200 dark:border-gray-700 ${
                            isSourceProcessing
                              ? 'cursor-progress bg-gray-50 dark:bg-slate-800'
                              : 'cursor-pointer hover:bg-gray-50 dark:bg-slate-900 dark:hover:bg-slate-800'
                          }`}
                          onClick={() => {
                            if (!isSourceProcessing) {
                              handleSourceClick(typedSource);
                            }
                          }}
                        >
                          {isSourceProcessing ? (
                            <div className="flex items-center justify-between space-x-3">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className="h-6 w-6 rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-700" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="h-2.5 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-slate-600" />
                                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-slate-600" />
                                </div>
                              </div>
                              <div className="flex-shrink-0 py-[4px]">
                                {renderProcessingStatus(source.processing_status)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between space-x-3">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className="w-6 h-6 bg-white rounded border border-gray-200 dark:border-gray-700 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {renderSourceIcon(source.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-900 dark:text-slate-100 truncate block">{source.title}</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 py-[4px]">
                                {renderProcessingStatus(source.processing_status)}
                              </div>
                            </div>
                          )}
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleRenameSource(typedSource)} disabled={isSourceProcessing}>
                          <Edit className="h-4 w-4 mr-2" />
                          Rename source
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleRemoveSource(typedSource)}
                          className="text-red-600 focus:text-red-600"
                          disabled={isSourceProcessing}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove source
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-200 dark:bg-slate-700 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-gray-400 dark:text-slate-300 text-2xl">📄</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Saved sources will appear here</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Click Add source above to add PDFs, text, or audio files.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AddSourcesDialog 
        open={showAddSourcesDialog} 
        onOpenChange={setShowAddSourcesDialog} 
        notebookId={notebookId} 
      />

      <RenameSourceDialog 
        open={showRenameDialog} 
        onOpenChange={setShowRenameDialog} 
        source={selectedSource} 
        notebookId={notebookId} 
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedSource?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to delete this source. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700" 
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SourcesSidebar;
