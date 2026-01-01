/**
 * Chat Routes
 * AI chatbot API endpoints
 */

import { Router } from "express";
import { z } from "zod";
import { ChatService } from "../core/ai";
import { AuthenticatedRequest } from "../middleware/auth";

export const buildChatRouter = (chatService: ChatService) => {
  const router = Router();

  // Check if chat is configured
  router.get("/status", (_req, res) => {
    res.json({ 
      configured: chatService.isConfigured(),
      suggestedPrompts: chatService.getSuggestedPrompts()
    });
  });

  // Send a chat message
  const chatSchema = z.object({
    message: z.string().min(1).max(2000),
    currentPage: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })).optional()
  });

  router.post("/message", async (req: AuthenticatedRequest, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const { message, currentPage, history } = parsed.data;
    const orgId = (req.body.orgId as string) || "demo-org";

    try {
      const response = await chatService.chat({
        message,
        context: {
          userId: req.user?.id || "anonymous",
          orgId,
          userRoles: req.user?.roles || ["viewer"],
          currentPage
        },
        history: history?.map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content
        }))
      });

      if (!response.success) {
        return res.status(400).json({ error: response.error });
      }

      res.json(response);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get suggested prompts
  router.get("/prompts", (_req, res) => {
    res.json({ prompts: chatService.getSuggestedPrompts() });
  });

  return router;
};


