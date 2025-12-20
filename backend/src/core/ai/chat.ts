/**
 * AI Chat Service
 * Main chatbot service using OpenAI with function calling
 */

import OpenAI from "openai";
import { ChatMessage, ChatRequest, ChatResponse, ChatContext } from "./types";
import { getOpenAIFunctions } from "./functions";
import { FunctionExecutor } from "./executor";
import { logger } from "../../utils/logger";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Rate limiting (simple in-memory)
const userRateLimits: Map<string, { count: number; resetAt: number }> = new Map();
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export class ChatService {
  private openai: OpenAI | null = null;
  private executor: FunctionExecutor;

  constructor(store: any, services: any = {}) {
    if (OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    }
    this.executor = new FunctionExecutor(store, services);
  }

  /**
   * Check if chat is configured
   */
  isConfigured(): boolean {
    return this.openai !== null;
  }

  /**
   * Check rate limit for a user
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = userRateLimits.get(userId);

    if (!userLimit || userLimit.resetAt < now) {
      userRateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }

    if (userLimit.count >= RATE_LIMIT_REQUESTS) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  /**
   * Process a chat message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.openai) {
      return {
        success: false,
        message: "",
        error: "AI chatbot not configured. Please set OPENAI_API_KEY."
      };
    }

    const { message, context, history = [] } = request;

    // Check rate limit
    if (!this.checkRateLimit(context.userId)) {
      return {
        success: false,
        message: "",
        error: "Rate limit exceeded. Please try again later."
      };
    }

    try {
      // Build system message with context
      const systemMessage = this.buildSystemMessage(context);

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemMessage },
        ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: message }
      ];

      // Call OpenAI with function calling
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: getOpenAIFunctions(),
        tool_choice: "auto",
        max_tokens: 1000,
        temperature: 0.7
      });

      const choice = response.choices[0];
      
      if (!choice) {
        return { success: false, message: "", error: "No response from AI" };
      }

      // Check if AI wants to call a function
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        return await this.handleFunctionCalls(
          choice.message.tool_calls,
          messages,
          context
        );
      }

      // Regular text response
      return {
        success: true,
        message: choice.message.content || "I'm not sure how to respond to that."
      };

    } catch (error: any) {
      logger.error("Chat error", { error: error.message, userId: context.userId });
      return {
        success: false,
        message: "",
        error: `Error processing request: ${error.message}`
      };
    }
  }

  /**
   * Handle function calls from the AI
   */
  private async handleFunctionCalls(
    toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    context: ChatContext
  ): Promise<ChatResponse> {
    const functionResults: { tool_call_id: string; output: string }[] = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await this.executor.execute(
          { name: toolCall.function.name, arguments: args },
          context
        );
        functionResults.push({
          tool_call_id: toolCall.id,
          output: result
        });
      }
    }

    // Send function results back to AI for final response
    const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: "assistant",
        content: null,
        tool_calls: toolCalls
      },
      ...functionResults.map(fr => ({
        role: "tool" as const,
        tool_call_id: fr.tool_call_id,
        content: fr.output
      }))
    ];

    try {
      const followUp = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: followUpMessages,
        max_tokens: 1000,
        temperature: 0.7
      });

      const finalResponse = followUp.choices[0]?.message?.content || "Here's what I found.";
      
      return {
        success: true,
        message: finalResponse,
        action: {
          type: "function_executed",
          data: functionResults.map(fr => fr.output)
        }
      };

    } catch (error: any) {
      logger.error("Function follow-up error", { error: error.message });
      // Return the raw function results if AI follow-up fails
      return {
        success: true,
        message: functionResults.map(fr => fr.output).join("\n\n")
      };
    }
  }

  /**
   * Build system message with user context
   */
  private buildSystemMessage(context: ChatContext): string {
    return `You are a helpful financial assistant for a crypto-aware accounting application.

User Context:
- Organization ID: ${context.orgId}
- User Roles: ${context.userRoles.join(", ")}
- Current Page: ${context.currentPage || "Unknown"}

Your capabilities:
- Answer accounting and financial questions
- Query account balances and transactions
- List and analyze invoices
- Explain financial reports and ratios
- Help with crypto transaction tracking
- Suggest account mappings for transactions
- Calculate financial ratios

Guidelines:
- Be concise and professional
- Use specific numbers when querying data
- Explain accounting concepts simply
- If you need to query data, use the available functions
- Always format currency with $ and 2 decimal places
- If you're unsure, say so rather than guessing

The user may ask about:
- Account balances and transactions
- Invoice status and overdue payments
- Financial summaries and reports
- Cryptocurrency holdings
- How to record specific transactions`;
  }

  /**
   * Get suggested prompts for the user
   */
  getSuggestedPrompts(): string[] {
    return [
      "What's my current cash balance?",
      "Show me overdue invoices",
      "What's my profit margin this month?",
      "Explain my balance sheet",
      "What crypto do I hold?",
      "How do I record a token swap?",
      "What's my accounts receivable?",
      "Calculate my current ratio"
    ];
  }
}
