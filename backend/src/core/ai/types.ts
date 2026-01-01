/**
 * AI Chatbot Types
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatContext {
  userId: string;
  orgId: string;
  userRoles: string[];
  currentPage?: string;
}

export interface ChatRequest {
  message: string;
  context: ChatContext;
  history?: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  message: string;
  action?: {
    type: string;
    data: any;
  };
  error?: string;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}


