/**
 * Gas Wallet Monitoring Service
 * 
 * Monitors gas wallet balance and sends alerts when low
 */

import { AptosClient, Types } from 'aptos';
import { logger } from '../utils/logger';
import { sendEmail } from './email.service';
import { sendSlackAlert } from './slack.service';
import { getRedisClient, redisGet, redisSet } from '../config/redis';

const APTOS_NODE_URL = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
const GAS_WALLET_ADDRESS = process.env.GAS_WALLET_ADDRESS || '';

// Alert thresholds (in APT)
const CRITICAL_THRESHOLD = parseFloat(process.env.GAS_WALLET_CRITICAL_THRESHOLD || '10'); // 10 APT
const WARNING_THRESHOLD = parseFloat(process.env.GAS_WALLET_WARNING_THRESHOLD || '50');  // 50 APT
const HEALTHY_THRESHOLD = parseFloat(process.env.GAS_WALLET_HEALTHY_THRESHOLD || '100'); // 100 APT

// Alert cooldown (prevent spam)
const ALERT_COOLDOWN_HOURS = parseInt(process.env.ALERT_COOLDOWN_HOURS || '6'); // 6 hours

// Admin contact info
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@campuscuts.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+1234567890';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

interface GasWalletStatus {
  address: string;
  balance: number; // APT
  balanceOctas: bigint; // Raw octas
  status: 'critical' | 'warning' | 'healthy';
  lastChecked: string;
  estimatedDaysRemaining: number;
}

interface AlertHistory {
  level: 'critical' | 'warning';
  balance: number;
  timestamp: string;
  alertsSent: string[];
}

class GasWalletMonitorService {
  private aptos: AptosClient;

  constructor() {
    this.aptos = new AptosClient(APTOS_NODE_URL);
  }

  /**
   * Get current gas wallet balance
   */
  async getGasWalletBalance(): Promise<GasWalletStatus> {
    try {
      if (!GAS_WALLET_ADDRESS) {
        throw new Error('GAS_WALLET_ADDRESS not configured');
      }

      // Fetch account balance
      const resources = await this.aptos.getAccountResources(GAS_WALLET_ADDRESS);

      // Find AptosCoin resource
      const coinResource = resources.find(
        (r: Types.MoveResource) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
      );

      const balanceOctas = BigInt((coinResource?.data as any)?.coin?.value || '0');
      const balance = Number(balanceOctas) / 100000000; // Convert octas to APT

      // Determine status
      let status: 'critical' | 'warning' | 'healthy';
      if (balance < CRITICAL_THRESHOLD) {
        status = 'critical';
      } else if (balance < WARNING_THRESHOLD) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      // Estimate days remaining based on average daily usage
      const avgDailyUsage = await this.getAverageDailyUsage();
      const estimatedDaysRemaining = avgDailyUsage > 0 
        ? Math.floor(balance / avgDailyUsage) 
        : 999;

      const walletStatus: GasWalletStatus = {
        address: GAS_WALLET_ADDRESS,
        balance,
        balanceOctas,
        status,
        lastChecked: new Date().toISOString(),
        estimatedDaysRemaining,
      };

      // Cache status in Redis
      await redisSet('gas_wallet_status', walletStatus, 300); // 5 minute cache

      return walletStatus;
    } catch (error: any) {
      logger.error('Error fetching gas wallet balance:', error);
      throw error;
    }
  }

  /**
   * Calculate average daily APT usage
   */
  private async getAverageDailyUsage(): Promise<number> {
    try {
      // Get usage stats from last 7 days
      const usageKey = 'gas_wallet_daily_usage';
      const usage = await redisGet(usageKey);
      
      if (!usage) {
        return 5; // Default estimate: 5 APT per day
      }

      const values = Object.values(usage) as number[];
      
      if (values.length === 0) {
        return 5;
      }

      const average = values.reduce((a, b) => a + b, 0) / values.length;
      return average;
    } catch (error) {
      return 5; // Default fallback
    }
  }

