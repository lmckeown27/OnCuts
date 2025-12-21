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
    const privateKeyHex = process.env.PETRA_PRIVATEKEY || process.env.APTOS_PLATFORM_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('PETRA_PRIVATEKEY not configured. Please set PETRA_PRIVATEKEY in your .env file');
    }

    const privateKey = new HexString(privateKeyHex);
    this.platformAccount = new AptosAccount(privateKey.toUint8Array());
    
    this.moduleAddress = process.env.APTOS_PLATFORM_ADDRESS || this.platformAccount.address().hex();
    
    logger.info(`🔗 Aptos Service initialized: ${nodeUrl}`);
    logger.info(`📍 Platform Address: ${this.moduleAddress}`);
  }

  /**
   * Helper to submit transactions to module functions
   */
  private async executeModuleFunction(
    moduleName: string,
    funcName: string,
    typeArguments: string[],
    functionArgs: any[]
  ): Promise<string> {
    try {
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::${moduleName}::${funcName}`,
        type_arguments: typeArguments,
        arguments: functionArgs,
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
      logger.error(`Transaction failed (${moduleName}::${funcName}):`, error);
      throw error;
    }
  }

  /**
   * Initialize all smart contract modules
   */
  async initializeModules(): Promise<void> {
    try {
      await this.executeModuleFunction('booking_system', 'initialize', [], []);
      await this.executeModuleFunction('review_system', 'initialize', [], []);
      await this.executeModuleFunction('barber_registry', 'initialize', [], []);
      await this.executeModuleFunction('payment_system', 'initialize', [], []);
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

    return await this.executeModuleFunction(
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
  }

  /**
   * Confirm a booking
   */
  async confirmBooking(barberAddress: string, bookingId: number): Promise<string> {
    return await this.executeModuleFunction(
      'booking_system',
      'confirm_booking',
      [],
      [this.moduleAddress, bookingId]
    );
  }

  /**
   * Complete a booking
   */
  async completeBooking(bookingId: number): Promise<string> {
    return await this.executeModuleFunction(
      'booking_system',
      'complete_booking',
      [],
      [this.moduleAddress, bookingId]
    );
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number): Promise<string> {
    return await this.executeModuleFunction(
      'booking_system',
      'cancel_booking',
      [],
      [this.moduleAddress, bookingId]
    );
  }

  /**
   * Register a barber on-chain
   */
  async registerBarber(params: {
    barberAddress: string;
    campusId: number;
    specialties: string[];
    bioHash: string;
    pricingHash: string;
  }): Promise<string> {
    const { barberAddress, campusId, specialties, bioHash, pricingHash } = params;

    return await this.executeModuleFunction(
      'barber_registry',
      'register_barber',
      [],
      [
        barberAddress,
        campusId,
        specialties,
        Array.from(Buffer.from(bioHash, 'utf-8')),
        Array.from(Buffer.from(pricingHash, 'utf-8')),
      ]
    );
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

    return await this.executeModuleFunction(
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

    return await this.executeModuleFunction(
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
  }

  /**
   * Release payment to barber
   */
  async releasePayment(paymentId: number): Promise<string> {
    return await this.executeModuleFunction(
      'payment_system',
      'release_payment',
      [],
      [paymentId]
    );
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
   * Get account balance in APT
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

  // ==========================================
  // USDC ESCROW METHODS
  // ==========================================

  /**
   * Create USDC escrow for a booking
   * Locks USDC in smart contract until service completion
   * 
   * Gas: Paid by platform's APT wallet
   */
  async createUsdcEscrow(params: {
    bookingId: string;
    amountUsdc: number;
    barberAddress: string;
    consumerAddress: string;
    stripePaymentId: string;
  }): Promise<string> {
    const { bookingId, amountUsdc, barberAddress, consumerAddress, stripePaymentId } = params;

    try {
      // Convert booking ID to bytes
      const bookingIdBytes = Buffer.from(bookingId).toString('hex');
      
      // Convert USDC amount to on-chain format (6 decimals)
      const amountUsdcOnChain = Math.floor(amountUsdc * 1_000_000);

      // Convert Stripe payment ID to bytes
      const stripeIdBytes = Buffer.from(stripePaymentId).toString('hex');

      logger.info('🔒 Creating USDC escrow on-chain', {
        booking_id: bookingId,
        amount_usdc: amountUsdc,
        amount_on_chain: amountUsdcOnChain,
      });

      const txHash = await this.executeModuleFunction(
        'usdc_escrow',
        'create_escrow',
        [], // No type arguments
        [
          `0x${bookingIdBytes}`,
          amountUsdcOnChain,
          barberAddress,
          consumerAddress,
          `0x${stripeIdBytes}`,
        ]
      );

      logger.info('✅ USDC escrow created', {
        booking_id: bookingId,
        tx_hash: txHash,
      });

      return txHash;
    } catch (error: any) {
      logger.error('❌ Failed to create USDC escrow', {
        booking_id: bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Release USDC from escrow to barber (95%) and platform (5%)
   * Called after service completion and consumer confirmation
   * 
   * Gas: Paid by platform's APT wallet
   */
  async releaseUsdcEscrow(bookingId: string): Promise<string> {
    try {
      const bookingIdBytes = Buffer.from(bookingId).toString('hex');

      logger.info('💸 Releasing USDC escrow', { booking_id: bookingId });

      const txHash = await this.executeModuleFunction(
        'usdc_escrow',
        'release_payment',
        [], // No type arguments
        [`0x${bookingIdBytes}`]
      );

      logger.info('✅ USDC escrow released', {
        booking_id: bookingId,
        tx_hash: txHash,
      });

      return txHash;
    } catch (error: any) {
      logger.error('❌ Failed to release USDC escrow', {
        booking_id: bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Refund USDC from escrow back to consumer (100%)
   * Called if booking is cancelled before service
   * 
   * Gas: Paid by platform's APT wallet
   */
  async refundUsdcEscrow(bookingId: string): Promise<string> {
    try {
      const bookingIdBytes = Buffer.from(bookingId).toString('hex');

      logger.info('↩️  Refunding USDC escrow', { booking_id: bookingId });

      const txHash = await this.executeModuleFunction(
        'usdc_escrow',
        'refund_payment',
        [], // No type arguments
        [`0x${bookingIdBytes}`]
      );

      logger.info('✅ USDC escrow refunded', {
        booking_id: bookingId,
        tx_hash: txHash,
      });

      return txHash;
    } catch (error: any) {
      logger.error('❌ Failed to refund USDC escrow', {
        booking_id: bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get escrow details from blockchain
   */
  async getEscrowDetails(bookingId: string): Promise<{
    amount_usdc: number;
    barber_payout_usdc: number;
    platform_fee_usdc: number;
    status: number;
    barber_address: string;
    consumer_address: string;
  }> {
    try {
      const bookingIdBytes = Buffer.from(bookingId).toString('hex');

      const result = await this.client.view({
        function: `${this.moduleAddress}::usdc_escrow::get_escrow`,
        type_arguments: [],
        arguments: [this.moduleAddress, `0x${bookingIdBytes}`],
      });

      const [amount, barberPayout, platformFee, status, barberAddr, consumerAddr] = result as [
        string,
        string,
        string,
        number,
        string,
        string
      ];

      return {
        amount_usdc: parseInt(amount) / 1_000_000,
        barber_payout_usdc: parseInt(barberPayout) / 1_000_000,
        platform_fee_usdc: parseInt(platformFee) / 1_000_000,
        status,
        barber_address: barberAddr,
        consumer_address: consumerAddr,
      };
    } catch (error: any) {
      logger.error('❌ Failed to get escrow details', {
        booking_id: bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get platform address
   */
  getPlatformAddress(): string {
    return this.platformAccount.address().hex();
  }

  /**
   * Generate new Aptos account
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
   * Submit batched withdrawals with gas validation
   */
  async submitBatchWithdrawal(
    recipients: (string | undefined)[],
    amounts: number[]
  ): Promise<string> {
    try {
      const validRecipients = recipients.filter((r): r is string => r !== undefined);
      
      if (validRecipients.length === 0) {
        throw new Error('No valid recipients for batch withdrawal');
      }

      if (validRecipients.length !== amounts.length) {
        throw new Error('Recipients and amounts length mismatch');
      }

      const platformBalance = await this.getAccountBalance(this.platformAccount.address().hex());
      const gasEstimate = gasCalculatorService.calculateBatchWithdrawalGas(validRecipients.length);
      
      logger.info('🔍 Batch withdrawal gas validation:', {
        platformBalance: platformBalance.toFixed(8),
        gasRequired: gasEstimate.totalWithBufferAPT.toFixed(8),
        gasUnits: gasEstimate.gasUnits,
        recipientCount: validRecipients.length,
        totalAmountAPT: (amounts.reduce((sum, a) => sum + a, 0) / 100_000_000).toFixed(8),
      });

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
   * Submit hash proof to blockchain for anchoring
   */
  async submitHashProof(
    recordType: string,
    subjectId: string,
    dataHash: string
  ): Promise<string> {
    try {
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::hash_registry::store_hash`,
        type_arguments: [],
        arguments: [dataHash, recordType, subjectId],
      };

      const rawTxn = await this.client.generateTransaction(
        this.platformAccount.address(),
        payload
      );

      const signedTxn = await this.client.signTransaction(this.platformAccount, rawTxn);
      const txResponse = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(txResponse.hash);

      logger.info(`Hash proof submitted: ${txResponse.hash}`, {
        record_type: recordType,
        subject_id: subjectId,
      });

      return txResponse.hash;
    } catch (error) {
      logger.error(`Failed to submit hash proof:`, error);
      throw error;
    }
  }
}

export default new AptosService();

