import { Pool, PoolClient } from 'pg';

/** Backward-compatible client type with both release() and end() */
export type DbClient = PoolClient & { end: () => Promise<void> };

/**
 * Module-level connection pool.
 *
 * Per-request pg.Client requires a new TCP+SSL handshake each time (~2-5s to Supabase).
 * Pool keeps connections warm so subsequent requests reuse existing sockets (~50ms).
 *
 * Settings:
 * - max 5: safe for Supabase free tier
 * - idleTimeoutMillis 10s: release idle connections before pgBouncer drops them (~30s idle limit)
 * - connectionTimeoutMillis 15s: fail fast if pool is exhausted
 */
let _pool: Pool | null = null;

function getPool(): Pool {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set in environment variables.');
    }
    if (!_pool) {
        // Only use SSL for remote Supabase (not localhost)
        const isLocalhost = process.env.DATABASE_URL.includes('127.0.0.1') ||
                           process.env.DATABASE_URL.includes('localhost');
        const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

        _pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig,
            max: 5,
            idleTimeoutMillis: 10_000,
            connectionTimeoutMillis: 15_000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 5_000,
        });
        _pool.on('error', (err) => {
            // pg automatically removes the errored idle client from the pool
            console.error('[pg Pool] idle client error (auto-removed):', err.message);
        });
    }
    return _pool;
}

/**
 * Acquire a pooled connection.
 * Always call client.end() or client.release() in a finally block.
 * client.end() is mapped to client.release() for backward compatibility.
 */
export async function connectDb(): Promise<DbClient> {
    const pool = getPool();

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const client = await pool.connect();
            const wrapped = client as DbClient;
            wrapped.end = () => {
                client.release();
                return Promise.resolve();
            };
            return wrapped;
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            const isRetryable = msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED');
            if (attempt === 2 || !isRetryable) throw err;
            await new Promise(r => setTimeout(r, 1_000));
        }
    }

    throw new Error('connectDb: exhausted retries');
}
