import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagingApi, customerApi } from '../lib/api';
import type { Dog } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import { BottomNav } from '../components/BottomNav';

interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'ai' | 'staff';
  senderName: string | null;
  content: string;
  createdAt: string;
  readAt?: string | null;
  photoUrl?: string | null;
}

interface Conversation {
  id: string;
  status: 'active' | 'closed';
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  dogId?: string | null;
  dogName?: string | null;
}

const QUICK_REPLIES = [
  { id: 'hours', text: 'What are your hours?', icon: '🕐' },
  { id: 'booking', text: 'I need to reschedule', icon: '📅' },
  { id: 'pickup', text: 'When can I pick up?', icon: '🏠' },
  { id: 'update', text: "How's my dog doing?", icon: '🐾' },
  { id: 'pricing', text: 'Grooming pricing?', icon: '✂️' },
];

export function MessagingPage() {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchConversations = useCallback(async () => {
    const { data, error: fetchErr } = await messagingApi.getConversations();
    if (fetchErr) {
      setError(fetchErr);
    } else if (data) {
      const convos = Array.isArray(data) ? data : (data as any).conversations || [];
      setConversations(convos);
      const active = convos.find((c: Conversation) => c.status === 'active');
      if (active && !activeConversationId) {
        setActiveConversationId(active.id);
      }
    }
    setIsLoadingConversations(false);
  }, [activeConversationId]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    const { data, error: fetchErr } = await messagingApi.getMessages(conversationId);
    if (fetchErr) {
      setError(fetchErr);
    } else if (data) {
      const msgs = Array.isArray(data) ? data : (data as any).messages || [];
      setMessages(msgs);
      if (msgs.length > 0) setShowQuickReplies(false);
    }
    setIsLoadingMessages(false);
  }, []);

  useEffect(() => {
    fetchConversations();
    customerApi.getDogs().then(({ data }) => {
      if (data) setDogs(data.dogs);
    });
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (activeConversationId) {
      pollRef.current = setInterval(async () => {
        const { data } = await messagingApi.getMessages(activeConversationId);
        if (data) {
          const msgs = Array.isArray(data) ? data : (data as any).messages || [];
          setMessages((prev) => {
            if (msgs.length !== prev.length) {
              setIsAiTyping(false);
              return msgs;
            }
            return prev;
          });
        }
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConversationId]);

  const handleStartConversation = async (dogId?: string) => {
    setIsCreating(true);
    setError(null);
    const { data, error: createErr } = await messagingApi.startConversation(dogId);
    if (createErr) {
      setError(createErr);
    } else if (data) {
      const convo = (data as any).conversation || data;
      setActiveConversationId(convo.id);
      setMessages([]);
      setShowQuickReplies(true);
      fetchConversations();
    }
    setIsCreating(false);
  };

  const handleSendMessage = async (content?: string) => {
    const text = content || messageInput.trim();
    if (!activeConversationId || !text || isSending) return;
    setMessageInput('');
    setIsSending(true);
    setIsAiTyping(true);
    setShowQuickReplies(false);

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      senderType: 'customer',
      senderName: customer?.first_name || null,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    const { error: sendErr } = await messagingApi.sendMessage(activeConversationId, text);
    if (sendErr) {
      setError(sendErr);
      setIsAiTyping(false);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } else {
      const { data } = await messagingApi.getMessages(activeConversationId);
      if (data) {
        const msgs = Array.isArray(data) ? data : (data as any).messages || [];
        setMessages(msgs);
        setIsAiTyping(false);
      }
    }
    setIsSending(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupedMessages = messages.reduce<Record<string, Message[]>>((groups, msg) => {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  const getSenderIcon = (senderType: string) => {
    if (senderType === 'ai') {
      return (
        <div className="w-8 h-8 rounded-full bg-brand-sage flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    if (senderType === 'staff') {
      return (
        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
    }
    return null;
  };

  // Conversation list view
  if (!activeConversationId && !isLoadingConversations) {
    return (
      <div className="min-h-[100dvh] bg-brand-cream flex flex-col">
        <header className="bg-white/80 backdrop-blur-lg border-b border-brand-sand/50 flex-shrink-0">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-brand-sand transition-colors">
              <svg className="w-5 h-5 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="font-heading text-lg font-semibold text-brand-forest">Messages</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 flex-1 w-full">
          {error && (
            <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/20 rounded-2xl text-brand-error text-sm">{error}</div>
          )}

          {/* Pet-specific thread starters */}
          {dogs.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-brand-forest-muted mb-3">Start a conversation about...</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {dogs.map((dog) => (
                  <button
                    key={dog.id}
                    onClick={() => handleStartConversation(dog.id)}
                    disabled={isCreating}
                    className="flex flex-col items-center gap-1.5 min-w-[72px] p-3 bg-white rounded-2xl shadow-warm-sm border border-brand-sand/50 hover:shadow-warm transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-sage/10 flex items-center justify-center">
                      <span className="font-pet font-bold text-brand-sage text-lg">{dog.name.charAt(0)}</span>
                    </div>
                    <span className="font-pet text-xs font-semibold text-brand-forest truncate max-w-[64px]">{dog.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setActiveConversationId(convo.id)}
                  className="w-full bg-white rounded-2xl shadow-warm-sm p-4 text-left hover:shadow-warm transition-all min-h-[64px] flex items-center justify-between border border-brand-sand/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${convo.status === 'active' ? 'bg-brand-sage/10' : 'bg-brand-sand'}`}>
                      {convo.dogName ? (
                        <span className="font-pet font-bold text-brand-sage">{convo.dogName.charAt(0)}</span>
                      ) : (
                        <svg className={`w-5 h-5 ${convo.status === 'active' ? 'text-brand-sage' : 'text-brand-forest-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-brand-forest text-sm">
                        {convo.dogName ? `About ${convo.dogName}` : convo.status === 'active' ? 'Active Conversation' : 'Closed Conversation'}
                      </p>
                      <p className="text-xs text-brand-forest-muted">
                        {convo.lastMessageAt ? formatDate(convo.lastMessageAt) : 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  {convo.unreadCount > 0 && (
                    <span className="bg-brand-primary text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {convo.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-brand-sage/10 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-brand-forest mb-2">No conversations yet</h3>
              <p className="text-brand-forest-muted text-sm mb-6">Our AI assistant is here to help 24/7</p>
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={() => handleStartConversation()}
              isLoading={isCreating}
              className="w-full"
            >
              Start New Conversation
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-brand-cream overflow-hidden">
      {/* Chat Header */}
      <header className="bg-white/90 backdrop-blur-lg border-b border-brand-sand/50 flex-shrink-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (conversations.length > 1) {
                setActiveConversationId(null);
              } else {
                navigate('/dashboard');
              }
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-brand-sand transition-colors"
          >
            <svg className="w-5 h-5 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-lg font-semibold text-brand-forest">Happy Tail Happy Dog</h1>
            <p className="text-xs text-brand-forest-muted">AI Assistant + Staff Support</p>
          </div>
          <div className="w-3 h-3 bg-brand-success rounded-full" title="Online" />
        </div>
      </header>

      {/* Privacy notice */}
      <div className="bg-brand-sage/5 border-b border-brand-sand/30 px-4 py-2 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center gap-2 text-xs text-brand-forest-muted">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>Messages in this chat are visible to Happy Tail staff. Please don't share sensitive personal information like passwords or payment details.</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">
          {isLoadingMessages ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-brand-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-brand-forest-muted">
              <p className="text-sm">Send a message to get started!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
              <div key={dateKey}>
                <div className="flex items-center justify-center mb-4">
                  <span className="bg-brand-sand text-brand-forest-muted text-xs px-3 py-1 rounded-full font-medium">
                    {formatDate(dateMessages[0].createdAt)}
                  </span>
                </div>

                <div className="space-y-3">
                  {dateMessages.map((msg) => {
                    const isCustomer = msg.senderType === 'customer';
                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isCustomer && getSenderIcon(msg.senderType)}
                        <div className="max-w-[80%]">
                          {!isCustomer && (
                            <p className="text-xs text-brand-forest-muted mb-0.5 ml-1">
                              {msg.senderType === 'ai'
                                ? (msg.senderName || 'HTHD Assistant')
                                : msg.senderName}
                              {msg.senderType === 'ai' && (
                                <span className="ml-1 text-brand-sage">(AI)</span>
                              )}
                            </p>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isCustomer
                                ? 'bg-brand-primary text-white rounded-br-md'
                                : 'bg-white text-brand-forest shadow-warm-sm rounded-bl-md border border-brand-sand/30'
                            }`}
                          >
                            {msg.photoUrl && (
                              <img src={msg.photoUrl} alt="" className="rounded-xl mb-2 max-w-full" />
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                            <p className="text-xs text-brand-forest-muted">{formatTime(msg.createdAt)}</p>
                            {isCustomer && msg.readAt && (
                              <svg className="w-3.5 h-3.5 text-brand-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* AI typing indicator */}
          {isAiTyping && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-sage flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-warm-sm border border-brand-sand/30">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-brand-forest-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-brand-forest-muted/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-brand-forest-muted/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Replies */}
      {showQuickReplies && messages.length <= 4 && (
        <div className="bg-white/80 backdrop-blur-sm border-t border-brand-sand/30 px-4 py-3 flex-shrink-0">
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-brand-forest-muted mb-2 font-medium">Quick replies</p>
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {QUICK_REPLIES.map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => handleSendMessage(qr.text)}
                    disabled={isSending}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full border border-brand-sand bg-white text-xs font-medium text-brand-forest hover:border-brand-primary hover:text-brand-primary transition-colors min-h-[36px]"
                  >
                    <span>{qr.icon}</span>
                    {qr.text}
                  </button>
                ))}
              </div>
              {/* Right-edge fade gradient to indicate scrollability */}
              <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white/80 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Error bar */}
      {error && (
        <div className="bg-brand-error/10 border-t border-brand-error/20 px-4 py-2 flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-sm text-brand-error">{error}</p>
            <button onClick={() => setError(null)} className="text-brand-error hover:text-brand-error min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-brand-sand/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-end gap-2 overflow-hidden">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            autoComplete="off"
            autoFocus
            className="flex-1 min-w-0 w-0 resize-none rounded-2xl border-2 border-brand-sand px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary min-h-[44px] max-h-[120px] bg-brand-cream/50 placeholder-brand-forest-muted transition-all"
            style={{ overflow: 'auto' }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!messageInput.trim() || isSending}
            className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
              messageInput.trim() && !isSending
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-warm'
                : 'bg-brand-sand text-brand-forest-muted cursor-not-allowed'
            }`}
          >
            {isSending ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
