import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { adminAimApi } from '../lib/api';

export type AimTab = 'chat' | 'activity' | 'alerts';

interface AimContextType {
  isOpen: boolean;
  activeTab: AimTab;
  unreadAlertCount: number;
  currentConversationId: string | null;
  pendingPrompt: string | null;
  openAim: (tab?: AimTab) => void;
  closeAim: () => void;
  askAim: (prompt: string) => void;
  setActiveTab: (tab: AimTab) => void;
  setCurrentConversationId: (id: string | null) => void;
  refreshAlertCount: () => void;
  consumePendingPrompt: () => string | null;
}

const AimContext = createContext<AimContextType | null>(null);

export function AimProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AimTab>('chat');
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAlertCount = useCallback(async () => {
    const result = await adminAimApi.getAlerts(true);
    if (result.data) {
      setUnreadAlertCount(result.data.alerts?.length ?? 0);
    }
  }, []);

  // Poll for unread alerts every 60s
  useEffect(() => {
    refreshAlertCount();
    intervalRef.current = setInterval(refreshAlertCount, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshAlertCount]);

  const openAim = useCallback((tab?: AimTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeAim = useCallback(() => {
    setIsOpen(false);
  }, []);

  const askAim = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setActiveTab('chat');
    setIsOpen(true);
  }, []);

  const consumePendingPrompt = useCallback(() => {
    const prompt = pendingPrompt;
    setPendingPrompt(null);
    return prompt;
  }, [pendingPrompt]);

  return (
    <AimContext.Provider
      value={{
        isOpen,
        activeTab,
        unreadAlertCount,
        currentConversationId,
        pendingPrompt,
        openAim,
        closeAim,
        askAim,
        setActiveTab,
        setCurrentConversationId,
        refreshAlertCount,
        consumePendingPrompt,
      }}
    >
      {children}
    </AimContext.Provider>
  );
}

export function useAim() {
  const context = useContext(AimContext);
  if (!context) {
    throw new Error('useAim must be used within an AimProvider');
  }
  return context;
}
