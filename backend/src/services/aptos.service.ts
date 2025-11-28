import { AptosClient, AptosAccount, FaucetClient, HexString, Types } from 'aptos';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import gasCalculatorService from './gas-calculator.service';

dotenv.config();

class AptosService {
  private client: AptosClient;
  private faucetClient: FaucetClient | null;
  private platformAccount: AptosAccount;
  private moduleAddress: string;

  constructor() {
    const nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    this.client = new AptosClient(nodeUrl);

    // Initialize faucet client for devnet/testnet
    const faucetUrl = process.env.APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com';
    this.faucetClient = process.env.APTOS_NETWORK !== 'mainnet' ? new FaucetClient(nodeUrl, faucetUrl) : null;

    // Initialize platform account from private key
    const privateKeyHex = process.env.APTOS_PLATFORM_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('APTOS_PLATFORM_PRIVATE_KEY not configured');
    }

    const privateKey = new HexString(privateKeyHex);
    this.platformAccount = new AptosAccount(privateKey.toUint8Array());
    
    this.moduleAddress = process.env.APTOS_PLATFORM_ADDRESS || this.platformAccount.address().hex();
    
    logger.info(`🔗 Aptos Service initialized: ${nodeUrl}`);
    logger.info(`📍 Platform Address: ${this.moduleAddress}`);
  }

  /**
   * Private helper for submitting transactions to specific modules
   */
  private async submitModuleTransaction(
    module: string,
    functionName: string,
    typeArgs: string[],
    args: any[]
  ): Promise<string> {
    try {
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::${module}::${functionName}`,
        type_arguments: typeArgs,
        arguments: args,
      };

      const txnRequest = await this.client.generateTransaction(
        this.platformAccount.address(),
        payload
      );

      const signedTxn = await this.client.signTransaction(
        this.platformAccount,
        txnRequest
      );

      const transactionRes = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(transactionRes.hash);

      logger.info(`✅ Transaction submitted: ${transactionRes.hash}`);
      return transactionRes.hash;
    } catch (error) {
      logger.error(`Transaction failed (${module}::${functionName}):`, error);
      throw error;
    }
  }

  /**
   * Initialize all smart contract modules
   */
  async initializeModules(): Promise<void> {
    try {
      await this.submitModuleTransaction('booking_system', 'initialize', [], []);
      await this.submitModuleTransaction('review_system', 'initialize', [], []);
      await this.submitModuleTransaction('barber_registry', 'initialize', [], []);
      await this.submitModuleTransaction('payment_system', 'initialize', [], []);
      logger.info('✅ All Aptos modules initialized');
    } catch (error) {
      logger.error('Failed to initialize modules:', error);
      throw error;
    }
  }

  /**
   * Create a booking on-chain
   */
  async createBooking(params: {
    clientAddress: string;
    barberAddress: string;
    serviceType: string;
    price: number;
    scheduledTime: number;
    campusId: number;
    durationMinutes: number;
    locationHash: string;
  }): Promise<string> {
    const { clientAddress, barberAddress, serviceType, price, scheduledTime, campusId, durationMinutes, locationHash } = params;

    const payload = await this.submitModuleTransaction(
      'booking_system',
      'create_booking',
      [],
      [
        clientAddress,
        barberAddress,
        serviceType,
        price,
        scheduledTime,
        campusId,
        durationMinutes,
        Array.from(Buffer.from(locationHash, 'utf-8')),
      ]
    );

    return payload;
  }

  /**
   * Confirm a booking
   */
  async confirmBooking(barberAddress: string, bookingId: number): Promise<string> {
    // Note: In production, you'd need to sign with the barber's account
    // For MVP with custodial wallets, platform signs on behalf
    const payload = await this.submitModuleTransaction(
      'booking_system',
      'confirm_booking',
      [],
      [this.moduleAddress, bookingId]
    );

    return payload;
  }

  /**
   * Complete a booking
   */
  async completeBooking(bookingId: number): Promise<string> {
    const payload = await this.submitModuleTransaction(
      'booking_system',
      'complete_booking',
      [],
      [this.moduleAddress, bookingId]
    );

    return payload;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number): Promise<string> {
    const payload = await this.submitModuleTransaction(
      'booking_system',
      'cancel_booking',
      [],
      [this.moduleAddress, bookingId]
    );

    return payload;
  }

  /**
   * Register a barber on-chain
   */
  async registerBarber(params: {
    barberAddress: string;
    campusId: number;
    specialties: string[];
    instantBookEnabled: boolean;
    bioHash: string;
    pricingHash: string;
  }): Promise<string> {
    const { barberAddress, campusId, specialties, instantBookEnabled, bioHash, pricingHash } = params;

    const payload = await this.submitModuleTransaction(
      'barber_registry',
      'register_barber',
      [],
      [
        barberAddress,
        campusId,
        specialties,
        instantBookEnabled,
        Array.from(Buffer.from(bioHash, 'utf-8')),
        Array.from(Buffer.from(pricingHash, 'utf-8')),
      ]
    );

    return payload;
  }

  /**
   * Submit a review on-chain
   */
  async submitReview(params: {
    clientAddress: string;
    bookingId: number;
    barberAddress: string;
    rating: number;
    reviewTextHash: string;
    campusId: number;
  }): Promise<string> {
    const { clientAddress, bookingId, barberAddress, rating, reviewTextHash, campusId } = params;

    const payload = await this.submitModuleTransaction(
      'review_system',
      'submit_review',
      [],
      [
        clientAddress,
        bookingId,
        barberAddress,
        rating,
        Array.from(Buffer.from(reviewTextHash, 'utf-8')),
        campusId,
      ]
    );

    return payload;
  }

  /**
   * Create payment record on-chain
   */
  async createPayment(params: {
    bookingId: number;
    barberAddress: string;
    clientAddress: string;
    amount: number;
    stripePaymentIdHash: string;
  }): Promise<string> {
    const { bookingId, barberAddress, clientAddress, amount, stripePaymentIdHash } = params;

    const payload = await this.submitModuleTransaction(
      'payment_system',
      'create_payment',
      [],
      [
        bookingId,
        barberAddress,
        clientAddress,
        amount,
        Array.from(Buffer.from(stripePaymentIdHash, 'utf-8')),
      ]
    );

    return payload;
  }

  /**
   * Release payment to barber
   */
  async releasePayment(paymentId: number): Promise<string> {
    const payload = await this.submitModuleTransaction(
      'payment_system',
      'release_payment',
      [],
      [paymentId]
    );

    return payload;
  }

  /**
   * Get booking details from blockchain
   */
  async getBooking(bookingId: number): Promise<any> {
    try {
      const resource = await this.client.view({
        function: `${this.moduleAddress}::booking_system::get_booking`,
        type_arguments: [],
        arguments: [this.moduleAddress, bookingId.toString()],
      });

      return resource;
    } catch (error) {
      logger.error(`Failed to fetch booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Get barber's rating from blockchain
   */
  async getBarberRating(barberAddress: string): Promise<{ average: number; total: number }> {
    try {
      const resource = await this.client.view({
        function: `${this.moduleAddress}::review_system::get_barber_rating`,
        type_arguments: [],
        arguments: [this.moduleAddress, barberAddress],
      });

      const [average, total] = resource as [string, string];
      
      return {
        average: parseInt(average) / 100, // Convert from fixed-point
        total: parseInt(total),
      };
    } catch (error) {
      logger.error(`Failed to fetch barber rating for ${barberAddress}:`, error);
      return { average: 0, total: 0 };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(address: string): Promise<number> {
    try {
      const resources = await this.client.getAccountResources(address);
      const accountResource = resources.find(
        (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
      );

      if (accountResource) {
        const data = accountResource.data as any;
        return parseInt(data.coin.value) / 100000000; // Convert from Octas to APT
      }

      return 0;
    } catch (error) {
      logger.error(`Failed to fetch balance for ${address}:`, error);
      return 0;
    }
  }

  /**
   * Generate new Aptos account (for user wallet creation)
   */
  generateAccount(): { address: string; privateKey: string } {
    const account = new AptosAccount();
    return {
      address: account.address().hex(),
      privateKey: HexString.fromUint8Array(account.signingKey.secretKey).hex(),
    };
  }

  /**
   * Fund account (devnet/testnet only)
   */
  async fundAccount(address: string, amount: number = 100000000): Promise<void> {
    if (!this.faucetClient) {
      throw new Error('Faucet client not available (mainnet or not configured)');
    }
    
    try {
      await this.faucetClient.fundAccount(address, amount);
      logger.info(`💰 Funded account ${address} with ${amount / 100000000} APT`);
    } catch (error) {
      logger.error(`Failed to fund account ${address}:`, error);
      throw error;
    }
  }

  /**
   * Submit batched withdrawals (gas efficient)
   * Sends to multiple recipients in a single transaction
   * 
   * Enhanced with gas validation from typescript_cash_bot
   */
  async submitBatchWithdrawal(
    recipients: (string | undefined)[],
    amounts: number[]
  ): Promise<string> {
    try {
      // Filter out undefined recipients
      const validRecipients = recipients.filter((r): r is string => r !== undefined);
      
      if (validRecipients.length === 0) {
        throw new Error('No valid recipients for batch withdrawal');
      }

      if (validRecipients.length !== amounts.length) {
        throw new Error('Recipients and amounts length mismatch');
      }

      // ✅ NEW: Validate gas availability
      const platformBalance = await this.getAccountBalance(this.platformAccount.address().hex());
      const gasEstimate = gasCalculatorService.calculateBatchWithdrawalGas(validRecipients.length);
      
      logger.info('🔍 Batch withdrawal gas validation:', {
        platformBalance: platformBalance.toFixed(8),
        gasRequired: gasEstimate.totalWithBufferAPT.toFixed(8),
        gasUnits: gasEstimate.gasUnits,
        recipientCount: validRecipients.length,
        totalAmountAPT: (amounts.reduce((sum, a) => sum + a, 0) / 100_000_000).toFixed(8),
      });

      // ✅ NEW: Validate sufficient balance for gas
      const totalWithdrawalAPT = amounts.reduce((sum, a) => sum + a, 0) / 100_000_000;
      const totalRequired = totalWithdrawalAPT + gasEstimate.totalWithBufferAPT;
      
      if (platformBalance < totalRequired) {
        const shortfall = totalRequired - platformBalance;
        logger.error('⚠️ Insufficient platform balance for batch withdrawal:', {
          platformBalance: platformBalance.toFixed(8),
          withdrawalAmount: totalWithdrawalAPT.toFixed(8),
          gasRequired: gasEstimate.totalWithBufferAPT.toFixed(8),
          totalRequired: totalRequired.toFixed(8),
          shortfall: shortfall.toFixed(8),
        });
        throw new Error(`Insufficient platform balance. Need ${shortfall.toFixed(8)} more APT`);
      }

      logger.info('✅ Gas validation passed - proceeding with batch withdrawal');

      // Note: This requires a Move contract function like:
      // public entry fun batch_transfer(
      //   sender: &signer,
      //   recipients: vector<address>,
      //   amounts: vector<u64>
      // )
      
      // For now, use a generic transaction submission
      // In production, replace with actual Move function call
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::payment_system::batch_transfer`,
        type_arguments: [],
        arguments: [validRecipients, amounts],
      };

      const rawTxn = await this.client.generateTransaction(
        this.platformAccount.address(),
        payload
      );

      const signedTxn = await this.client.signTransaction(this.platformAccount, rawTxn);
      const txResponse = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(txResponse.hash);

      // ✅ NEW: Enhanced logging with gas details
      logger.info('✅ Batch withdrawal completed successfully!', {
        recipient_count: validRecipients.length,
        total_amount_apt: totalWithdrawalAPT.toFixed(8),
        total_amount_dollars: (amounts.reduce((sum, a) => sum + a, 0) / 100).toFixed(2),
        gas_estimate: gasEstimate.totalWithBufferAPT.toFixed(8),
        tx_hash: txResponse.hash,
        explorer_url: `https://explorer.aptoslabs.com/txn/${txResponse.hash}?network=devnet`,
      });

      return txResponse.hash;
    } catch (error) {
      logger.error('❌ Batch withdrawal submission failed:', {
        recipient_count: recipients.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Submit generic transaction (for hash anchoring)
   */
  async submitTransaction(
    functionName: string,
    args: any[],
    description?: string
  ): Promise<string> {
    try {
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::${functionName}`,
        type_arguments: [],
        arguments: args,
      };

      const rawTxn = await this.client.generateTransaction(
        this.platformAccount.address(),
        payload
      );

      const signedTxn = await this.client.signTransaction(this.platformAccount, rawTxn);
      const txResponse = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(txResponse.hash);

      logger.info(`Transaction submitted: ${description || functionName}`, {
        tx_hash: txResponse.hash,
      });

      return txResponse.hash;
    } catch (error) {
      logger.error(`Transaction submission failed: ${functionName}`, error);
      throw error;
    }
  }
}

export default new AptosService();

