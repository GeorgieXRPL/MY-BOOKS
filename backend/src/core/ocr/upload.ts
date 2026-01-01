/**
 * File Upload Service
 * Handles file uploads to Cloudflare R2 (S3-compatible)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { newId } from "../../utils/id";
import { logger } from "../../utils/logger";
import { UploadedFile } from "./types";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "reporting-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Create S3 client for R2
let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
  }

  return s3Client;
}

export function isStorageConfigured(): boolean {
  return !!getS3Client();
}

/**
 * Upload a file to R2
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  orgId: string,
  userId: string
): Promise<UploadedFile | null> {
  const client = getS3Client();
  
  if (!client) {
    logger.warn("R2 storage not configured, using local storage fallback");
    return uploadToLocalStorage(buffer, filename, mimeType, orgId, userId);
  }

  const fileId = newId();
  const ext = filename.split(".").pop() || "bin";
  const key = `${orgId}/${fileId}.${ext}`;

  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    }));

    const url = R2_PUBLIC_URL 
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    const file: UploadedFile = {
      id: fileId,
      orgId,
      filename,
      mimeType,
      size: buffer.length,
      url,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    };

    logger.info("File uploaded to R2", { fileId, key, size: buffer.length });
    return file;
  } catch (error: any) {
    logger.error("R2 upload failed", { error: error.message, filename });
    return null;
  }
}

/**
 * Get a presigned URL for secure download
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error: any) {
    logger.error("Failed to generate presigned URL", { error: error.message, key });
    return null;
  }
}

/**
 * Local storage fallback (for development without R2)
 */
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function uploadToLocalStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  orgId: string,
  userId: string
): UploadedFile {
  // Ensure uploads directory exists
  const orgDir = path.join(UPLOADS_DIR, orgId);
  if (!fs.existsSync(orgDir)) {
    fs.mkdirSync(orgDir, { recursive: true });
  }

  const fileId = newId();
  const ext = filename.split(".").pop() || "bin";
  const storedName = `${fileId}.${ext}`;
  const filePath = path.join(orgDir, storedName);

  fs.writeFileSync(filePath, buffer);

  const file: UploadedFile = {
    id: fileId,
    orgId,
    filename,
    mimeType,
    size: buffer.length,
    url: `/uploads/${orgId}/${storedName}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId
  };

  logger.info("File saved to local storage", { fileId, filePath, size: buffer.length });
  return file;
}

/**
 * Read local file (for OCR processing)
 */
export function readLocalFile(url: string): Buffer | null {
  if (!url.startsWith("/uploads/")) return null;
  
  const filePath = path.join(process.cwd(), url);
  if (!fs.existsSync(filePath)) return null;
  
  return fs.readFileSync(filePath);
}


