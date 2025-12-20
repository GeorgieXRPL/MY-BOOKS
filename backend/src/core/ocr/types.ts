/**
 * OCR Types
 * Types for invoice/receipt scanning and data extraction
 */

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

export interface ExtractedInvoice {
  // Vendor/Counterparty info
  vendorName: string;
  vendorAddress?: string;
  vendorTaxId?: string;

  // Invoice details
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;

  // Amounts
  subtotal?: number;
  taxAmount?: number;
  total: number;
  currency: string;

  // Line items (if parseable)
  lineItems: ExtractedLineItem[];

  // Additional info
  notes?: string;
  paymentTerms?: string;

  // Raw extracted text (for debugging/verification)
  rawText?: string;
  confidence: number; // 0-1 confidence score
}

export interface OCRResult {
  success: boolean;
  invoice?: ExtractedInvoice;
  error?: string;
  fileUrl?: string;
}

export interface UploadedFile {
  id: string;
  orgId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}
