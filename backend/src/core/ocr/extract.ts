/**
 * OCR Extraction Service
 * Uses OpenAI Vision API to extract invoice data from images/PDFs
 */

import OpenAI from "openai";
import { ExtractedInvoice, OCRResult } from "./types";
import { logger } from "../../utils/logger";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  return openaiClient;
}

export function isOCRConfigured(): boolean {
  return !!getOpenAI();
}

/**
 * Extract invoice data from an image using OpenAI Vision
 */
export async function extractInvoiceFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  const openai = getOpenAI();
  
  if (!openai) {
    return { success: false, error: "OpenAI API not configured (OPENAI_API_KEY missing)" };
  }

  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from invoices and receipts. 
Extract all relevant information and return it as JSON.
Be precise with numbers and currencies. If a field is not visible or unclear, omit it rather than guess.
For line items, extract as many as you can see clearly.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract invoice/receipt data from this image. Return ONLY valid JSON in this exact format:
{
  "vendorName": "Company Name",
  "vendorAddress": "Full address if visible",
  "vendorTaxId": "Tax ID if visible",
  "invoiceNumber": "INV-12345",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "subtotal": 100.00,
  "taxAmount": 10.00,
  "total": 110.00,
  "currency": "USD",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 100.00,
      "amount": 100.00,
      "taxRate": 10
    }
  ],
  "notes": "Any notes or payment terms",
  "paymentTerms": "Net 30",
  "confidence": 0.95
}`
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1 // Low temperature for consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No response from OpenAI" };
    }

    // Parse JSON from response
    const invoice = parseInvoiceJSON(content);
    if (!invoice) {
      return { 
        success: false, 
        error: "Failed to parse invoice data from response",
        invoice: { rawText: content } as any
      };
    }

    logger.info("Invoice extracted successfully", { 
      vendor: invoice.vendorName, 
      total: invoice.total,
      lineItems: invoice.lineItems.length
    });

    return { success: true, invoice };
  } catch (error: any) {
    logger.error("OCR extraction failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Parse JSON from OpenAI response (handles markdown code blocks)
 */
function parseInvoiceJSON(content: string): ExtractedInvoice | null {
  try {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    
    const data = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!data.vendorName || data.total === undefined) {
      logger.warn("Missing required fields in extracted data", data);
    }

    // Normalize and return
    return {
      vendorName: data.vendorName || "Unknown Vendor",
      vendorAddress: data.vendorAddress,
      vendorTaxId: data.vendorTaxId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: normalizeDate(data.invoiceDate),
      dueDate: normalizeDate(data.dueDate),
      subtotal: parseFloat(data.subtotal) || undefined,
      taxAmount: parseFloat(data.taxAmount) || undefined,
      total: parseFloat(data.total) || 0,
      currency: data.currency || "USD",
      lineItems: (data.lineItems || []).map((li: any) => ({
        description: li.description || "",
        quantity: parseFloat(li.quantity) || 1,
        unitPrice: parseFloat(li.unitPrice) || 0,
        amount: parseFloat(li.amount) || 0,
        taxRate: parseFloat(li.taxRate) || undefined
      })),
      notes: data.notes,
      paymentTerms: data.paymentTerms,
      rawText: content,
      confidence: parseFloat(data.confidence) || 0.8
    };
  } catch (error) {
    logger.error("Failed to parse invoice JSON", { error, content: content.slice(0, 500) });
    return null;
  }
}

/**
 * Normalize date strings to YYYY-MM-DD format
 */
function normalizeDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;

  try {
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return as-is if unparseable
    
    return date.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

/**
 * Extract from PDF (converts first page to image)
 * Note: For full PDF support, you'd need pdf-poppler or similar
 * For now, we support image formats directly
 */
export async function extractInvoiceFromPDF(pdfBuffer: Buffer): Promise<OCRResult> {
  // For PDFs, we'd need to convert to image first
  // Using pdf-poppler or similar library
  // For now, return an error suggesting image upload
  return {
    success: false,
    error: "PDF processing not yet implemented. Please upload an image (JPG, PNG) instead."
  };
}

/**
 * Supported MIME types
 */
export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
];

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
}
