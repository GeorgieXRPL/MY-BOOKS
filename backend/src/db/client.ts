import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logger } from "../utils/logger";
import dns from "dns";

// Force IPv4 for DNS resolution (Render free tier doesn't support IPv6 outbound)
dns.setDefaultResultOrder("ipv4first");

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout for cold starts
    });
    
    pool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", err);
    });
    
    logger.info("PostgreSQL connection pool created");
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
