import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Upload, Loader2, RefreshCw, Sparkles, Mic, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useSources } from '@/hooks/useSources';
import MarkdownRenderer from '@/components/chat/MarkdownRenderer';
import SaveToNoteButton from './SaveToNoteButton';
import AddSourcesDialog from './AddSourcesDialog';
import { Citation, EnhancedChatMessage } from '@/types/message';
import { supabase } from '@/integrations/supabase/client';
import { useVaniAppStore } from '@/stores/appStore';

interface ChatAreaProps {
  hasSource: boolean;
  notebookId?: string;
  notebook?: {
    id: string;
    title: string;
    description?: string;
    generation_status?: string;
    icon?: string;
    example_questions?: string[];
  } | null;
  onCitationClick?: (citation: Citation) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getTextFromUnknownObject = (value: unknown): string => {
  if (!isRecord(value)) {
    return '';
  }

  const text = value.text;
  return typeof text === 'string' ? text : '';
};

const extractTextFromMessage = (content: unknown): string => {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as unknown;

      if (isRecord(parsed)) {
        const output = parsed.output;
        if (typeof output === 'string') {
          return output;
        }

        if (Array.isArray(output)) {
          return output.map((item) => getTextFromUnknownObject(item)).join(' ');
        }

        const segments = parsed.segments;
        if (Array.isArray(segments)) {
          return segments.map((segment) => getTextFromUnknownObject(segment)).join(' ');
        }
      }
    } catch {
      return content;
    }
    return content;
  }

  if (isRecord(content)) {
    const segments = content.segments;
    if (Array.isArray(segments)) {
      return segments.map((segment) => getTextFromUnknownObject(segment)).join(' ');
    }

    if (typeof content.text === 'string') {
      return content.text;
    }
  }

  return '';
};

