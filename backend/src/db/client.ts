import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logger } from "../utils/logger";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let resolvedHost: string | null = null;

// Resolve hostname to IPv4 address (Render free tier doesn't support IPv6 outbound)
async function resolveHostToIPv4(hostname: string): Promise<string> {
  try {
    const result = await dnsLookup(hostname, { family: 4 });
    logger.info(`Resolved ${hostname} to ${result.address} (IPv4)`);
    return result.address;
  } catch (error) {
    logger.error(`Failed to resolve ${hostname} to IPv4, using original hostname`, error);
    return hostname;
  }
}

export async function initPool(): Promise<Pool> {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Parse connection string to extract components
    const url = new URL(connectionString);
    const hostname = url.hostname;
    const port = parseInt(url.port) || 5432;
    const database = url.pathname.slice(1); // Remove leading /
    const user = url.username;
    const password = decodeURIComponent(url.password);
    
    logger.info(`Connecting to PostgreSQL at ${hostname}:${port}/${database}`);
    
    // Resolve hostname to IPv4 before creating pool
    resolvedHost = await resolveHostToIPv4(hostname);
    
    pool = new Pool({
      host: resolvedHost,
      port,
      database,
      user,
      password,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    pool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", err);
    });
    
    logger.info(`PostgreSQL connection pool created (host: ${resolvedHost})`);
  }
  return pool;
}

// Synchronous getter - throws if pool not initialized
export function getPool(): Pool {
  if (!pool) {
    throw new Error("Pool not initialized. Call initPool() first.");
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
    logger.info("Drizzle ORM initialized");
  }
  return db;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
    logger.info("Drizzle ORM initialized");
  }
  return db;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    logger.info("PostgreSQL connection pool closed");
  }
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("PostgreSQL connection test successful");
    return true;
  } catch (error) {
    logger.error("PostgreSQL connection test failed", error);
    return false;
  }
}
