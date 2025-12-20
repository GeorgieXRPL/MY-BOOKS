import { Router } from "express";
import multer from "multer";
import { InvoiceService } from "../core/invoices";
import { DbStore } from "../core/store.db";
import { OCRService, SUPPORTED_MIME_TYPES } from "../core/ocr";
import { newId } from "../utils/id";
import { AuthenticatedRequest } from "../middleware/auth";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

export const buildInvoicesRouter = (
  invoices: InvoiceService, 
  store: any,
  ocrService?: OCRService
) => {
  const router = Router();

  // List invoices
  router.get("/", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const type = req.query.type as "receivable" | "payable" | undefined;
      const status = req.query.status as any;
      const list = invoices.list(orgId, { type, status });
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single invoice
  router.get("/:id", (req, res) => {
    try {
      const invoice = invoices.get(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create invoice
  router.post("/", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const invoice = invoices.create({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update status
  router.patch("/:id/status", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { status } = req.body;
      const invoice = invoices.updateStatus(req.params.id, status, actorId);
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Mark paid
  router.post("/:id/pay", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { paidAmount } = req.body;
      const invoice = invoices.markPaid(req.params.id, paidAmount, actorId);
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Aging report
  router.get("/reports/aging", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const type = (req.query.type as "receivable" | "payable") || "receivable";
      const report = invoices.agingReport(orgId, type);
      res.json(report);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Counterparties
  router.get("/counterparties", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      res.json(store.listCounterparties(orgId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/counterparties", (req, res) => {
    try {
      const cp = store.addCounterparty({
        ...req.body,
        id: newId(),
        createdAt: new Date().toISOString()
      });
      res.status(201).json(cp);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ OCR ENDPOINTS ============

  // Get OCR status
  router.get("/ocr/status", (_req, res) => {
    if (!ocrService) {
      return res.json({ configured: false, storage: false, ocr: false });
    }
    res.json(ocrService.getStatus());
  });

  // Get supported file types
  router.get("/ocr/supported-types", (_req, res) => {
    res.json({ types: SUPPORTED_MIME_TYPES });
  });

  // Scan invoice (upload + extract)
  router.post("/ocr/scan", upload.single("file"), async (req: AuthenticatedRequest, res) => {
    if (!ocrService) {
      return res.status(501).json({ error: "OCR service not configured" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const orgId = (req.body.orgId as string) || "demo-org";
    const invoiceType = (req.body.type as "receivable" | "payable") || "payable";
    const autoCreate = req.body.autoCreate === "true";
    const defaultAccountId = req.body.accountId as string | undefined;

    try {
      const result = await ocrService.scanInvoice(
        file.buffer,
        file.originalname,
        file.mimetype,
        {
          orgId,
          userId: req.user?.id || "unknown",
          invoiceType,
          defaultAccountId,
          autoCreate
        }
      );

      if (!result.success) {
        return res.status(400).json({ 
          success: false, 
          error: result.error,
          fileUrl: result.fileUrl
        });
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create invoice from extracted data (manual confirmation)
  router.post("/ocr/create-from-extracted", async (req: AuthenticatedRequest, res) => {
    if (!ocrService) {
      return res.status(501).json({ error: "OCR service not configured" });
    }

    const { extracted, orgId, invoiceType, accountId, receiptUrl } = req.body;

    if (!extracted || !orgId) {
      return res.status(400).json({ error: "Missing required fields: extracted, orgId" });
    }

    try {
      const invoice = ocrService.createInvoiceFromExtracted(extracted, {
        orgId,
        userId: req.user?.id || "unknown",
        invoiceType: invoiceType || "payable",
        defaultAccountId: accountId,
        receiptUrl
      });

      res.status(201).json({ success: true, invoice });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



