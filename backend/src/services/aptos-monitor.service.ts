/**
 * Aptos Blockchain Transaction Monitor Service
 * 
 * Polls the Aptos public ledger for transactions on the platform wallet
 * Filters and parses platform-specific transactions
 * Broadcasts real-time updates to admin dashboard
 */

import axios from 'axios';
import logger from '../utils/logger';
import { pool } from '../database/connection';
import { io } from '../index'; // Socket.IO instance

interface AptosTransaction {
  version: string;
  hash: string;
  state_change_hash: string;
  event_root_hash: string;
  state_checkpoint_hash: string | null;
  gas_used: string;
  success: boolean;
  vm_status: string;
  accumulator_root_hash: string;
  changes: any[];
  sender: string;
  sequence_number: string;
  max_gas_amount: string;
  gas_unit_price: string;
  expiration_timestamp_secs: string;
  payload: {
    type: string;
    function: string;
    type_arguments: string[];
    arguments: any[];
  };
  signature: any;
  events: any[];
  timestamp: string;
}

interface ParsedTransaction {
  tx_hash: string;
  tx_type: 'deposit' | 'withdrawal' | 'batch_withdrawal' | 'onchain_proof' | 'unknown';
  sender: string;
  recipient?: string;
  amount_octas?: number;
  amount_apt?: number;
  amount_usd?: number;
  gas_used: number;
  success: boolean;
  timestamp: string;
  description: string;
  metadata: any;
}

class AptosMonitorService {
  private platformAddress: string;
  private nodeUrl: string;
  private isRunning: boolean = false;
  private pollInterval: number = 10000; // 10 seconds
  private lastProcessedVersion: number = 0;

  constructor() {
    this.platformAddress = process.env.APTOS_PLATFORM_ADDRESS || '';
    this.nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    
    if (!this.platformAddress) {
      logger.warn('APTOS_PLATFORM_ADDRESS not set - Aptos monitor will not start');
    }
  }

