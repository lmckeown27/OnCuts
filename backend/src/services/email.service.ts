/**
 * Email Service
 * 
 * Send email notifications via SMTP
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@campuscuts.com';
const FROM_NAME = process.env.FROM_NAME || 'CampusCuts';

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

/**
 * Send email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      logger.warn('SMTP not configured, email not sent:', subject);
      logger.info(`Email would have been sent to: ${to}`);
      logger.info(`Subject: ${subject}`);
      return;
    }

    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text version
    });

    logger.info(`Email sent: ${info.messageId}`);
  } catch (error: any) {
    logger.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send email to multiple recipients
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const promises = recipients.map(to => sendEmail(to, subject, html, text));
  await Promise.allSettled(promises);
}
