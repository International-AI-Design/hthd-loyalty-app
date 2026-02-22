import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagingApi, customerApi } from '../lib/api';
import type { Dog } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';

// ─── Inject puppy keyframes once ──────────────────────────────────────────────
const ANIM_CSS = `
  @keyframes messagePop {
    0%   { transform: scale(0.8) translateY(12px); opacity: 0; }
    60%  { transform: scale(1.04) translateY(-2px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes pawBounce {
    0%, 100% { transform: translateY(0) scale(1) rotate(-6deg); opacity: .5; }
    50%      { transform: translateY(-9px) scale(1.25) rotate(10deg); opacity: 1; }
  }
  @keyframes dogWiggle {
    0%, 100% { transform: rotate(-12deg); }
    50%      { transform: rotate(12deg); }
  }
  @keyframes floatAway {
    0%   { transform: translateY(0) scale(1);    opacity: 1; }
    100% { transform: translateY(-40px) scale(.4); opacity: 0; }
  }
  @keyframes boneFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-6px) rotate(180deg); }
  }
  @keyframes softPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .6; transform: scale(.85); }
  }
  @keyframes slideInRight {
    0%   { transform: translateX(16px); opacity: 0; }
    100% { transform: translateX(0);    opacity: 1; }
  }
  @keyframes slideInLeft {
    0%   { transform: translateX(-16px); opacity: 0; }
    100% { transform: translateX(0);     opacity: 1; }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('hthd-anim')) {
  const el = document.createElement('style');
  el.id = 'hthd-anim';
  el.textContent = ANIM_CSS;
  document.head.appendChild(el);
}

// ─── Puppy thinking messages ───────────────────────────────────────────────────
const THINKING_MESSAGES = [
  'Sniffing for answers…',
  'Chasing that thought!',
  'Fetching it now…',
  'Tail is wagging…',
  'Hot on the scent!',
  'Almost got it…',
  'Digging it up!',
  'Woof, just a sec!',
];

// ─── Animated thinking indicator ──────────────────────────────────────────────
function PuppyThinking() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % THINKING_MESSAGES.length);
        setVisible(true);
      }, 340);
    }, 2700);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex justify-start gap-2 items-end"
      style={{ animation: 'messagePop .4s cubic-bezier(.34,1.56,.64,1)' }}
    >
      {/* Wiggling dog avatar */}
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0 text-base border border-amber-200/70 shadow-sm select-none"
        style={{ animation: 'dogWiggle 2s ease-in-out infinite' }}
        title="HTHD AI is thinking"
      >
        🐕
      </div>

      {/* Bubble */}
      <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-warm-sm border border-brand-sand/30 min-w-[160px]">
        {/* Bouncing paw prints */}
        <div className="flex gap-2 mb-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: 14,
                animation: `pawBounce 1.15s ease-in-out ${i * 0.22}s infinite`,
              }}
            >
              🐾
            </span>
          ))}
        </div>

        {/* Cycling thought text */}
        <p
          className="text-xs text-brand-forest-muted leading-snug font-medium"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(3px)',
            transition: 'opacity .28s ease, transform .28s ease',
          }}
        >
          {THINKING_MESSAGES[idx]}
        </p>
      </div>
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
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

/**
 * Normalize server `role` field to component `senderType`.
 */
function normalizeMessage(raw: Record<string, any>): Message {
  if (raw.senderType) return raw as Message;
  const role: string = raw.role ?? '';
  let senderType: Message['senderType'];
  let senderName: string | null = raw.senderName ?? raw.sender_name ?? null;

  if (role === 'customer') {
    senderType = 'customer';
  } else {
    senderType = 'ai';
    senderName = senderName || 'HTHD Assistant';
  }

  return {
    id: raw.id,
    conversationId: raw.conversationId ?? raw.conversation_id ?? '',
    senderType,
    senderName,
    content: raw.content ?? '',
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    readAt: raw.readAt ?? raw.read_at ?? null,
    photoUrl: raw.photoUrl ?? raw.photo_url ?? null,
  };
}

interface Conversation {
  id: string;
  status: 'active' | 'escalated' | 'closed';
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  dogId?: string | null;
  dogName?: string | null;
}

const QUICK_REPLIES = [
  { id: 'hours',   text: 'What are your hours?',  icon: '🕐' },
  { id: 'booking', text: 'I need to reschedule',   icon: '📅' },
  { id: 'pickup',  text: 'When can I pick up?',    icon: '🏠' },
  { id: 'update',  text: "How's my dog doing?",    icon: '🐾' },
  { id: 'pricing', text: 'Grooming pricing?',      icon: '✂️' },
];

// ─── Main component ────────────────────────────────────────────────────────────
export function MessagingPage() {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [conversations, setConversations]           = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages]                     = useState<Message[]>([]);
  const [dogs, setDogs]                             = useState<Dog[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages]   = useState(false);
  const [isSending, setIsSending]                   = useState(false);
  const [isCreating, setIsCreating]                 = useState(false);
  const [messageInput, setMessageInput]             = useState('');
  const [error, setError]                           = useState<string | null>(null);
  const [isAiTyping, setIsAiTyping]                 = useState(false);
  const [showQuickReplies, setShowQuickReplies]     = useState(true);
  /** Float-away paw flair on send */
  const [sendFlair, setSendFlair]                   = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    const { data, error: fetchErr } = await messagingApi.getConversations();
    if (fetchErr) {
      setError(fetchErr);
    } else if (data) {
      const convos = Array.isArray(data) ? data : (data as any).conversations || [];
      setConversations(convos);
      const active = convos.find((c: Conversation) => c.status === 'active' || c.status === 'escalated');
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
      const rawMsgs = Array.isArray(data) ? data : (data as any).messages || [];
      const msgs = rawMsgs.map(normalizeMessage);
      setMessages(msgs);
      if (msgs.length > 0) setShowQuickReplies(false);
    }
    setIsLoadingMessages(false);
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────────
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

  // ── Polling: detect new messages, clear AI typing when response arrives ───────
  useEffect(() => {
    if (!activeConversationId) return;

    pollRef.current = setInterval(async () => {
      const { data } = await messagingApi.getMessages(activeConversationId);
      if (!data) return;

      const rawMsgs = Array.isArray(data) ? data : (data as any).messages || [];
      const msgs = rawMsgs.map(normalizeMessage);

      setMessages(prev => {
        // Compare real message count (excluding optimistic temp- messages)
        if (msgs.length !== prev.length) {
          // New messages arrived — AI responded or staff replied
          setIsAiTyping(false);
          return msgs;
        }
        return prev;
      });
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConversationId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
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

    // Trigger float-away paw flair
    setSendFlair(true);
    setTimeout(() => setSendFlair(false), 700);

    // Optimistic message
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      senderType: 'customer',
      senderName: customer?.first_name || null,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    // POST — server now returns immediately (AI runs in background)
    const { error: sendErr } = await messagingApi.sendMessage(activeConversationId, text);
    if (sendErr) {
      setError(sendErr);
      setIsAiTyping(false);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
    // On success: keep isAiTyping=true — polling clears it when AI message arrives

    setIsSending(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Formatters ───────────────────────────────────────────────────────────────
  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0 text-base border border-amber-200/60 shadow-sm select-none"
          style={{ animation: 'messagePop .35s cubic-bezier(.34,1.56,.64,1)' }}
        >
          🐕
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

  // ── Conversation list view ───────────────────────────────────────────────────
  if (!activeConversationId && !isLoadingConversations) {
    return (
      <div className="min-h-[100dvh] bg-brand-cream flex flex-col">
        <header className="bg-white/80 backdrop-blur-lg border-b border-brand-sand/50 flex-shrink-0">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-brand-sand transition-colors"
            >
              <svg className="w-5 h-5 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="font-heading text-lg font-semibold text-brand-forest">Messages</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 flex-1 w-full">
          {error && (
            <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/20 rounded-2xl text-brand-error text-sm">
              {error}
            </div>
          )}

          {/* Pet-specific thread starters */}
          {dogs.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-brand-forest-muted mb-3">Start a conversation about…</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {dogs.map(dog => (
                  <button
                    key={dog.id}
                    onClick={() => handleStartConversation(dog.id)}
                    disabled={isCreating}
                    className="flex flex-col items-center gap-1.5 min-w-[72px] p-3 bg-white rounded-2xl shadow-warm-sm border border-brand-sand/50 hover:shadow-warm transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-sage/10 flex items-center justify-center">
                      <span className="font-pet font-bold text-brand-sage text-lg">{dog.name.charAt(0)}</span>
                    </div>
                    <span className="font-pet text-xs font-semibold text-brand-forest truncate max-w-[64px]">
                      {dog.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map(convo => (
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
            <Button onClick={() => handleStartConversation()} isLoading={isCreating} className="w-full">
              Start New Conversation
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Chat view ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-brand-cream overflow-hidden">

      {/* ── Header ── */}
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

          {/* Avatar + title */}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-lg border border-amber-200/60 shadow-sm select-none"
                style={{ animation: isAiTyping ? 'dogWiggle 1.5s ease-in-out infinite' : 'none' }}
              >
                🐕
              </div>
              {/* Animated status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 flex items-center justify-center">
                <span
                  className="absolute inline-flex w-full h-full rounded-full bg-brand-success opacity-60"
                  style={{ animation: isAiTyping ? 'softPulse .9s ease-in-out infinite' : 'none' }}
                />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-success" />
              </span>
            </div>
            <div>
              <h1 className="font-heading text-base font-semibold text-brand-forest leading-none">Happy Tail Happy Dog</h1>
              <p className="text-[11px] text-brand-forest-muted mt-0.5">
                {isAiTyping ? (
                  <span className="text-brand-sage font-medium" style={{ animation: 'softPulse 1s ease-in-out infinite' }}>
                    🐾 Fetching a reply…
                  </span>
                ) : 'AI Assistant + Staff Support'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Privacy notice ── */}
      <div className="bg-brand-sage/5 border-b border-brand-sand/30 px-4 py-2 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center gap-2 text-xs text-brand-forest-muted">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>Messages are visible to Happy Tail staff. Don't share passwords or payment details.</span>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">

          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <span style={{ fontSize: 36, display: 'block', animation: 'boneFloat 1.4s ease-in-out infinite' }}>🦴</span>
              <p className="text-sm text-brand-forest-muted font-medium">Loading your messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-brand-forest-muted">Send a message to get started! 🐾</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center justify-center mb-4">
                  <span className="bg-brand-sand text-brand-forest-muted text-xs px-3 py-1 rounded-full font-medium">
                    {formatDate(dateMessages[0].createdAt)}
                  </span>
                </div>

                <div className="space-y-3">
                  {dateMessages.map((msg, msgIdx) => {
                    const isCustomer = msg.senderType === 'customer';
                    const isOptimistic = msg.id.startsWith('temp-');
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} gap-2`}
                        style={{
                          animation: `${isCustomer ? 'slideInRight' : 'messagePop'} .35s cubic-bezier(.34,1.56,.64,1) ${msgIdx * 0.04}s both`,
                        }}
                      >
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
                                ? `bg-brand-primary text-white rounded-br-md ${isOptimistic ? 'opacity-75' : ''}`
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

          {/* ── Puppy thinking indicator ── */}
          {isAiTyping && <PuppyThinking />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Quick replies ── */}
      {showQuickReplies && messages.length <= 4 && (
        <div className="bg-white/80 backdrop-blur-sm border-t border-brand-sand/30 px-4 py-3 flex-shrink-0">
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-brand-forest-muted mb-2 font-medium">🐾 Quick replies</p>
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={qr.id}
                    onClick={() => handleSendMessage(qr.text)}
                    disabled={isSending}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full border border-brand-sand bg-white text-xs font-medium text-brand-forest hover:border-brand-primary hover:text-brand-primary hover:scale-105 active:scale-95 transition-all min-h-[36px]"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span>{qr.icon}</span>
                    {qr.text}
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white/80 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── Error bar ── */}
      {error && (
        <div className="bg-brand-error/10 border-t border-brand-error/20 px-4 py-2 flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-sm text-brand-error">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-brand-error min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Message input ── */}
      <div className="bg-white border-t border-brand-sand/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-end gap-2 overflow-hidden">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            autoComplete="off"
            autoFocus
            className="flex-1 min-w-0 w-0 resize-none rounded-2xl border-2 border-brand-sand px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary min-h-[44px] max-h-[120px] bg-brand-cream/50 placeholder-brand-forest-muted transition-all"
            style={{ overflow: 'auto' }}
          />

          {/* Send button with float-away flair */}
          <div className="relative flex-shrink-0">
            {/* Float-away paw on send */}
            {sendFlair && (
              <span
                className="absolute -top-2 left-1/2 -translate-x-1/2 text-base pointer-events-none select-none"
                style={{ animation: 'floatAway .7s ease-out forwards' }}
              >
                🐾
              </span>
            )}

            <button
              onClick={() => handleSendMessage()}
              disabled={!messageInput.trim() || isSending}
              className={`w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                messageInput.trim() && !isSending
                  ? 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-warm'
                  : 'bg-brand-sand text-brand-forest-muted cursor-not-allowed'
              }`}
              style={isSending ? { animation: 'softPulse .8s ease-in-out infinite' } : undefined}
            >
              {isSending ? (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 20,
                    animation: 'pawBounce .7s ease-in-out infinite',
                  }}
                >
                  🐾
                </span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
