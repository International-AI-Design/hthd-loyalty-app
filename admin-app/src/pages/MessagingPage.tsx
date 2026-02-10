import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminMessagingApi } from '../lib/api';

interface ConversationMessage {
  id: string;
  role: 'customer' | 'assistant';
  sender_name?: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  customer_name: string;
  dog_name?: string;
  status: 'active' | 'escalated' | 'closed';
  last_message: string;
  last_message_at: string;
  unread_count: number;
  assigned_to?: string;
  messages?: ConversationMessage[];
}

type FilterKey = 'all' | 'active' | 'escalated' | 'closed';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'closed', label: 'Closed' },
];

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function statusBadge(status: Conversation['status']) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Active' },
    escalated: { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Escalated' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Closed' },
  };
  const s = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
function senderBubbleStyle(role: ConversationMessage['role']) {
  switch (role) {
    case 'customer':
      return 'bg-gray-100 text-gray-900 self-start rounded-tl-sm';
    case 'assistant':
      return 'bg-[#1B365D] text-white self-end rounded-tr-sm';
    default:
      return 'bg-gray-100 text-gray-900 self-start';
  }
}

function senderLabel(role: ConversationMessage['role'], name?: string) {
  switch (role) {
    case 'assistant': return name || 'Staff / AI';
    default: return name || 'Customer';
  }
}

