/**
 * OCR Service
 * Main service for invoice/receipt scanning workflow
 */

import { uploadFile, readLocalFile, isStorageConfigured } from "./upload";
import { 
  extractInvoiceFromImage, 
  isOCRConfigured, 
  isSupportedMimeType,
  SUPPORTED_MIME_TYPES 
} from "./extract";
import { ExtractedInvoice, OCRResult, UploadedFile } from "./types";
import { InvoiceService } from "../invoices";
import { Invoice, InvoiceLineItem } from "../types";
import { newId } from "../../utils/id";
import { logger } from "../../utils/logger";

export interface ScanAndCreateOptions {
  orgId: string;
  userId: string;
  invoiceType: "receivable" | "payable";
  defaultAccountId?: string;
  autoCreate?: boolean; // If true, create invoice automatically
}

export interface ScanResult {
  success: boolean;
  extracted?: ExtractedInvoice;
  invoice?: Invoice;
  fileUrl?: string;
  error?: string;
}

export class OCRService {
  constructor(private invoiceService: InvoiceService) {}

  /**
   * Check if OCR is properly configured
   */
  getStatus(): { configured: boolean; storage: boolean; ocr: boolean } {
    return {
      configured: isStorageConfigured() || true, // Local storage fallback always works
      storage: isStorageConfigured(),
      ocr: isOCRConfigured()
    };
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return SUPPORTED_MIME_TYPES;
  }

  /**
   * Scan an invoice/receipt and optionally create an invoice
   */
  async scanInvoice(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    options: ScanAndCreateOptions
  ): Promise<ScanResult> {
    const { orgId, userId, invoiceType, defaultAccountId, autoCreate } = options;

    // Validate file type
    if (!isSupportedMimeType(mimeType)) {
      return {
        success: false,
        error: `Unsupported file type: ${mimeType}. Supported: ${SUPPORTED_MIME_TYPES.join(", ")}`
      };
    }

    // Step 1: Upload file
    const uploadedFile = await uploadFile(fileBuffer, filename, mimeType, orgId, userId);
    if (!uploadedFile) {
      return { success: false, error: "Failed to upload file" };
    }

    logger.info("File uploaded for OCR", { fileId: uploadedFile.id, filename });

    // Step 2: Extract invoice data
    const ocrResult = await extractInvoiceFromImage(fileBuffer, mimeType);
    if (!ocrResult.success || !ocrResult.invoice) {
      return {
        success: false,
        error: ocrResult.error || "Failed to extract invoice data",
        fileUrl: uploadedFile.url
      };
    }

    const extracted = ocrResult.invoice;
    logger.info("Invoice data extracted", {
      vendor: extracted.vendorName,
      total: extracted.total,
      lineItems: extracted.lineItems.length
    });

    // Step 3: Create invoice if requested
    let invoice: Invoice | undefined;
    if (autoCreate) {
      invoice = this.createInvoiceFromExtracted(extracted, {
        orgId,
        userId,
        invoiceType,
        defaultAccountId,
        receiptUrl: uploadedFile.url
      });
    }

    return {
      success: true,
      extracted,
      invoice,
      fileUrl: uploadedFile.url
    };
  }

  /**
   * Create an invoice from extracted data
   */
  createInvoiceFromExtracted(
    extracted: ExtractedInvoice,
    options: {
      orgId: string;
      userId: string;
      invoiceType: "receivable" | "payable";
      defaultAccountId?: string;
      receiptUrl?: string;
    }
  ): Invoice {
    const { orgId, userId, invoiceType, defaultAccountId, receiptUrl } = options;

    // Map extracted line items to invoice line items
    const lineItems: Omit<InvoiceLineItem, "id">[] = extracted.lineItems.length > 0
      ? extracted.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          accountId: defaultAccountId || "",
          taxRate: li.taxRate || 0,
          amount: li.amount
        }))
      : [{
          // Create a single line item if none extracted
          description: `Invoice from ${extracted.vendorName}`,
          quantity: 1,
          unitPrice: extracted.total,
          accountId: defaultAccountId || "",
          taxRate: extracted.taxAmount && extracted.subtotal 
            ? (extracted.taxAmount / extracted.subtotal) * 100 
            : 0,
          amount: extracted.total
        }];

    // Determine dates
    const today = new Date().toISOString().split("T")[0];
    const issueDate = extracted.invoiceDate || today;
    const dueDate = extracted.dueDate || this.calculateDueDate(issueDate, 30);

    // Create the invoice
    const invoice = this.invoiceService.create({
      orgId,
      type: invoiceType,
      counterpartyId: this.generateCounterpartyId(extracted.vendorName),
      counterpartyName: extracted.vendorName,
      lineItems,
      currency: extracted.currency,
      issueDate,
      dueDate,
      notes: [
        extracted.notes,
        extracted.invoiceNumber ? `Original Invoice #: ${extracted.invoiceNumber}` : null,
        receiptUrl ? `Receipt: ${receiptUrl}` : null
      ].filter(Boolean).join("\n"),
      createdBy: userId
    });

    logger.info("Invoice created from OCR", { 
      invoiceId: invoice.id, 
      vendor: extracted.vendorName, 
      total: invoice.total 
    });

    return invoice;
  }

  /**
   * Generate a simple counterparty ID from name
   */
  private generateCounterpartyId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
  }

  /**
   * Calculate due date based on payment terms
   */
  private calculateDueDate(issueDate: string, days: number): string {
    const date = new Date(issueDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }
}
