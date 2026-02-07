import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagingApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';

interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'ai' | 'staff';
  senderName: string | null;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  status: 'active' | 'closed';
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export function MessagingPage() {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Poll interval ref
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
      // Auto-open the most recent active conversation
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
    }
    setIsLoadingMessages(false);
  }, []);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for new messages every 5 seconds
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

  const handleStartConversation = async () => {
    setIsCreating(true);
    setError(null);
    const { data, error: createErr } = await messagingApi.startConversation();
    if (createErr) {
      setError(createErr);
    } else if (data) {
      const convo = (data as any).conversation || data;
      setActiveConversationId(convo.id);
      setMessages([]);
      fetchConversations();
    }
    setIsCreating(false);
  };

  const handleSendMessage = async () => {
    if (!activeConversationId || !messageInput.trim() || isSending) return;
    const content = messageInput.trim();
    setMessageInput('');
    setIsSending(true);
    setIsAiTyping(true);

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      senderType: 'customer',
      senderName: customer?.first_name || null,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    const { error: sendErr } = await messagingApi.sendMessage(activeConversationId, content);
    if (sendErr) {
      setError(sendErr);
      setIsAiTyping(false);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } else {
      // Fetch fresh messages to get server response
      const { data } = await messagingApi.getMessages(activeConversationId);
      if (data) {
        const msgs = Array.isArray(data) ? data : (data as any).messages || [];
        setMessages(msgs);
        setIsAiTyping(false);
      }
    }
    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  // Group messages by date
  const groupedMessages = messages.reduce<Record<string, Message[]>>((groups, msg) => {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  const getSenderIcon = (senderType: string) => {
    if (senderType === 'ai') {
      return (
        <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    if (senderType === 'staff') {
      return (
        <div className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
    }
    return null;
  };

  // No conversation selected / conversation list view
  if (!activeConversationId && !isLoadingConversations) {
    return (
      <div className="min-h-screen bg-brand-warm-white flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm flex-shrink-0">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="font-heading text-xl font-bold text-brand-navy">Messages</h1>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setActiveConversationId(convo.id)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow min-h-[64px] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${convo.status === 'active' ? 'bg-brand-teal' : 'bg-gray-300'}`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-brand-navy">
                        {convo.status === 'active' ? 'Active Conversation' : 'Closed Conversation'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {convo.lastMessageAt ? formatDate(convo.lastMessageAt) : 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  {convo.unreadCount > 0 && (
                    <span className="bg-brand-coral text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {convo.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-brand-cream rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-brand-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold text-brand-navy mb-2">No conversations yet</h3>
              <p className="text-gray-500 text-sm mb-6">Start a conversation with us! Our AI assistant is here to help 24/7.</p>
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={handleStartConversation}
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
    <div className="h-[100dvh] bg-brand-warm-white flex flex-col">
      {/* Chat Header */}
      <header className="bg-white shadow-sm flex-shrink-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (conversations.length > 1) {
                setActiveConversationId(null);
              } else {
                navigate('/dashboard');
              }
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-lg font-bold text-brand-navy">Happy Tail Happy Dog</h1>
            <p className="text-xs text-gray-500">We typically respond within a few minutes</p>
          </div>
          <div className="w-3 h-3 bg-brand-soft-green rounded-full" title="Online" />
        </div>
      </header>

      {/* AI disclaimer */}
      <div className="bg-brand-cream border-b border-brand-light-gray px-4 py-2 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-gray-600">
          <svg className="w-4 h-4 text-brand-teal flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>Powered by AI assistant. A team member can join anytime.</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {isLoadingMessages ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-brand-teal" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Send a message to get started!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center justify-center mb-4">
                  <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                    {formatDate(dateMessages[0].createdAt)}
                  </span>
                </div>

                <div className="space-y-3">
                  {dateMessages.map((msg) => {
                    const isCustomer = msg.senderType === 'customer';
                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isCustomer && getSenderIcon(msg.senderType)}
                        <div className={`max-w-[80%] sm:max-w-[70%]`}>
                          {!isCustomer && msg.senderName && (
                            <p className="text-xs text-gray-500 mb-0.5 ml-1">
                              {msg.senderName}
                              {msg.senderType === 'ai' && (
                                <span className="ml-1 text-brand-teal">(AI)</span>
                              )}
                            </p>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isCustomer
                                ? 'bg-brand-teal text-white rounded-br-md'
                                : 'bg-white text-gray-800 shadow-sm rounded-bl-md border border-gray-100'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <p className={`text-xs mt-1 ${isCustomer ? 'text-right' : 'text-left'} text-gray-400`}>
                            {formatTime(msg.createdAt)}
                          </p>
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
              <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-brand-light-gray px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px] max-h-[120px]"
            style={{ overflow: 'auto' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${
              messageInput.trim() && !isSending
                ? 'bg-brand-teal text-white hover:bg-brand-teal-dark'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSending ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