export function MessagingPage() {
  const { staff } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterParam = (searchParams.get('filter') ?? 'all') as FilterKey;
  const activeFilter = FILTER_TABS.some((t) => t.key === filterParam) ? filterParam : 'all';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Conversation | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mobileShowThread, setMobileShowThread] = useState(false);

  const fetchConversations = useCallback(async () => {
    const statusArg = activeFilter === 'all' ? undefined : activeFilter;
    const result = await adminMessagingApi.getConversations(statusArg);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      const raw = result.data.conversations ?? result.data ?? [];
      const mapped: Conversation[] = raw.map((conv: any) => ({
        id: conv.id,
        customer_name: conv.customer
          ? `${conv.customer.firstName ?? ''} ${conv.customer.lastName ?? ''}`.trim()
          : 'Unknown',
        dog_name: conv.dog_name ?? '',
        status: conv.status,
        last_message: conv.lastMessage?.content ?? '',
        last_message_at: conv.lastMessageAt ?? conv.createdAt ?? '',
        unread_count: conv.unread_count ?? 0,
        assigned_to: conv.assignedStaff
          ? `${conv.assignedStaff.firstName ?? ''} ${conv.assignedStaff.lastName ?? ''}`.trim()
          : undefined,
      }));
      setConversations(mapped);
      setError(null);
    }
    setIsLoading(false);
  }, [activeFilter]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const fetchThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    const result = await adminMessagingApi.getConversation(id);
    if (result.data) {
      const { conversation: conv, messages: msgs } = result.data;
      const mappedMessages: ConversationMessage[] = (msgs ?? []).map((m: any) => ({
        id: m.id,
        role: m.role === 'customer' ? 'customer' : 'assistant',
        sender_name: m.senderName ?? (m.role === 'customer'
          ? `${conv?.customer?.firstName ?? ''} ${conv?.customer?.lastName ?? ''}`.trim()
          : undefined),
        content: m.content,
        createdAt: m.createdAt,
      }));
      setThread({
        id: conv.id,
        customer_name: conv.customer
          ? `${conv.customer.firstName ?? ''} ${conv.customer.lastName ?? ''}`.trim()
          : 'Unknown',
        dog_name: conv.dog_name ?? '',
        status: conv.status,
        last_message: mappedMessages[mappedMessages.length - 1]?.content ?? '',
        last_message_at: conv.lastMessageAt ?? conv.createdAt ?? '',
        unread_count: 0,
        assigned_to: conv.assignedStaff
          ? `${conv.assignedStaff.firstName ?? ''} ${conv.assignedStaff.lastName ?? ''}`.trim()
          : undefined,
        messages: mappedMessages,
      });
    }
    setThreadLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchThread(selectedId);
      const interval = setInterval(() => fetchThread(selectedId), 5000);
      return () => clearInterval(interval);
    } else {
      setThread(null);
    }
  }, [selectedId, fetchThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  const handleFilterChange = (key: FilterKey) => {
    setSearchParams(key === 'all' ? {} : { filter: key });
    setSelectedId(null);
    setMobileShowThread(false);
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileShowThread(true);
  };

  const handleBack = () => {
    setMobileShowThread(false);
    setSelectedId(null);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    const result = await adminMessagingApi.sendMessage(selectedId, reply.trim());
    setSending(false);
    if (!result.error) {
      setReply('');
      fetchThread(selectedId);
      fetchConversations();
    }
  };

  const handleAssign = async () => {
    if (!selectedId) return;
    await adminMessagingApi.assignStaff(selectedId, staff?.id);
    fetchThread(selectedId);
    fetchConversations();
  };

  const handleEscalate = async () => {
    if (!selectedId) return;
    await adminMessagingApi.escalate(selectedId);
    fetchThread(selectedId);
    fetchConversations();
  };

  const listPanel = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <h2 className="font-heading text-xl font-bold text-[#1B365D]">Messages</h2>
      </div>

      <div className="px-4 pb-3 flex gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleFilterChange(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
              activeFilter === tab.key
                ? 'bg-[#1B365D] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-[#E8837B]/10 text-[#E8837B] text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No conversations found
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#F8F6F3] transition-colors min-h-[64px] ${
                selectedId === conv.id ? 'bg-[#62A2C3]/5 border-l-2 border-l-[#62A2C3]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[#1B365D] truncate">
                      {conv.customer_name}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#E8837B] text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.dog_name && (
                    <p className="text-xs text-gray-400 mt-0.5">{conv.dog_name}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 truncate">{conv.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{formatTime(conv.last_message_at)}</span>
                  {statusBadge(conv.status)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const threadPanel = (
    <div className="flex flex-col h-full">
      {thread ? (
        <>
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={handleBack}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-[#1B365D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-[#1B365D] truncate">{thread.customer_name}</h3>
              <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                {thread.dog_name && <span>{thread.dog_name}</span>}
                {statusBadge(thread.status)}
                {thread.assigned_to && (
                  <span className="text-gray-400">Assigned: {thread.assigned_to}</span>
                )}
              </p>
            </div>
            {thread.status !== 'closed' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAssign}
                  className="px-2.5 py-1.5 text-xs font-medium bg-[#62A2C3]/10 text-[#4F8BA8] rounded-lg hover:bg-[#62A2C3]/20 transition-colors min-h-[36px]"
                  title="Assign to me"
                >
                  Assign
                </button>
                {thread.status !== 'escalated' && (
                  <button
                    onClick={handleEscalate}
                    className="px-2.5 py-1.5 text-xs font-medium bg-[#E8837B]/10 text-[#E8837B] rounded-lg hover:bg-[#E8837B]/20 transition-colors min-h-[36px]"
                    title="Escalate"
                  >
                    Escalate
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {threadLoading && !thread.messages ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
              </div>
            ) : (
              (thread.messages ?? []).map((msg) => (
                <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'assistant' ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                  <span className="text-[10px] text-gray-400 mb-1 px-1">
                    {senderLabel(msg.role, msg.sender_name)}
                    {' · '}
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${senderBubbleStyle(msg.role)}`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {thread.status !== 'closed' && (
            <div className="px-4 py-3 bg-white border-t border-gray-100">
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Type a reply..."
                  rows={1}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#62A2C3]/30 focus:border-[#62A2C3] min-h-[44px]"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sending}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1B365D] text-white hover:bg-[#1B365D]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Select a conversation to view</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 7rem)' }}>
      <div className="hidden lg:flex h-full">
        <div className="w-[360px] border-r border-gray-100 flex-shrink-0 overflow-hidden">
          {listPanel}
        </div>
        <div className="flex-1 overflow-hidden">{threadPanel}</div>
      </div>

      <div className="lg:hidden h-full">
        {mobileShowThread ? threadPanel : listPanel}
      </div>
    </div>
  );
}

