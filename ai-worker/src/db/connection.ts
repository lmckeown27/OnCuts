/**
 * PostgreSQL Database Connection
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('📊 PostgreSQL connection established');
});

pool.on('error', (err: any) => {
  logger.error('❌ PostgreSQL connection error:', {
    code: err.code,
    message: err.message,
  });
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('✅ Database connection test successful', { time: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('❌ Database connection test failed:', error);
    return false;
  }
}

/**
 * Execute query with error handling
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text, error });
    throw error;
  }
}

/**
 * Close all connections
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('📊 PostgreSQL pool closed');
  } catch (error) {
    logger.error('Error closing pool:', error);
  }
}

