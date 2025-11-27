/**
 * Admin Service
 * 
 * Platform management endpoints (admin-only)
 */

import api from './api.service';

export interface PlatformFees {
  available_fees_dollars: number;
  withdrawn_fees_dollars: number;
  available_count: number;
  withdrawn_count: number;
}

export interface ReconciliationReport {
  id: number;
  report_date: string;
  report_type: string;
  status: 'pending' | 'completed' | 'discrepancies' | 'failed';
  total_platform_balance_cents: number;
  total_user_balances_cents: number;
  total_escrow_cents: number;
  discrepancy_cents: number;
  discrepancies?: Array<{
    type: string;
    description: string;
    amount_cents: number;
    details: any;
  }>;
  created_at: string;
  completed_at?: string;
}

export interface WithdrawalBatchStats {
  queued_count: number;
  queued_total_dollars: number;
  processing_count: number;
  completed_today: number;
}

export interface TreasuryStats {
  total_user_balances_dollars: number;
  total_escrow_dollars: number;
  total_fees_dollars: number;
}

export interface AuditLog {
  id: number;
  actor_user_id?: string;
  action: string;
  object_type?: string;
  object_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

class AdminService {
  /**
   * Get platform fees summary
   */
  async getPlatformFees(): Promise<PlatformFees> {
    const response = await api.get('/admin/fees');
    return response.data;
  }

  /**
   * Withdraw platform fees
   */
  async withdrawPlatformFees(
    amountDollars: number,
    destinationType: 'bank' | 'onchain',
    destinationId: string
  ): Promise<{
    amount_withdrawn_dollars: number;
    fees_withdrawn_count: number;
    remaining_fees_dollars: number;
  }> {
    const response = await api.post('/admin/fees/withdraw', {
      amountCents: Math.round(amountDollars * 100),
      destinationType,
      destinationId,
    });
    return response.data;
  }

  /**
   * Run reconciliation report
   */
  async runReconciliation(date?: string): Promise<ReconciliationReport> {
    const response = await api.post('/admin/reconciliation/run', {
      date: date || new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Get reconciliation reports
   */
  async getReconciliationReports(limit: number = 30): Promise<ReconciliationReport[]> {
    const response = await api.get('/admin/reconciliation/reports', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get withdrawal batch statistics
   */
  async getWithdrawalBatches(): Promise<WithdrawalBatchStats> {
    const response = await api.get('/admin/withdrawals/batches');
    return response.data;
  }

  /**
   * Manually trigger batch processing
   */
  async processBatch(chain: string = 'aptos'): Promise<any> {
    const response = await api.post('/admin/withdrawals/process-batch', {
      chain,
    });
    return response.data;
  }

  /**
   * Get user balance (admin)
   */
  async getUserBalance(userId: string): Promise<{
    user_id: string;
    available_dollars: number;
    pending_dollars: number;
    total_dollars: number;
  }> {
    const response = await api.get(`/admin/users/${userId}/balance`);
    return response.data;
  }

  /**
   * Issue promotional credit
   */
  async issueCredit(
    userId: string,
    amountDollars: number,
    description: string
  ): Promise<void> {
    await api.post(`/admin/users/${userId}/credit`, {
      amount: amountDollars,
      description,
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const response = await api.get('/admin/audit-logs', {
      params: { limit, offset },
    });
    return response.data;
  }

  /**
   * Get platform treasury stats
   */
  async getTreasuryStats(): Promise<TreasuryStats> {
    const response = await api.get('/admin/treasury');
    return response.data;
  }
}

export default new AdminService();

