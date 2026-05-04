
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useSources } from '@/hooks/useSources';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import NotebookHeader from '@/components/notebook/NotebookHeader';
import SourcesSidebar from '@/components/notebook/SourcesSidebar';
import ChatArea from '@/components/notebook/ChatArea';
import StudioSidebar from '@/components/notebook/StudioSidebar';
import MobileNotebookTabs from '@/components/notebook/MobileNotebookTabs';
import VoiceButton from '@/components/notebook/VoiceButton';
import VoiceRoom from '@/components/notebook/VoiceRoom';
import { Citation } from '@/types/message';
import { useVaniAppStore } from '@/stores/appStore';

const Notebook = () => {
  const { id: notebookId } = useParams();
  const setCurrentNotebookId = useVaniAppStore((state) => state.setCurrentNotebookId);
  const setActiveNotebookTab = useVaniAppStore((state) => state.setActiveNotebookTab);
  const { notebooks } = useNotebooks();
  const { sources } = useSources(notebookId);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const isDesktop = useIsDesktop();

  const notebook = notebooks?.find(n => n.id === notebookId);
  const hasSource = sources && sources.length > 0;
  const isSourceDocumentOpen = !!selectedCitation;

  useEffect(() => {
    setCurrentNotebookId(notebookId || null);
    setActiveNotebookTab(1);

    return () => {
      setCurrentNotebookId(null);
    };
  }, [notebookId, setActiveNotebookTab, setCurrentNotebookId]);

  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const handleCitationClose = () => {
    setSelectedCitation(null);
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <VoiceRoom notebookId={notebookId} />
      <VoiceButton />
      <NotebookHeader 
        title={notebook?.title || 'Untitled Notebook'} 
        notebookId={notebookId} 
      />
      
      {isDesktop ? (
        <div className="grid flex-1 overflow-hidden [grid-template-columns:240px_1fr_320px]">
          <div className="min-w-0 overflow-hidden">
            <SourcesSidebar 
              hasSource={hasSource || false} 
              notebookId={notebookId}
              selectedCitation={selectedCitation}
              onCitationClose={handleCitationClose}
              setSelectedCitation={setSelectedCitation}
            />
          </div>
          
          <div className="min-w-0 overflow-hidden">
            <ChatArea 
              hasSource={hasSource || false} 
              notebookId={notebookId}
              notebook={notebook}
              onCitationClick={handleCitationClick}
            />
          </div>
          
          <div className="min-w-0 overflow-hidden">
            <StudioSidebar 
              notebookId={notebookId} 
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>
      ) : (
        <MobileNotebookTabs
          hasSource={hasSource || false}
          notebookId={notebookId}
          notebook={notebook}
          selectedCitation={selectedCitation}
          onCitationClose={handleCitationClose}
          setSelectedCitation={setSelectedCitation}
          onCitationClick={handleCitationClick}
        />
      )}
    </div>
  );
};

export default Notebook;
