import { Request, Response, NextFunction } from "express";
import { verifyHmacSha256 } from "../utils/crypto";
import { config } from "../config";

export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers["x-webhook-signature"];
  if (!sig || typeof sig !== "string") return res.status(401).json({ error: "Missing signature" });
  const payload = JSON.stringify(req.body || {});
  const ok = verifyHmacSha256(config.webhookSecret, payload, sig);
  if (!ok) return res.status(401).json({ error: "Invalid signature" });
  next();
};





