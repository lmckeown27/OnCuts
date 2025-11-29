/**
 * Custodial Signer Service
 * 
 * THE MAGIC: Platform signs blockchain transactions on behalf of users
 * 
 * ✨ User Experience:
 * - Users sign up with email + password (like any Web2 app)
 * - Backend derives Aptos address from email (deterministic)
 * - Backend stores encrypted private key (password-protected)
 * - Backend signs all transactions with user's key
 * - Users never see wallet, seed phrases, or gas fees
 * 
 * 🔐 Security:
 * - Private keys encrypted with user's password (never stored plain-text)
 * - Production: Use AWS KMS or Google Cloud HSM
 * - Development: Use encrypted local storage
 * 
 * 🎭 The Illusion:
 * - User clicks "Book Haircut"
 * - Backend signs transaction with their derived account
 * - Transaction submitted to blockchain
 * - User sees "Booking confirmed!" (instant)
 * - They have no idea blockchain was involved
 */

import { AptosAccount, AptosClient, TxnBuilderTypes, BCS } from 'aptos';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface UserCredentials {
  email: string;
  password: string;
}

interface DerivedAccount {
  address: string;
  publicKey: string;
  encryptedPrivateKey: string; // Encrypted with user's password
}

interface TransactionPayload {
  function: string;
  type_arguments?: string[];
  arguments: any[];
}

interface SignedTransaction {
  txHash: string;
  sender: string;
  payload: TransactionPayload;
  timestamp: number;
}

class CustodialSignerService {
  private aptosClient: AptosClient;
  private encryptionAlgorithm = 'aes-256-gcm';
  
  // In-memory cache (production: use Redis)
  private accountCache: Map<string, AptosAccount> = new Map();

  constructor() {
    const nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    this.aptosClient = new AptosClient(nodeUrl);
    
    logger.info('🔐 Custodial Signer Service initialized');
  }

  // ═══════════════════════════════════════════════════════════
  //  ACCOUNT DERIVATION (The Magic Starts Here)
  // ═══════════════════════════════════════════════════════════

  /**
   * Derive deterministic Aptos account from email
   * 
   * Same email always produces same private key (like HD wallets)
   * This allows password recovery without losing funds
   * 
   * ⚠️  SECURITY: Email acts as "seed phrase" - never expose!
   */
  private deriveAccountFromEmail(email: string, salt: string = 'campus_cuts_v1'): AptosAccount {
    // Hash email + salt to create deterministic seed
    const seed = crypto.createHash('sha256')
      .update(email.toLowerCase() + salt)
      .digest();

    // Create Aptos account from seed
    const account = new AptosAccount(seed);
    
    return account;
  }

  /**
   * Create new user account (called during signup)
   * 
   * Flow:
   * 1. User enters email + password
   * 2. Backend derives Aptos account from email
   * 3. Backend encrypts private key with password
   * 4. Backend stores encrypted key (database or KMS)
   * 5. Returns address to associate with user record
   */
  async createUserAccount(email: string, password: string): Promise<DerivedAccount> {
    try {
      logger.info(`🆕 Creating custodial account for: ${this.maskEmail(email)}`);

      // Derive account from email
      const account = this.deriveAccountFromEmail(email);
      const address = account.address().hex();
      const publicKey = account.pubKey().hex();
      
      // Encrypt private key with user's password
      const privateKeyHex = Buffer.from(account.signingKey.secretKey).toString('hex');
      const encryptedPrivateKey = this.encryptPrivateKey(privateKeyHex, password);

      // Cache in memory for session
      this.accountCache.set(email, account);

      logger.info(`✅ Account created: ${address}`);

      return {
        address,
        publicKey,
        encryptedPrivateKey,
      };
    } catch (error) {
      logger.error('Failed to create user account:', error);
      throw new Error('Failed to create blockchain account');
    }
  }