  /**
   * Start monitoring the blockchain
   */
  async start() {
    if (!this.platformAddress) {
      logger.warn('Cannot start Aptos monitor - no platform address configured');
      return;
    }

    if (this.isRunning) {
      logger.warn('Aptos monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Starting Aptos blockchain monitor', {
      address: this.platformAddress,
      interval: this.pollInterval,
    });

    // Load last processed version from database
    await this.loadLastProcessedVersion();

    // Start polling loop
    this.poll();
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    logger.info('⏹️  Stopped Aptos blockchain monitor');
  }

  /**
   * Load the last processed transaction version from database
   */
  private async loadLastProcessedVersion() {
    try {
      const result = await pool.query(
        `SELECT MAX(version::bigint) as last_version 
         FROM aptos_transactions 
         WHERE platform_address = $1`,
        [this.platformAddress]
      );

      if (result.rows[0]?.last_version) {
        this.lastProcessedVersion = parseInt(result.rows[0].last_version);
        logger.info(`📖 Resuming from version: ${this.lastProcessedVersion}`);
      } else {
        logger.info('📖 Starting fresh - no previous transactions found');
      }
    } catch (error) {
      logger.error('Failed to load last processed version:', error);
      // Continue anyway - will process all available transactions
    }
  }

  /**
   * Main polling loop
   */
  private async poll() {
    while (this.isRunning) {
      try {
        await this.fetchAndProcessTransactions();
      } catch (error) {
        logger.error('Error in Aptos monitor poll:', error);
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Fetch transactions from Aptos API
   */
  private async fetchAndProcessTransactions() {
    try {
      const url = `${this.nodeUrl}/accounts/${this.platformAddress}/transactions`;
      const params: any = {
        limit: 25, // Fetch last 25 transactions
      };

      if (this.lastProcessedVersion > 0) {
        params.start = this.lastProcessedVersion + 1;
      }

      const response = await axios.get<AptosTransaction[]>(url, { params });
      const transactions = response.data;

      if (!transactions || transactions.length === 0) {
        return;
      }

      logger.info(`📥 Fetched ${transactions.length} new transactions from Aptos`);

      // Process each transaction
      for (const tx of transactions) {
        await this.processTransaction(tx);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Account not found yet - likely new account
        logger.debug('Platform account not found on-chain yet');
      } else {
        logger.error('Failed to fetch Aptos transactions:', error.message);
      }
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(tx: AptosTransaction) {
    try {
      // Parse transaction
      const parsed = this.parseTransaction(tx);

      // Skip if not platform-related
      if (parsed.tx_type === 'unknown') {
        return;
      }

      // Store in database
      await this.storeTransaction(parsed, tx);

      // Broadcast to admin dashboard via WebSocket
      this.broadcastTransaction(parsed);

      // Update last processed version
      this.lastProcessedVersion = parseInt(tx.version);

      logger.info(`✅ Processed transaction: ${parsed.tx_hash.substring(0, 10)}... (${parsed.tx_type})`);
    } catch (error) {
      logger.error(`Failed to process transaction ${tx.hash}:`, error);
    }
  }

  /**
   * Parse Aptos transaction to identify type and extract data
   */
  private parseTransaction(tx: AptosTransaction): ParsedTransaction {
    const parsed: ParsedTransaction = {
      tx_hash: tx.hash,
      tx_type: 'unknown',
      sender: tx.sender,
      gas_used: parseInt(tx.gas_used),
      success: tx.success,
      timestamp: tx.timestamp,
      description: '',
      metadata: {},
    };

    // Check if transaction involves our module
    if (tx.payload?.type === 'entry_function_payload') {
      const functionName = tx.payload.function;
      const moduleAddress = process.env.APTOS_MODULE_ADDRESS;

      // Batch withdrawal
      if (functionName === `${moduleAddress}::payment_system::batch_transfer`) {
        parsed.tx_type = 'batch_withdrawal';
        const recipients = tx.payload.arguments[0] as string[];
        const amounts = tx.payload.arguments[1] as number[];
        
        const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
        parsed.amount_octas = totalAmount;
        parsed.amount_apt = totalAmount / 100_000_000;
        parsed.amount_usd = parsed.amount_apt * 10; // Approximate APT price
        
        parsed.description = `Batch withdrawal to ${recipients.length} users`;
        parsed.metadata = { recipients, amounts };
      }
      
      // Hash proof (booking completion, etc.)
      else if (functionName === `${moduleAddress}::hash_registry::store_hash`) {
        parsed.tx_type = 'onchain_proof';
        const dataHash = tx.payload.arguments[0];
        const recordType = tx.payload.arguments[1];
        const subjectId = tx.payload.arguments[2];
        
        parsed.description = `On-chain proof: ${recordType}`;
        parsed.metadata = { dataHash, recordType, subjectId };
      }
    }

    // Check events for transfers
    for (const event of tx.events || []) {
      // APT deposit to platform
      if (event.type === '0x1::coin::DepositEvent' && event.data?.account === this.platformAddress) {
        parsed.tx_type = 'deposit';
        parsed.amount_octas = parseInt(event.data.amount);
        parsed.amount_apt = parsed.amount_octas / 100_000_000;
        parsed.amount_usd = parsed.amount_apt * 10;
        parsed.description = `Deposit: ${parsed.amount_apt.toFixed(4)} APT`;
      }

      // APT withdrawal from platform
      if (event.type === '0x1::coin::WithdrawEvent' && event.data?.account === this.platformAddress) {
        parsed.tx_type = 'withdrawal';
        parsed.amount_octas = parseInt(event.data.amount);
        parsed.amount_apt = parsed.amount_octas / 100_000_000;
        parsed.amount_usd = parsed.amount_apt * 10;
        parsed.description = `Withdrawal: ${parsed.amount_apt.toFixed(4)} APT`;
      }
    }

    return parsed;
  }

  /**
   * Store transaction in database
   */
  private async storeTransaction(parsed: ParsedTransaction, raw: AptosTransaction) {
    try {
      await pool.query(
        `INSERT INTO aptos_transactions (
          version, tx_hash, tx_type, sender, recipient, 
          amount_octas, amount_usd, gas_used, success, 
          timestamp, description, metadata, platform_address, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (tx_hash) DO NOTHING`,
        [
          raw.version,
          parsed.tx_hash,
          parsed.tx_type,
          parsed.sender,
          parsed.recipient || null,
          parsed.amount_octas || null,
          parsed.amount_usd || null,
          parsed.gas_used,
          parsed.success,
          parsed.timestamp,
          parsed.description,
          JSON.stringify(parsed.metadata),
          this.platformAddress,
          JSON.stringify(raw),
        ]
      );
    } catch (error) {
      logger.error('Failed to store Aptos transaction:', error);
    }
  }

  /**
   * Broadcast transaction to admin dashboard via WebSocket
   */
  private broadcastTransaction(parsed: ParsedTransaction) {
    try {
      io.to('admin-live-feed').emit('aptos-transaction', {
        ...parsed,
        platform: 'aptos',
        timestamp: new Date(parseInt(parsed.timestamp) / 1000), // Convert microseconds
      });

      logger.debug(`📡 Broadcasted Aptos transaction to admin dashboard`);
    } catch (error) {
      logger.error('Failed to broadcast transaction:', error);
    }
  }

  /**
   * Get recent transactions for initial load
   */
  async getRecentTransactions(limit: number = 50) {
    try {
      const result = await pool.query(
        `SELECT * FROM aptos_transactions 
         WHERE platform_address = $1 
         ORDER BY timestamp DESC 
         LIMIT $2`,
        [this.platformAddress, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch recent Aptos transactions:', error);
      return [];
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
const aptosMonitorService = new AptosMonitorService();

export default aptosMonitorService;

