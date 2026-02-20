export interface AimChatInput {
  staffUserId: string;
  message: string;
  conversationId?: string; // null = new conversation
}

export interface AimChatOutput {
  responseText: string;
  conversationId: string;
  toolsUsed: string[];
  modelUsed: string;
}

export interface AimAlertData {
  type: 'staffing_gap' | 'capacity_warning' | 'compliance' | 'booking_spike';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}