  /**
   * Load user account for signing (decrypt private key)
   * 
   * Used when:
   * - User logs in (decrypt key, cache in session)
   * - User makes transaction (retrieve from cache or decrypt)
   */
  async loadUserAccount(email: string, password: string, encryptedPrivateKey: string): Promise<AptosAccount> {
    try {
      // Check cache first (session management)
      if (this.accountCache.has(email)) {
        logger.info(`📦 Using cached account for: ${this.maskEmail(email)}`);
        return this.accountCache.get(email)!;
      }

      logger.info(`🔓 Decrypting account for: ${this.maskEmail(email)}`);

      // Decrypt private key
      const privateKeyHex = this.decryptPrivateKey(encryptedPrivateKey, password);
      const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');

      // Recreate account
      const account = new AptosAccount(privateKeyBytes.slice(0, 32)); // First 32 bytes is seed

      // Cache for session
      this.accountCache.set(email, account);

      logger.info(`✅ Account loaded: ${account.address().hex()}`);
      
      return account;
    } catch (error) {
      logger.error('Failed to load user account:', error);
      throw new Error('Invalid password or corrupted key');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TRANSACTION SIGNING (The Magic Continues)
  // ═══════════════════════════════════════════════════════════

  /**
   * Sign and submit transaction on behalf of user
   * 
   * THIS IS THE CORE MAGIC:
   * - User thinks they clicked "Book Haircut"
   * - Backend actually signed a blockchain transaction
   * - User has no idea
   * 
   * Flow:
   * 1. User action triggers API call
   * 2. Backend loads user's account (from cache or decrypt)
   * 3. Backend constructs transaction payload
   * 4. Backend signs with user's private key
   * 5. Backend submits to blockchain
   * 6. Backend returns success immediately (optimistic UI)
   * 7. Blockchain confirms in background
   */
  async signAndSubmitTransaction(
    userEmail: string,
    password: string,
    encryptedPrivateKey: string,
    payload: TransactionPayload
  ): Promise<SignedTransaction> {
    try {
      logger.info(`📝 Signing transaction for: ${this.maskEmail(userEmail)}`);
      logger.info(`   Function: ${payload.function}`);

      // Load user's account
      const account = await this.loadUserAccount(userEmail, password, encryptedPrivateKey);

      // Build transaction
      const entryPayload = {
        ...payload,
        type_arguments: payload.type_arguments || [],
      };
      const rawTxn = await this.aptosClient.generateTransaction(
        account.address(),
        entryPayload as any
      );

      // Sign transaction
      const signedTxn = await this.aptosClient.signTransaction(account, rawTxn);

      // Submit to blockchain
      const txResult = await this.aptosClient.submitTransaction(signedTxn);

      // Wait for confirmation (optional - for critical transactions)
      // For most transactions, we use optimistic UI and confirm in background
      // await this.aptosClient.waitForTransaction(txResult.hash);

      logger.info(`✅ Transaction submitted: ${txResult.hash}`);

      return {
        txHash: txResult.hash,
        sender: account.address().hex(),
        payload,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to sign transaction:', error);
      throw new Error('Transaction failed - please try again');
    }
  }

  /**
   * Sign transaction for immediate response (optimistic)
   * Use this for non-critical transactions where UX is more important than confirmation
   * 
   * Returns tx hash immediately, confirmation happens in background
   */
  async signAndSubmitOptimistic(
    userEmail: string,
    payload: TransactionPayload
  ): Promise<SignedTransaction> {
    try {
      // Check cache (user must be logged in)
      if (!this.accountCache.has(userEmail)) {
        throw new Error('User not authenticated');
      }

      const account = this.accountCache.get(userEmail)!;

      logger.info(`⚡ Optimistic transaction for: ${this.maskEmail(userEmail)}`);

      // Build and sign
      const entryPayload = {
        ...payload,
        type_arguments: payload.type_arguments || [],
      };
      const rawTxn = await this.aptosClient.generateTransaction(
        account.address(),
        entryPayload as any
      );
      const signedTxn = await this.aptosClient.signTransaction(account, rawTxn);

      // Submit (don't wait for confirmation)
      const txResult = await this.aptosClient.submitTransaction(signedTxn);

      // Confirmation happens in background
      this.confirmInBackground(txResult.hash);

      logger.info(`⚡ Optimistic tx submitted: ${txResult.hash}`);

      return {
        txHash: txResult.hash,
        sender: account.address().hex(),
        payload,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed optimistic transaction:', error);
      throw new Error('Transaction failed');
    }
  }

  /**
   * Confirm transaction in background (for monitoring)
   */
  private async confirmInBackground(txHash: string): Promise<void> {
    try {
      await this.aptosClient.waitForTransaction(txHash);
      logger.info(`✅ Background confirmation: ${txHash}`);
    } catch (error) {
      logger.error(`❌ Background confirmation failed: ${txHash}`, error);
      // TODO: Emit event for frontend to handle failure
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ENCRYPTION/DECRYPTION (Security Layer)
  // ═══════════════════════════════════════════════════════════

  /**
   * Encrypt private key with user's password
   * Uses AES-256-GCM for authenticated encryption
   * 
   * Production: Replace this with AWS KMS or Google Cloud HSM
   */
  private encryptPrivateKey(privateKeyHex: string, password: string): string {
    try {
      // Derive encryption key from password
      const key = crypto.scryptSync(password, 'salt_campus_cuts', 32);
      
      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Encrypt
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);
      let encrypted = cipher.update(privateKeyHex, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag (GCM mode only)
      const authTag = (cipher as any).getAuthTag();
      
      // Combine: iv + authTag + encrypted
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt private key with user's password
   */
  private decryptPrivateKey(encrypted: string, password: string): string {
    try {
      // Split components
      const parts = encrypted.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      
      // Derive same encryption key
      const key = crypto.scryptSync(password, 'salt_campus_cuts', 32);
      
      // Decrypt
      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
      (decipher as any).setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Invalid password');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get user's blockchain address (from cache or derive)
   */
  getUserAddress(email: string): string {
    if (this.accountCache.has(email)) {
      return this.accountCache.get(email)!.address().hex();
    }
    
    // Derive temporarily (for lookups)
    const account = this.deriveAccountFromEmail(email);
    return account.address().hex();
  }

  /**
   * Check if user is authenticated (account in cache)
   */
  isAuthenticated(email: string): boolean {
    return this.accountCache.has(email);
  }

  /**
   * Clear user session (logout)
   */
  logout(email: string): void {
    this.accountCache.delete(email);
    logger.info(`👋 User logged out: ${this.maskEmail(email)}`);
  }

  /**
   * Mask email for logging (privacy)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }

  /**
   * Get cached accounts count (for monitoring)
   */
  getCachedAccountsCount(): number {
    return this.accountCache.size;
  }
}

// Export singleton instance
export default new CustodialSignerService();