  /**
   * Record gas usage for analytics
   */
  async recordGasUsage(amountAPT: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = 'gas_wallet_daily_usage';
      
      const usage = (await redisGet(usageKey)) || {};
      
      usage[today] = (usage[today] || 0) + amountAPT;
      
      // Keep only last 30 days
      const dates = Object.keys(usage).sort();
      if (dates.length > 30) {
        const toDelete = dates.slice(0, dates.length - 30);
        toDelete.forEach(date => delete usage[date]);
      }
      
      await redisSet(usageKey, usage, 86400 * 31); // 31 days
    } catch (error) {
      logger.error('Error recording gas usage:', error);
    }
  }

  /**
   * Check if alert cooldown has passed
   */
  private async canSendAlert(level: 'critical' | 'warning'): Promise<boolean> {
    try {
      const key = `gas_alert_cooldown_${level}`;
      const lastAlert = await redisGet(key);
      
      if (!lastAlert) {
        return true;
      }

      const lastAlertTime = new Date(lastAlert).getTime();
      const now = Date.now();
      const hoursSinceLastAlert = (now - lastAlertTime) / (1000 * 60 * 60);

      return hoursSinceLastAlert >= ALERT_COOLDOWN_HOURS;
    } catch (error) {
      return true; // If error, allow alert
    }
  }

  /**
   * Set alert cooldown
   */
  private async setAlertCooldown(level: 'critical' | 'warning'): Promise<void> {
    try {
      const key = `gas_alert_cooldown_${level}`;
      const now = new Date().toISOString();
      await redisSet(key, now, ALERT_COOLDOWN_HOURS * 3600);
    } catch (error) {
      logger.error('Error setting alert cooldown:', error);
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlerts(status: GasWalletStatus): Promise<void> {
    const alertsSent: string[] = [];

    // Email alert
    try {
      const emailSubject = status.status === 'critical'
        ? '🚨 CRITICAL: Gas Wallet Nearly Empty'
        : '⚠️ WARNING: Gas Wallet Running Low';

      const emailBody = `
        <h2>${emailSubject}</h2>
        <p><strong>Current Balance:</strong> ${status.balance.toFixed(2)} APT</p>
        <p><strong>Status:</strong> ${status.status.toUpperCase()}</p>
        <p><strong>Estimated Days Remaining:</strong> ${status.estimatedDaysRemaining} days</p>
        <p><strong>Wallet Address:</strong> <code>${status.address}</code></p>
        
        <h3>Action Required:</h3>
        ${status.status === 'critical' 
          ? '<p style="color: red;">⛔️ <strong>IMMEDIATE ACTION REQUIRED:</strong> Fund the gas wallet NOW to prevent service disruption.</p>'
          : '<p>⚠️ Please fund the gas wallet soon to ensure uninterrupted service.</p>'
        }
        
        <h3>How to Fund:</h3>
        <ol>
          <li>Go to <a href="https://campuscuts.com/admin">Admin Dashboard</a></li>
          <li>Click "Connect Wallet" in the header</li>
          <li>Transfer APT to the gas wallet</li>
          <li>Recommended: ${status.status === 'critical' ? '200 APT' : '100 APT'}</li>
        </ol>
        
        <p><small>This alert was sent at ${new Date().toLocaleString()}. You will not receive another alert for ${ALERT_COOLDOWN_HOURS} hours.</small></p>
      `;

      await sendEmail(ADMIN_EMAIL, emailSubject, emailBody);
      alertsSent.push('email');
      logger.info(`Email alert sent to ${ADMIN_EMAIL}`);
    } catch (error) {
      logger.error('Error sending email alert:', error);
    }

    // Slack alert
    if (SLACK_WEBHOOK_URL) {
      try {
        const slackMessage = {
          text: status.status === 'critical' ? '🚨 *CRITICAL: Gas Wallet Nearly Empty*' : '⚠️ *WARNING: Gas Wallet Running Low*',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: status.status === 'critical' ? '🚨 CRITICAL: Gas Wallet Nearly Empty' : '⚠️ WARNING: Gas Wallet Running Low',
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Current Balance:*\n${status.balance.toFixed(2)} APT`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Status:*\n${status.status.toUpperCase()}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Est. Days Remaining:*\n${status.estimatedDaysRemaining} days`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Wallet:*\n\`${status.address.slice(0, 10)}...${status.address.slice(-8)}\``,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: status.status === 'critical'
                  ? '⛔️ *IMMEDIATE ACTION REQUIRED:* Fund the gas wallet NOW to prevent service disruption.'
                  : '⚠️ Please fund the gas wallet soon to ensure uninterrupted service.',
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Go to Admin Dashboard',
                  },
                  url: 'https://campuscuts.com/admin',
                  style: status.status === 'critical' ? 'danger' : 'primary',
                },
              ],
            },
          ],
        };

        await sendSlackAlert(slackMessage);
        alertsSent.push('slack');
        logger.info('Slack alert sent');
      } catch (error) {
        logger.error('Error sending Slack alert:', error);
      }
    }

    // SMS alert (critical only)
    if (status.status === 'critical' && ADMIN_PHONE) {
      try {
        // TODO: Integrate Twilio for SMS
        // await sendSMS(ADMIN_PHONE, `CRITICAL: Gas wallet at ${status.balance.toFixed(2)} APT. Fund immediately!`);
        alertsSent.push('sms');
        logger.info('SMS alert would be sent (not implemented)');
      } catch (error) {
        logger.error('Error sending SMS alert:', error);
      }
    }

    // Log alert history (only if critical or warning)
    if (status.status === 'critical' || status.status === 'warning') {
      const alertHistory: AlertHistory = {
        level: status.status,
        balance: status.balance,
        timestamp: new Date().toISOString(),
        alertsSent,
      };

      const redis = getRedisClient();
      if (redis && redis.isReady) {
        await redis.lPush('gas_alert_history', JSON.stringify(alertHistory));
        await redis.lTrim('gas_alert_history', 0, 99); // Keep last 100 alerts
      }
    }
  }

  /**
   * Check gas wallet and send alerts if needed
   */
  async checkAndAlert(): Promise<GasWalletStatus> {
    try {
      logger.info('Checking gas wallet balance...');

      const status = await this.getGasWalletBalance();

      logger.info(`Gas wallet balance: ${status.balance.toFixed(2)} APT (${status.status})`);

      // Send alerts if needed
      if (status.status === 'critical') {
        const canAlert = await this.canSendAlert('critical');
        if (canAlert) {
          logger.warn('Gas wallet CRITICAL - sending alerts');
          await this.sendAlerts(status);
          await this.setAlertCooldown('critical');
        } else {
          logger.warn('Gas wallet CRITICAL but alert cooldown active');
        }
      } else if (status.status === 'warning') {
        const canAlert = await this.canSendAlert('warning');
        if (canAlert) {
          logger.warn('Gas wallet WARNING - sending alerts');
          await this.sendAlerts(status);
          await this.setAlertCooldown('warning');
        } else {
          logger.warn('Gas wallet WARNING but alert cooldown active');
        }
      } else {
        logger.info('Gas wallet healthy');
      }

      return status;
    } catch (error: any) {
      logger.error('Error in checkAndAlert:', error);
      throw error;
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(limit: number = 10): Promise<AlertHistory[]> {
    try {
      const redis = getRedisClient();
      if (!redis || !redis.isReady) return [];
      
      const history = await redis.lRange('gas_alert_history', 0, limit - 1);
      return history.map((h: string) => JSON.parse(h));
    } catch (error) {
      logger.error('Error fetching alert history:', error);
      return [];
    }
  }

  /**
   * Get daily usage statistics
   */
  async getUsageStatistics(): Promise<Record<string, number>> {
    try {
      const usageData = await redisGet('gas_wallet_daily_usage');
      return usageData || {};
    } catch (error) {
      logger.error('Error fetching usage statistics:', error);
      return {};
    }
  }
}

export const gasWalletMonitor = new GasWalletMonitorService();

