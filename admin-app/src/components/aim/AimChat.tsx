import { useState, useEffect, useRef, useCallback } from 'react';
import { useAim } from '../../contexts/AimContext';
import { adminAimApi } from '../../lib/api';
import type { AimConversationDetail } from '../../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolsUsed?: string[];
}

const QUICK_PROMPTS = [
  "How's today looking?",
  'Any compliance issues?',
  "Who's working tomorrow?",
];

function formatToolLabel(tool: string): string {
  const labels: Record<string, string> = {
    get_todays_schedule: 'Checking schedule...',
    search_customers: 'Searching customers...',
    get_facility_status: 'Checking facility...',
    get_staff_schedule: 'Checking staff...',
    get_compliance: 'Reviewing compliance...',
  };
  return labels[tool] ?? `Using ${tool}...`;
}

export function AimChat() {
  const { currentConversationId, setCurrentConversationId, consumePendingPrompt, pendingPrompt } = useAim();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolStatus]);

  // Load conversation history
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setInitialLoading(true);
    adminAimApi.getConversation(currentConversationId).then((result) => {
      if (cancelled) return;
      if (result.data) {
        const detail = result.data as AimConversationDetail;
        setMessages(
          (detail.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      }
      setInitialLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentConversationId]);

  // Handle pending prompt from askAim()
  useEffect(() => {
    if (pendingPrompt) {
      const prompt = consumePendingPrompt();
      if (prompt) {
        sendMessage(prompt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setToolStatus('Thinking...');

    const result = await adminAimApi.chat(text.trim(), currentConversationId ?? undefined);

    if (result.data) {
      const { responseText, conversationId, toolsUsed } = result.data;

      if (conversationId && conversationId !== currentConversationId) {
        setCurrentConversationId(conversationId);
      }

      // Show tool usage briefly
      if (toolsUsed?.length) {
        for (const tool of toolsUsed) {
          setToolStatus(formatToolLabel(tool));
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      const assistantMsg: ChatMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        createdAt: new Date().toISOString(),
        toolsUsed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: result.error ?? 'Something went wrong. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
    setToolStatus(null);
    textareaRef.current?.focus();
  }, [isLoading, currentConversationId, setCurrentConversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInput('');
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header actions */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-end">
        <button
          onClick={startNewConversation}
          className="text-xs text-[#4F8BA8] hover:text-[#1B365D] font-medium transition-colors min-h-[32px] px-2"
        >
          + New Chat
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1B365D]/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#1B365D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#1B365D] mb-1">Hi! I'm AIM</p>
            <p className="text-xs text-gray-500">Your AI facility manager. Ask me anything about today's operations.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[90%] ${
                msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start'
              }`}
            >
              <div
                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#1B365D] text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}

        {/* Tool usage / typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 max-w-[90%]">
            <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-100 text-gray-500 text-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {toolStatus && <span className="text-xs italic">{toolStatus}</span>}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && !isLoading && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#62A2C3]/10 text-[#4F8BA8] hover:bg-[#62A2C3]/20 transition-colors min-h-[32px]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AIM anything..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3]/30 focus:border-[#62A2C3] min-h-[44px] disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1B365D] text-white hover:bg-[#1B365D]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
