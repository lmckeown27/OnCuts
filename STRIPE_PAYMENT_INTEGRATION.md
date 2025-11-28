# CampusCuts Stripe Payment Integration

**Version:** 2.0 (Production-Grade with V2 Custodial Wallet)  
**Type:** Fiat Payment Processing (Credit/Debit Cards → Internal Ledger)  
**Purpose:** Convert traditional payments into custodial wallet balances

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Frontend Integration](#frontend-integration)
4. [Backend Services](#backend-services)
5. [Custodial Wallet Integration](#custodial-wallet-integration)
6. [Payment Flows](#payment-flows)
7. [Stripe Connect for Payouts](#stripe-connect-for-payouts)
8. [Webhook Handling](#webhook-handling)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

---

## Overview

### What is Stripe in CampusCuts?

Stripe serves as the **bridge between the traditional payment world and the custodial wallet system**:

- **Students pay with:** Credit/Debit cards, Apple Pay, Google Pay
- **Platform receives:** USD via Stripe
- **Platform credits:** User's internal custodial wallet balance
- **Barbers withdraw:** Via Stripe Connect (instant payout)

### Payment Philosophy

```
Traditional Payment → Stripe → Platform → Internal Ledger → Services → Payout
```

**Key Principle:** Students never see crypto, blockchain, or wallets - just familiar card payments.

### Stripe Products Used

1. **Stripe Payment Intents** - For customer deposits
2. **Stripe Connect** - For barber payouts
3. **Stripe Webhooks** - For event handling
4. **Stripe Elements** - For frontend UI

---

## Architecture

### High-Level Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT (Frontend)                            │
│                                                                  │
│  [Add Funds to Wallet] → Clicks "Add $50"                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. POST /api/v2/wallet/deposit/create
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND (Payment Service)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐        │
│  │ Payment-V2 Service                                  │        │
│  │  - Create Stripe Payment Intent                     │        │
│  │  - Amount: $50.00 = 5000 cents                     │        │
│  │  - Return client_secret to frontend                 │        │
│  └────────────────────────────────────────────────────┘        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 2. Returns client_secret
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Stripe.js)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐        │
│  │ Stripe Elements                                      │        │
│  │  - Renders card input form                           │        │
│  │  - Student enters card details                       │        │
│  │  - Stripe.confirmCardPayment(client_secret)         │        │
│  └────────────────────────────────────────────────────┘        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 3. Card details sent to Stripe (PCI compliant)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STRIPE                                   │
│                                                                  │
│  - Processes payment                                             │
│  - Charges card $50.00                                          │
│  - Deducts 2.9% + $0.30 = $1.75 (Stripe fee)                   │
│  - Platform receives: $48.25                                    │
│  - Sends webhook: payment_intent.succeeded                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 4. Webhook: payment_intent.succeeded
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (Webhook Handler)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐        │
│  │ Payment Webhook Handler                              │        │
│  │  1. Verify webhook signature                         │        │
│  │  2. Extract payment_intent.id                        │        │
│  │  3. Call Transaction Service                         │        │
│  └────────────────────────────────────────────────────┘        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 5. Credit user balance
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           CUSTODIAL WALLET (Transaction Service)                 │
│                                                                  │
│  BEGIN TRANSACTION;                                              │
│                                                                  │
│  UPDATE balances                                                 │
│  SET available_amount = available_amount + 5000                  │
│  WHERE user_id = 'student-123';                                 │
│                                                                  │
│  INSERT INTO transactions (                                      │
│    user_id: 'student-123',                                      │
│    type: 'deposit',                                             │
│    amount: 5000,                                                │
│    status: 'completed',                                         │
│    metadata: { stripe_payment_intent_id: 'pi_...' }            │
│  );                                                              │
│                                                                  │
│  COMMIT;                                                         │
│                                                                  │
│  Result: Student's wallet now has +$50.00 available             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Integration

### 1. React Frontend Setup

**File:** `web-app/src/pages/WalletPage.tsx`

**Dependencies:**
```json
{
  "@stripe/react-stripe-js": "^2.4.0",
  "@stripe/stripe-js": "^2.2.0"
}
```

**Stripe Provider Setup:**

```typescript
// web-app/src/main.tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Initialize Stripe.js with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function App() {
  return (
    <Elements stripe={stripePromise}>
      <WalletPage />
    </Elements>
  );
}
```

### 2. Deposit Flow (Frontend)

**Step 1: Create Payment Intent**

```typescript
// web-app/src/pages/WalletPage.tsx
import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import walletV2Service from '../services/wallet-v2.service';

const WalletPage = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [depositAmount, setDepositAmount] = useState(50); // dollars

  const handleDeposit = async () => {
    // 1. Create Payment Intent on backend
    const { client_secret } = await walletV2Service.createDepositIntent({
      amount_dollars: depositAmount,
    });

    // 2. Confirm payment with Stripe
    if (!stripe || !elements) {
      return; // Stripe.js has not loaded yet
    }

    const cardElement = elements.getElement(CardElement);

    const { error, paymentIntent } = await stripe.confirmCardPayment(
      client_secret,
      {
        payment_method: {
          card: cardElement!,
          billing_details: {
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          },
        },
      }
    );

    if (error) {
      // Handle error
      toast.error(`Payment failed: ${error.message}`);
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      toast.success('Deposit successful! Your balance will update shortly.');
      // Refresh balance
      await loadBalance();
    }
  };

  return (
    <div>
      <h2>Add Funds to Wallet</h2>
      <input
        type="number"
        value={depositAmount}
        onChange={(e) => setDepositAmount(Number(e.target.value))}
        min={10}
        max={1000}
      />
      <CardElement />
      <button onClick={handleDeposit}>
        Add ${depositAmount}
      </button>
    </div>
  );
};
```

**Step 2: Card Element Component**

```typescript
// web-app/src/components/StripeCardInput.tsx
import { CardElement } from '@stripe/react-stripe-js';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
};

export const StripeCardInput = () => {
  return (
    <div className="stripe-card-input">
      <label>Card Details</label>
      <CardElement options={CARD_ELEMENT_OPTIONS} />
    </div>
  );
};
```

### 3. Frontend Service

**File:** `web-app/src/services/wallet-v2.service.ts`

```typescript
class WalletV2Service {
  /**
   * Create a deposit intent (Step 1 of deposit flow)
   */
  async createDepositIntent(params: {
    amount_dollars: number;
  }): Promise<{
    client_secret: string;
    payment_intent_id: string;
    amount_cents: number;
  }> {
    const response = await apiService.post<{
      client_secret: string;
      payment_intent_id: string;
      amount_cents: number;
    }>('/v2/wallet/deposit/create', {
      amount_dollars: params.amount_dollars,
    });

    return response;
  }

  /**
   * Get deposit history
   */
  async getDepositHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    deposits: Array<{
      id: string;
      amount_dollars: number;
      stripe_payment_intent_id: string;
      status: string;
      created_at: string;
    }>;
    total: number;
  }> {
    const response = await apiService.get('/v2/wallet/deposits', { params });
    return response;
  }
}

export default new WalletV2Service();
```

---

## Backend Services

### 1. Stripe Service (Core)

**File:** `backend/src/services/stripe.service.ts`

**Purpose:** Direct Stripe API integration

```typescript
import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

class StripeService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });

    logger.info('✅ Stripe Service initialized');
  }

  /**
   * Create Payment Intent for deposit
   * This is Step 1 of the deposit flow
   */
  async createPaymentIntent(params: {
    amount: number; // cents
    currency?: string;
    customerId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    try {
      const { amount, currency = 'usd', customerId, metadata } = params;

      logger.info('Creating Stripe Payment Intent', {
        amount_dollars: amount / 100,
        currency,
        customer_id: customerId,
      });

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        metadata: {
          platform: 'CampusCuts',
          ...metadata,
        },
        // Automatic payment methods (card, Apple Pay, Google Pay)
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('✅ Payment Intent created', {
        payment_intent_id: paymentIntent.id,
        amount_dollars: amount / 100,
        client_secret: paymentIntent.client_secret?.substring(0, 20) + '...',
      });

      return paymentIntent;
    } catch (error: any) {
      logger.error('❌ Failed to create Payment Intent', {
        error: error.message,
        amount: params.amount,
      });
      throw new ApiError(500, 'Payment creation failed');
    }
  }

  /**
   * Retrieve Payment Intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      logger.error('Failed to retrieve Payment Intent', {
        payment_intent_id: paymentIntentId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to retrieve payment');
    }
  }

  /**
   * Create refund for Payment Intent
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number; // cents (optional, defaults to full refund)
    reason?: string;
  }): Promise<Stripe.Refund> {
    try {
      const { paymentIntentId, amount, reason } = params;

      logger.info('Creating refund', {
        payment_intent_id: paymentIntentId,
        amount_dollars: amount ? amount / 100 : 'full',
        reason,
      });

      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: reason as Stripe.RefundCreateParams.Reason,
        metadata: {
          platform: 'CampusCuts',
        },
      });

      logger.info('✅ Refund created', {
        refund_id: refund.id,
        amount_dollars: refund.amount / 100,
        status: refund.status,
      });

      return refund;
    } catch (error: any) {
      logger.error('❌ Failed to create refund', {
        payment_intent_id: params.paymentIntentId,
        error: error.message,
      });
      throw new ApiError(500, 'Refund failed');
    }
  }

  /**
   * Construct webhook event (verify signature)
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      logger.error('❌ Webhook signature verification failed', {
        error: error.message,
      });
      throw new ApiError(400, 'Invalid webhook signature');
    }
  }

  // === STRIPE CONNECT (for barber payouts) ===

  /**
   * Create Stripe Connect account for barber
   */
  async createConnectAccount(params: {
    email: string;
    barberId: string;
    businessType?: 'individual' | 'company';
  }): Promise<Stripe.Account> {
    try {
      const { email, barberId, businessType = 'individual' } = params;

      logger.info('Creating Stripe Connect account', {
        email,
        barber_id: barberId,
      });

      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email,
        business_type: businessType,
        metadata: {
          platform: 'CampusCuts',
          barber_id: barberId,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      logger.info('✅ Connect account created', {
        account_id: account.id,
        barber_id: barberId,
      });

      return account;
    } catch (error: any) {
      logger.error('❌ Failed to create Connect account', {
        error: error.message,
      });
      throw new ApiError(500, 'Failed to create payout account');
    }
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      logger.info('Account link created', {
        account_id: accountId,
        url: accountLink.url,
      });

      return accountLink.url;
    } catch (error: any) {
      logger.error('Failed to create account link', {
        account_id: accountId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to create onboarding link');
    }
  }

  /**
   * Create payout to barber's bank account
   */
  async createPayout(params: {
    amount: number; // cents
    stripeAccountId: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Payout> {
    try {
      const { amount, stripeAccountId, metadata } = params;

      logger.info('Creating payout', {
        amount_dollars: amount / 100,
        stripe_account_id: stripeAccountId,
      });

      const payout = await this.stripe.payouts.create(
        {
          amount,
          currency: 'usd',
          metadata: {
            platform: 'CampusCuts',
            ...metadata,
          },
        },
        {
          stripeAccount: stripeAccountId,
        }
      );

      logger.info('✅ Payout created', {
        payout_id: payout.id,
        amount_dollars: amount / 100,
        status: payout.status,
      });

      return payout;
    } catch (error: any) {
      logger.error('❌ Payout failed', {
        stripe_account_id: params.stripeAccountId,
        error: error.message,
      });
      throw new ApiError(500, 'Payout failed');
    }
  }
}

export default new StripeService();
```

### 2. Payment V2 Service (Wallet Integration)

**File:** `backend/src/services/payment-v2.service.ts`

**Purpose:** Bridge between Stripe and Custodial Wallet

```typescript
import stripeService from './stripe.service';
import transactionService from './transaction.service';
import auditService from './audit.service';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

class PaymentServiceV2 {
  /**
   * Create deposit intent (Step 1)
   * Called by frontend to initiate deposit
   */
  async createDepositIntent(
    userId: string,
    amountCents: number
  ): Promise<{
    client_secret: string;
    payment_intent_id: string;
    amount_cents: number;
  }> {
    try {
      if (amountCents < 1000) {
        throw new ApiError(400, 'Minimum deposit is $10.00');
      }

      if (amountCents > 100000) {
        throw new ApiError(400, 'Maximum deposit is $1,000.00');
      }

      logger.info('Creating deposit intent', {
        user_id: userId,
        amount_dollars: amountCents / 100,
      });

      // Create Stripe Payment Intent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: amountCents,
        metadata: {
          user_id: userId,
          type: 'wallet_deposit',
        },
      });

      // Audit log
      await auditService.createLog({
        user_id: userId,
        action: 'DEPOSIT_INTENT_CREATED',
        entity_type: 'payment_intent',
        entity_id: paymentIntent.id,
        metadata: {
          amount_cents: amountCents,
        },
      });

      return {
        client_secret: paymentIntent.client_secret!,
        payment_intent_id: paymentIntent.id,
        amount_cents: amountCents,
      };
    } catch (error) {
      logger.error('Failed to create deposit intent', {
        user_id: userId,
        amount_cents: amountCents,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle successful deposit (called by webhook)
   * This is Step 2 - after Stripe confirms payment
   */
  async handleDepositSuccess(
    paymentIntentId: string
  ): Promise<void> {
    try {
      // 1. Get Payment Intent from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        logger.warn('Payment Intent not succeeded', {
          payment_intent_id: paymentIntentId,
          status: paymentIntent.status,
        });
        return;
      }

      const userId = paymentIntent.metadata.user_id;
      const amountCents = paymentIntent.amount;

      logger.info('Processing successful deposit', {
        payment_intent_id: paymentIntentId,
        user_id: userId,
        amount_dollars: amountCents / 100,
      });

      // 2. Credit user's custodial wallet
      const transaction = await transactionService.credit(
        userId,
        amountCents,
        'deposit',
        {
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: paymentIntent.latest_charge,
        },
        `Wallet deposit via Stripe - $${(amountCents / 100).toFixed(2)}`
      );

      // 3. Audit log
      await auditService.createLog({
        user_id: userId,
        action: 'DEPOSIT_SUCCESS',
        entity_type: 'transaction',
        entity_id: transaction.id.toString(),
        metadata: {
          amount_cents: amountCents,
          payment_intent_id: paymentIntentId,
        },
      });

      logger.info('✅ Deposit completed successfully', {
        user_id: userId,
        amount_dollars: amountCents / 100,
        transaction_id: transaction.id,
      });
    } catch (error) {
      logger.error('❌ Failed to handle deposit success', {
        payment_intent_id: paymentIntentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Refund deposit
   */
  async refundDeposit(
    userId: string,
    transactionId: number,
    reason: string
  ): Promise<void> {
    try {
      // 1. Get original transaction
      const transaction = await transactionService.getTransactionById(transactionId);

      if (transaction.user_id !== userId) {
        throw new ApiError(403, 'Unauthorized');
      }

      if (transaction.type !== 'deposit') {
        throw new ApiError(400, 'Only deposits can be refunded');
      }

      const paymentIntentId = transaction.metadata?.stripe_payment_intent_id;
      if (!paymentIntentId) {
        throw new ApiError(400, 'Payment Intent ID not found');
      }

      logger.info('Processing deposit refund', {
        user_id: userId,
        transaction_id: transactionId,
        amount_dollars: transaction.amount / 100,
      });

      // 2. Create Stripe refund
      const refund = await stripeService.createRefund({
        paymentIntentId,
        reason,
      });

      // 3. Debit user's wallet (reverse the deposit)
      await transactionService.debit(
        userId,
        transaction.amount,
        'refund',
        {
          original_transaction_id: transactionId,
          stripe_refund_id: refund.id,
        },
        `Refund for deposit - ${reason}`
      );

      // 4. Audit log
      await auditService.createLog({
        user_id: userId,
        action: 'DEPOSIT_REFUNDED',
        entity_type: 'transaction',
        entity_id: transactionId.toString(),
        metadata: {
          amount_cents: transaction.amount,
          refund_id: refund.id,
          reason,
        },
      });

      logger.info('✅ Deposit refunded successfully', {
        user_id: userId,
        transaction_id: transactionId,
        refund_id: refund.id,
      });
    } catch (error) {
      logger.error('❌ Failed to refund deposit', {
        user_id: userId,
        transaction_id: transactionId,
        error,
      });
      throw error;
    }
  }
}

export default new PaymentServiceV2();
```

---

## Custodial Wallet Integration

### How Stripe Connects to the Wallet

```
┌─────────────────────────────────────────────────────────────────┐
│                    STRIPE PAYMENT FLOW                           │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Create Payment Intent
┌─────────────────┐
│ Student         │  "I want to add $50 to my wallet"
└────────┬────────┘
         │
         │ POST /api/v2/wallet/deposit/create
         │ { amount_dollars: 50 }
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Payment-V2 Service                                               │
│                                                                  │
│  createDepositIntent(userId, 5000 cents)                        │
│    ↓                                                             │
│  Stripe.createPaymentIntent({                                   │
│    amount: 5000,                                                │
│    metadata: { user_id: 'student-123' }                        │
│  })                                                              │
│    ↓                                                             │
│  Returns: { client_secret: "pi_xxx_secret_yyy" }               │
└─────────────────────────────────────────────────────────────────┘

STEP 2: Student Pays with Card (handled by Stripe.js on frontend)
┌─────────────────┐
│ Student         │  Enters card details in Stripe Elements
└────────┬────────┘
         │
         │ Stripe.confirmCardPayment(client_secret, card_details)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stripe                                                           │
│                                                                  │
│  - Charges card: $50.00                                         │
│  - Deducts fee: $1.75 (2.9% + $0.30)                           │
│  - Platform net: $48.25                                         │
│  - Status: "succeeded"                                          │
│  - Sends webhook to backend                                     │
└─────────────────────────────────────────────────────────────────┘

STEP 3: Webhook Handler (automatic, triggered by Stripe)
┌─────────────────────────────────────────────────────────────────┐
│ Webhook Controller                                               │
│                                                                  │
│  POST /api/webhooks/stripe                                      │
│  Event: payment_intent.succeeded                                │
│    ↓                                                             │
│  1. Verify signature (security check)                           │
│  2. Extract payment_intent.id                                   │
│  3. Call PaymentServiceV2.handleDepositSuccess()                │
└─────────────────────────────────────────────────────────────────┘

STEP 4: Credit Custodial Wallet
┌─────────────────────────────────────────────────────────────────┐
│ Payment-V2 Service                                               │
│                                                                  │
│  handleDepositSuccess(payment_intent_id)                        │
│    ↓                                                             │
│  1. Get PaymentIntent from Stripe                               │
│     amount: 5000 cents                                          │
│     user_id: 'student-123'                                      │
│                                                                  │
│  2. Call TransactionService.credit()                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Transaction Service (Custodial Wallet Core)                     │
│                                                                  │
│  BEGIN TRANSACTION;                                              │
│                                                                  │
│  -- Lock user's balance row                                     │
│  SELECT * FROM balances WHERE user_id = 'student-123' FOR UPDATE;│
│                                                                  │
│  -- Credit available balance                                    │
│  UPDATE balances                                                 │
│  SET available_amount = available_amount + 5000                  │
│  WHERE user_id = 'student-123';                                 │
│                                                                  │
│  -- Create transaction record                                   │
│  INSERT INTO transactions (                                      │
│    user_id: 'student-123',                                      │
│    type: 'deposit',                                             │
│    amount: 5000,                                                │
│    status: 'completed',                                         │
│    metadata: {                                                  │
│      stripe_payment_intent_id: 'pi_xxx',                       │
│      stripe_charge_id: 'ch_xxx'                                │
│    }                                                             │
│  );                                                              │
│                                                                  │
│  COMMIT;                                                         │
│                                                                  │
│  ✅ Student's wallet: +$50.00 available                         │
└─────────────────────────────────────────────────────────────────┘
```

### Database Records

**After successful $50 deposit:**

**`balances` table:**
```sql
user_id      | available_amount | pending_amount | currency
-------------|------------------|----------------|----------
student-123  | 5000            | 0              | USD
```

**`transactions` table:**
```sql
id | user_id      | type    | amount | status     | metadata
---|--------------|---------|--------|------------|---------------------------
1  | student-123  | deposit | 5000   | completed  | {"stripe_payment_intent_id": "pi_xxx"}
```

**`audit_logs` table:**
```sql
id | user_id      | action           | entity_type | entity_id | created_at
---|--------------|------------------|-------------|-----------|------------
1  | student-123  | DEPOSIT_INTENT   | payment     | pi_xxx    | 2025-11-28
2  | student-123  | DEPOSIT_SUCCESS  | transaction | 1         | 2025-11-28
```

---

## Payment Flows

### Flow 1: Student Deposits Money

**Detailed Step-by-Step:**

```
1. Student clicks "Add $50" in wallet page
   ↓
2. Frontend calls: POST /api/v2/wallet/deposit/create
   Request: { amount_dollars: 50 }
   ↓
3. Backend creates Stripe Payment Intent
   Amount: 5000 cents
   Returns: { client_secret: "pi_xxx_secret_yyy" }
   ↓
4. Frontend receives client_secret
   Renders Stripe Card Element
   ↓
5. Student enters card details:
   - Card number: 4242 4242 4242 4242
   - Expiry: 12/25
   - CVC: 123
   ↓
6. Frontend calls: stripe.confirmCardPayment(client_secret, card)
   This sends card details DIRECTLY to Stripe (not our server)
   ↓
7. Stripe processes payment:
   - Charges card: $50.00
   - Deducts fee: $1.75
   - Platform receives: $48.25
   - Status changes to "succeeded"
   ↓
8. Stripe sends webhook to: POST /api/webhooks/stripe
   Event: payment_intent.succeeded
   Payload: {
     type: "payment_intent.succeeded",
     data: {
       object: {
         id: "pi_xxx",
         amount: 5000,
         status: "succeeded",
         metadata: { user_id: "student-123" }
       }
     }
   }
   ↓
9. Backend webhook handler:
   - Verifies signature (security)
   - Calls PaymentServiceV2.handleDepositSuccess("pi_xxx")
   ↓
10. PaymentServiceV2:
    - Gets PaymentIntent from Stripe
    - Extracts user_id and amount
    - Calls TransactionService.credit(user_id, 5000)
    ↓
11. TransactionService (atomic):
    BEGIN TRANSACTION;
      UPDATE balances SET available_amount += 5000
      INSERT INTO transactions (...)
    COMMIT;
    ↓
12. ✅ Student's wallet updated: +$50.00
    Frontend shows success message
    Balance auto-refreshes
```

### Flow 2: Booking Payment (with Escrow)

**How Stripe deposit enables booking:**

```
Student has deposited $50 via Stripe
  ↓
Student's wallet balance: $50.00 available
  ↓
Student books $30 haircut
  ↓
Escrow Service creates hold:
  - Student available: $50 → $20 (debited $30)
  - Barber pending: $0 → $30 (credited $30)
  - Escrow hold created (expires in 48h)
  ↓
Barber completes haircut
  ↓
Escrow Service releases hold:
  - Barber pending: $30 → $0 (debited $30)
  - Barber available: $0 → $28.50 (credited net amount)
  - Platform fees: +$1.50 (5% commission)
  ↓
Barber withdraws $28.50 via Stripe Connect
```

**Key Point:** The initial Stripe deposit ($50) enables all internal transactions (booking, tips, etc.) to happen **off-chain** and **instantly** in the custodial wallet.

---

## Stripe Connect for Payouts

### Barber Onboarding Flow

```
1. Barber signs up on CampusCuts
   ↓
2. Barber completes first haircut
   Has $28.50 in available balance
   ↓
3. Barber clicks "Withdraw to Bank"
   ↓
4. Backend checks: Does barber have Stripe Connect account?
   If NO:
     ↓
   5. Backend creates Stripe Connect Express account
      POST /api/barber/connect/create
      ↓
   6. Stripe returns account ID: "acct_xxx"
      Backend saves to database
      ↓
   7. Backend creates Account Link for onboarding
      Returns URL: "https://connect.stripe.com/setup/..."
      ↓
   8. Frontend redirects barber to Stripe onboarding
      Barber enters:
        - Legal name
        - SSN (for tax purposes)
        - Date of birth
        - Bank account details
      ↓
   9. Stripe verifies identity
      ↓
   10. Stripe redirects back to CampusCuts:
       "https://campuscuts.com/barber/connect/return?success=true"
       ↓
   11. Backend updates barber record:
       stripe_account_id: "acct_xxx"
       payout_enabled: true
       ↓
   12. ✅ Barber can now withdraw funds
```

### Withdrawal Flow (Bank Payout)

```
1. Barber has $28.50 available in wallet
   ↓
2. Barber clicks "Withdraw to Bank"
   Frontend: POST /api/v2/wallet/withdraw/bank
   Request: { amount_dollars: 28.50 }
   ↓
3. Backend (PayoutServiceV2):
   - Validates barber has Stripe Connect account
   - Debits wallet: available -= 2850 cents
   - Creates transaction record (type: 'bank_withdrawal')
   ↓
4. Backend creates Stripe Payout:
   stripe.payouts.create({
     amount: 2850,
     currency: 'usd'
   }, {
     stripeAccount: barber.stripe_account_id
   })
   ↓
5. Stripe transfers money to barber's bank:
   - Standard payout: 1-2 business days
   - Instant payout: Available within minutes (small fee)
   ↓
6. Stripe sends webhook: payout.paid
   ↓
7. Backend updates withdrawal status: 'completed'
   ↓
8. ✅ Barber receives $28.50 in bank account
```

---

## Webhook Handling

### Webhook Controller

**File:** `backend/src/controllers/webhook.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import stripeService from '../services/stripe.service';
import paymentServiceV2 from '../services/payment-v2.service';
import { logger } from '../utils/logger';

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 * 
 * Handles all Stripe events via webhooks
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Webhook received without signature');
      return res.status(400).json({ error: 'No signature' });
    }

    // Construct event (verifies signature)
    const event = stripeService.constructWebhookEvent(
      req.body, // raw body (not parsed as JSON)
      signature
    );

    logger.info('Stripe webhook received', {
      event_type: event.type,
      event_id: event.id,
    });

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;

      case 'payout.paid':
        await handlePayoutPaid(event);
        break;

      case 'payout.failed':
        await handlePayoutFailed(event);
        break;

      default:
        logger.info('Unhandled webhook event type', {
          event_type: event.type,
        });
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook handling failed', error);
    // Return 400 for invalid signatures
    // Stripe will retry later for 500 errors
    next(error);
  }
};

/**
 * Handle successful payment
 */
async function handlePaymentIntentSucceeded(event: any) {
  const paymentIntent = event.data.object;
  
  logger.info('Processing payment_intent.succeeded', {
    payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount,
  });

  await paymentServiceV2.handleDepositSuccess(paymentIntent.id);
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(event: any) {
  const paymentIntent = event.data.object;
  
  logger.error('Payment failed', {
    payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount,
    failure_message: paymentIntent.last_payment_error?.message,
  });

  // Could send notification to user
  // await notificationService.send(...)
}

/**
 * Handle refund completed
 */
async function handleChargeRefunded(event: any) {
  const charge = event.data.object;
  
  logger.info('Refund processed', {
    charge_id: charge.id,
    refund_amount: charge.amount_refunded,
  });

  // The refund was initiated by our backend (payment-v2.service.ts)
  // Transaction was already debited when refund was created
  // No additional action needed
}

/**
 * Handle successful payout to barber
 */
async function handlePayoutPaid(event: any) {
  const payout = event.data.object;
  
  logger.info('Payout completed', {
    payout_id: payout.id,
    amount: payout.amount,
    destination: payout.destination,
  });

  // Update withdrawal request status in database
  // await withdrawalService.markCompleted(payout.metadata.withdrawal_id);
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(event: any) {
  const payout = event.data.object;
  
  logger.error('Payout failed', {
    payout_id: payout.id,
    amount: payout.amount,
    failure_message: payout.failure_message,
  });

  // Refund barber's wallet balance
  // Send notification to barber
}
```

### Webhook Route

**File:** `backend/src/routes/webhook.routes.ts`

```typescript
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhook.controller';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * 
 * IMPORTANT: This route must use raw body, not JSON parsed body
 * Configure in index.ts:
 * 
 * app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);
 */
router.post('/stripe', handleStripeWebhook);

export default router;
```

### Webhook Setup in Main App

**File:** `backend/src/index.ts`

```typescript
import webhookRoutes from './routes/webhook.routes';

// IMPORTANT: Webhook route MUST come BEFORE express.json() middleware
// Stripe requires raw body to verify signature
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

// All other routes use JSON body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... rest of routes
```

---

## Error Handling

### Common Stripe Errors

**1. Insufficient Funds**
```typescript
// Error from Stripe
{
  type: 'card_error',
  code: 'insufficient_funds',
  message: 'Your card has insufficient funds.'
}

// Frontend handling
if (error.code === 'insufficient_funds') {
  toast.error('Your card was declined due to insufficient funds.');
}
```

**2. Card Declined**
```typescript
// Error from Stripe
{
  type: 'card_error',
  code: 'card_declined',
  message: 'Your card was declined.'
}

// Frontend handling
toast.error('Your card was declined. Please try a different card.');
```

**3. Invalid Card Number**
```typescript
// Error from Stripe Elements (caught before submission)
{
  type: 'validation_error',
  code: 'invalid_number',
  message: 'Your card number is invalid.'
}

// Frontend shows inline error under card field
```

### Backend Error Responses

```typescript
// Minimum deposit error
{
  success: false,
  error: {
    code: 'AMOUNT_TOO_LOW',
    message: 'Minimum deposit is $10.00',
  }
}

// Stripe API error
{
  success: false,
  error: {
    code: 'PAYMENT_FAILED',
    message: 'Payment creation failed',
    details: 'Invalid API key provided'
  }
}

// Webhook signature error
{
  success: false,
  error: {
    code: 'INVALID_SIGNATURE',
    message: 'Invalid webhook signature'
  }
}
```

---

## Testing

### Test Mode (Development)

**Stripe Test Cards:**

```typescript
// Successful payment
const TEST_CARD_SUCCESS = '4242424242424242';

// Requires authentication (3D Secure)
const TEST_CARD_3DS = '4000002500003155';

// Insufficient funds
const TEST_CARD_INSUFFICIENT = '4000000000009995';

// Card declined
const TEST_CARD_DECLINED = '4000000000000002';
```

### Frontend Testing

```typescript
// Test deposit in development
const testDeposit = async () => {
  const { client_secret } = await walletV2Service.createDepositIntent({
    amount_dollars: 50,
  });

  const result = await stripe.confirmCardPayment(client_secret, {
    payment_method: {
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
      },
    },
  });

  console.log('Payment result:', result);
};
```

### Backend Testing

**Test webhook locally with Stripe CLI:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payout.paid
```

### Integration Tests

```typescript
// backend/src/__tests__/payment-v2.test.ts
import paymentServiceV2 from '../services/payment-v2.service';

describe('Payment V2 Service', () => {
  it('should create deposit intent', async () => {
    const result = await paymentServiceV2.createDepositIntent(
      'user-123',
      5000
    );

    expect(result.client_secret).toBeDefined();
    expect(result.amount_cents).toBe(5000);
  });

  it('should reject amount below minimum', async () => {
    await expect(
      paymentServiceV2.createDepositIntent('user-123', 500)
    ).rejects.toThrow('Minimum deposit is $10.00');
  });

  it('should handle deposit success', async () => {
    const paymentIntentId = 'pi_test_123';
    
    await paymentServiceV2.handleDepositSuccess(paymentIntentId);
    
    // Verify user balance was credited
    const balance = await transactionService.getUserBalance('user-123');
    expect(balance.available_amount).toBeGreaterThan(0);
  });
});
```

---

## Summary

### Stripe in CampusCuts

**Role:** Bridge between traditional payments and custodial wallet

**Products Used:**
- ✅ Payment Intents (deposits)
- ✅ Stripe Connect (payouts)
- ✅ Webhooks (automation)
- ✅ Elements (frontend UI)

**Payment Flow:**
1. Student adds funds → Stripe Payment Intent
2. Stripe charges card → Webhook to backend
3. Backend credits wallet → Available for bookings
4. Booking completes → Barber earns money
5. Barber withdraws → Stripe Connect payout

**Benefits:**
- ✅ PCI compliant (Stripe handles card details)
- ✅ Instant wallet credits
- ✅ Fast payouts to barbers
- ✅ Familiar UX for students
- ✅ No crypto knowledge required

**Cost Structure:**
- Stripe fee: 2.9% + $0.30 per transaction
- Platform absorbs fees (included in 5% commission)
- Barbers receive full earnings

---

## See Also

- **CUSTODIAL_WALLET_ARCHITECTURE.md** - Wallet system deep-dive
- **BACKEND.md** - Complete backend documentation
- **FRONTEND.md** - Complete frontend documentation
- `backend/src/services/stripe.service.ts` - Stripe integration
- `backend/src/services/payment-v2.service.ts` - Wallet integration
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Connect Guide](https://stripe.com/docs/connect)

---

**Built with ❤️ for seamless fiat-to-crypto bridge**  
**Powered by Stripe + Custodial Wallet**