const ChatArea = ({
  hasSource,
  notebookId,
  notebook,
  onCitationClick
}: ChatAreaProps) => {
  const [message, setMessage] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [showAiLoading, setShowAiLoading] = useState(false);
  const [clickedQuestions, setClickedQuestions] = useState<Set<string>>(new Set());
  const [showAddSourcesDialog, setShowAddSourcesDialog] = useState(false);
  const [contextualQuestions, setContextualQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const lastProcessedMsgIdRef = useRef<number | null>(null);
  const lastUserQuestionRef = useRef<string>('');
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceInputSeedRef = useRef<string>('');

  const isGenerating = notebook?.generation_status === 'generating';

  const {
    messages,
    sendMessage,
    isSending,
    deleteChatHistory,
    isDeletingChatHistory
  } = useChatMessages(notebookId);

  const { sources } = useSources(notebookId);
  const sourceCount = sources?.length || 0;
  const hasProcessedSource = sources?.some(source => source.processing_status === 'completed') || false;
  const isChatDisabled = !hasProcessedSource;

  const [lastMessageCount, setLastMessageCount] = useState(0);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const triggerCitationHighlight = useVaniAppStore((state) => state.triggerCitationHighlight);
  const voiceStatus = useVaniAppStore((state) => state.voiceStatus);
  const isVoiceRoomActive = voiceStatus !== 'idle';

  const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  };

  const isSpeechInputSupported = !!getSpeechRecognitionConstructor();

  const getMessageType = (msg: EnhancedChatMessage): string | undefined => {
    if (msg.message?.type) {
      return msg.message.type;
    }

    const roleCandidate = (msg.message as Record<string, unknown>).role;
    return typeof roleCandidate === 'string' ? roleCandidate : undefined;
  };

  useEffect(() => {
    if (messages.length > lastMessageCount && pendingUserMessage) {
      setPendingUserMessage(null);
      setShowAiLoading(false);
    }
    setLastMessageCount(messages.length);
  }, [messages.length, lastMessageCount, pendingUserMessage]);

  useEffect(() => {
    if (!scrollAreaRef.current) {
      return;
    }

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');

    if (!viewport) {
      return;
    }

    setTimeout(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  }, [messages.length]);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
    };
  }, []);

  // Generate contextual follow-up questions after each AI response
  useEffect(() => {
    if (!notebookId || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const msgType = getMessageType(lastMsg);
    const isAi = msgType === 'ai' || msgType === 'assistant';

    if (!isAi) return;
    if (lastMsg.id === lastProcessedMsgIdRef.current) return;

    lastProcessedMsgIdRef.current = lastMsg.id;

    const aiText = extractTextFromMessage(lastMsg.message?.content);
    if (!aiText || aiText.length < 20) return;

    setIsGeneratingQuestions(true);
    setContextualQuestions([]);

    supabase.functions.invoke('generate-followup-questions', {
      body: {
        lastAiMessage: aiText,
        userQuestion: lastUserQuestionRef.current,
      }
    }).then(({ data, error }) => {
      if (!error && data?.questions && Array.isArray(data.questions)) {
        setContextualQuestions(data.questions);
      }
    }).finally(() => {
      setIsGeneratingQuestions(false);
    });
  }, [messages, notebookId]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim();
    if (textToSend && notebookId) {
      try {
        lastUserQuestionRef.current = textToSend;
        setContextualQuestions([]);
        setPendingUserMessage(textToSend);
        await sendMessage({
          notebookId: notebookId,
          role: 'user',
          content: textToSend
        });
        setMessage('');
        setShowAiLoading(true);
      } catch (error) {
        console.error('Failed to send message:', error);
        setPendingUserMessage(null);
        setShowAiLoading(false);
      }
    }
  };

  const handleRefreshChat = () => {
    if (notebookId) {
      deleteChatHistory(notebookId);
      setClickedQuestions(new Set());
      setContextualQuestions([]);
      lastProcessedMsgIdRef.current = null;
      lastUserQuestionRef.current = '';
    }
  };

  const handleCitationClick = (citation: Citation) => {
    triggerCitationHighlight(citation);
    onCitationClick?.(citation);
  };

  const handleExampleQuestionClick = (question: string) => {
    setClickedQuestions(prev => new Set(prev).add(question));
    setMessage(question);
    handleSendMessage(question);
  };

  const handleContextualQuestionClick = (question: string) => {
    setContextualQuestions(prev => prev.filter(q => q !== question));
    handleSendMessage(question);
  };

  const composeTranscript = (results: ArrayLike<SpeechRecognitionResultLike>): string => {
    let transcript = '';

    for (let index = 0; index < results.length; index += 1) {
      const phrase = results[index]?.[0]?.transcript?.trim();
      if (phrase) {
        transcript = `${transcript} ${phrase}`.trim();
      }
    }

    return transcript;
  };

  const toggleSpeechInput = () => {
    if (!isSpeechInputSupported) {
      setSpeechError('Voice input is not supported in this browser.');
      return;
    }

    if (isVoiceRoomActive) {
      setSpeechError('Voice room is active. Turn it off to use speech input here.');
      return;
    }

    if (isListening && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setSpeechError('Voice input is not supported in this browser.');
      return;
    }

    const recognition = speechRecognitionRef.current ?? new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    voiceInputSeedRef.current = message.trim();

    recognition.onresult = (event) => {
      const transcript = composeTranscript(event.results);
      const combinedText = [voiceInputSeedRef.current, transcript].filter(Boolean).join(' ').trim();
      setMessage(combinedText);
    };

    recognition.onerror = (event) => {
      setSpeechError(`Voice input error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    setSpeechError(null);
    setIsListening(true);
    recognition.start();
  };

  const isUserMessage = (msg: EnhancedChatMessage) => {
    const messageType = getMessageType(msg);
    return messageType === 'human' || messageType === 'user';
  };

  const isAiMessage = (msg: EnhancedChatMessage) => {
    const messageType = getMessageType(msg);
    return messageType === 'ai' || messageType === 'assistant';
  };

  const shouldShowScrollTarget = () => messages.length > 0 || pendingUserMessage || showAiLoading;
  const shouldShowRefreshButton = messages.length > 0;

  const exampleQuestions = notebook?.example_questions?.filter(q => !clickedQuestions.has(q)) || [];
  const hasConversation = messages.length > 0;
  const questionsToShow = hasConversation ? contextualQuestions : exampleQuestions;
  const showQuestionsSkeleton = hasConversation && isGeneratingQuestions;

  const getPlaceholderText = () => {
    if (isChatDisabled) {
      if (sourceCount === 0) return "Upload a source to get started...";
      return "Please wait while your sources are being processed...";
    }
    return "Start typing...";
  };

  return (
    <div className="flex-1 flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-slate-950">
      {hasSource ? (
        <div className="relative flex-1 flex h-full flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-slate-100">Chat</h2>
              {shouldShowRefreshButton && (
                <Button variant="ghost" size="sm" onClick={handleRefreshChat} disabled={isDeletingChatHistory || isChatDisabled} className="flex items-center space-x-2">
                  <RefreshCw className={`h-4 w-4 ${isDeletingChatHistory ? 'animate-spin' : ''}`} />
                  <span>{isDeletingChatHistory ? 'Clearing...' : 'Clear Chat'}</span>
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
            <div className="p-8 border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center bg-transparent">
                    {isGenerating
                      ? <Loader2 className="w-10 h-10 animate-spin font-normal text-gray-900 dark:text-slate-100" />
                      : <span className="text-[40px] leading-none">{notebook?.icon || '☕'}</span>}
                  </div>
                  <div>
                    <h1 className="text-2xl font-medium text-gray-900 dark:text-slate-100">
                      {isGenerating ? 'Generating content...' : notebook?.title || 'Untitled Notebook'}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="mb-6 rounded-lg bg-gray-50 p-6 dark:bg-slate-800/70">
                  {isGenerating
                    ? <div className="flex items-center space-x-2 text-gray-600 dark:text-slate-400"><p>AI is analyzing your source and generating a title and description...</p></div>
                    : <MarkdownRenderer content={notebook?.description || 'No description available for this notebook.'} className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-slate-200 leading-relaxed" />}
                </div>

                {(messages.length > 0 || pendingUserMessage || showAiLoading) && (
                  <div className="mb-6 space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${isUserMessage(msg) ? 'justify-end' : 'justify-start'}`}>
                        <div className={`${isUserMessage(msg) ? 'max-w-xs lg:max-w-md px-4 py-2 bg-blue-500 text-white rounded-lg' : 'w-full'}`}>
                          <div className={isUserMessage(msg) ? '' : 'prose prose-gray dark:prose-invert max-w-none text-gray-800 dark:text-slate-100'}>
                            <MarkdownRenderer content={msg.message.content} className={isUserMessage(msg) ? '' : ''} onCitationClick={handleCitationClick} isUserMessage={isUserMessage(msg)} />
                          </div>
                          {isAiMessage(msg) && (
                            <div className="mt-2 flex justify-start">
                              <SaveToNoteButton content={msg.message.content} notebookId={notebookId} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {pendingUserMessage && (
                      <div className="flex justify-end">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 bg-blue-500 text-white rounded-lg">
                          <MarkdownRenderer content={pendingUserMessage} className="" isUserMessage={true} />
                        </div>
                      </div>
                    )}

                    {showAiLoading && (
                      <div className="flex justify-start" ref={latestMessageRef}>
                        <div className="flex items-center space-x-2 rounded-lg bg-gray-100 px-4 py-3 dark:bg-slate-800">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-slate-400"></div>
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-slate-400" style={{ animationDelay: '0.1s' }}></div>
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-slate-400" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    )}

                    {!showAiLoading && shouldShowScrollTarget() && <div ref={latestMessageRef} />}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Chat Input - Fixed at bottom */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleSpeechInput}
                  disabled={isChatDisabled || isSending || !!pendingUserMessage || isVoiceRoomActive}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                >
                  {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <div className="flex-1 relative">
                  <Input
                    placeholder={getPlaceholderText()}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isChatDisabled && !isSending && !pendingUserMessage && handleSendMessage()}
                    className="pr-12"
                    disabled={isChatDisabled || isSending || !!pendingUserMessage || isVoiceRoomActive}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-slate-400">
                    {sourceCount} source{sourceCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button onClick={() => handleSendMessage()} disabled={!message.trim() || isChatDisabled || isSending || !!pendingUserMessage}>
                  {isSending || pendingUserMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {isListening && <p className="mt-2 text-xs text-[var(--color-sage)]">Listening... speak now to fill the input.</p>}
              {speechError && <p className="mt-2 text-xs text-red-600">{speechError}</p>}

              {/* Follow-up / example questions */}
              {!isChatDisabled && !pendingUserMessage && !showAiLoading && (
                <div className="mt-4 min-h-[44px]">
                  {showQuestionsSkeleton ? (
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-gray-400 dark:text-slate-400 animate-pulse flex-shrink-0" />
                      <div className="flex gap-2">
                        <div className="h-8 w-36 bg-gray-100 dark:bg-slate-800 rounded-md animate-pulse" />
                        <div className="h-8 w-44 bg-gray-100 dark:bg-slate-800 rounded-md animate-pulse" />
                        <div className="h-8 w-32 bg-gray-100 dark:bg-slate-800 rounded-md animate-pulse" />
                      </div>
                    </div>
                  ) : questionsToShow.length > 0 ? (
                    <div className="flex items-start gap-2">
                      {hasConversation && <Sparkles className="h-3 w-3 text-blue-400 mt-2.5 flex-shrink-0" />}
                      <Carousel className="w-full max-w-4xl">
                        <CarouselContent className="-ml-2 md:-ml-4">
                          {questionsToShow.map((question, index) => (
                            <CarouselItem key={index} className="pl-2 md:pl-4 basis-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-left whitespace-nowrap h-auto py-2 px-3 text-sm"
                                onClick={() => hasConversation ? handleContextualQuestionClick(question) : handleExampleQuestionClick(question)}
                              >
                                {question}
                              </Button>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        {questionsToShow.length > 2 && (
                          <>
                            <CarouselPrevious className="left-0" />
                            <CarouselNext className="right-0" />
                          </>
                        )}
                      </Carousel>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        // Empty State
        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
              <Upload className="h-8 w-8 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="mb-4 text-xl font-medium text-gray-900 dark:text-slate-100">Add a source to get started</h2>
            <Button onClick={() => setShowAddSourcesDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload a source
            </Button>
          </div>
          <div className="w-full max-w-2xl">
            <div className="flex space-x-4">
              <Input placeholder="Upload a source to get started" disabled className="flex-1" />
              <div className="flex items-center text-sm text-gray-500 dark:text-slate-400">0 sources</div>
              <Button disabled><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <p className="text-center text-sm text-gray-500 dark:text-slate-400">Vani can be inaccurate; please double-check its responses and citations.</p>
      </div>

      <AddSourcesDialog open={showAddSourcesDialog} onOpenChange={setShowAddSourcesDialog} notebookId={notebookId} />
    </div>
  );
};

export default ChatArea;
