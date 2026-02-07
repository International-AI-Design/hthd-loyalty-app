export interface ConversationContext {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    pointsBalance: number;
  } | null;
  dogs: Array<{
    id: string;
    name: string;
    breed: string | null;
    sizeCategory: string | null;
    birthDate: Date | null;
  }>;
  upcomingBookings: Array<{
    id: string;
    date: Date;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
    serviceType: string;
    dogs: string[];
    totalCents: number;
  }>;
  walletBalance: number | null;
  recentMessages: Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
}

export interface OrchestratorInput {
  phoneNumber: string;
  messageBody: string;
  twilioSid?: string;
}

export interface OrchestratorOutput {
  responseText: string;
  conversationId: string;
  toolsUsed: string[];
  modelUsed: string;
}
