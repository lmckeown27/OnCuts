/**
 * Email Service - SMTP Email Verification for CampusCuts
 * 
 * Handles sending verification emails and password reset emails using SMTP.
 * 
 * ## Environment Variables Required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (usually 587 for TLS)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - FRONTEND_URL: Frontend base URL for email links
 * - AUTO_VERIFY_EMAILS: Set to 'true' to skip email sending in development
 * 
 * @module email.service
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

/**
 * Email Configuration Interface
 */
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Get Email Configuration from Environment
 * 
 * @returns EmailConfig object
 * @throws Error if required environment variables are missing
 */
function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'Email service not configured. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'
    );
  }

  return {
    host,
    port,
    secure: port === 465, // Use SSL for port 465, TLS for 587
    auth: { user, pass }
  };
}

/**
 * Create Nodemailer Transporter
 * 
 * Creates and configures SMTP transporter for sending emails.
 * 
 * @returns Nodemailer transporter instance
 */
function createTransporter() {
  try {
    const config = getEmailConfig();
    
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    return transporter;
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
    throw error;
  }
}

/**
 * Check if Auto-Verify Mode is Enabled
 * 
 * In development, emails can be auto-verified without sending actual emails.
 * 
 * @returns true if AUTO_VERIFY_EMAILS=true
 */
export function isAutoVerifyEnabled(): boolean {
  return process.env.AUTO_VERIFY_EMAILS === 'true';
}

/**
 * Send Verification Email
 * 
 * Sends a 6-digit verification code to the user's email address.
 * Skips sending if AUTO_VERIFY_EMAILS=true.
 * 
 * @param email - User's email address
 * @param code - 6-digit verification code
 * @returns Promise<void>
 * 
 * @example
 * await sendVerificationEmail('student@university.edu', '123456');
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  // Skip email sending in auto-verify mode
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping email to ${email}, code: ${code}`);
    return;
  }

  try {
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const mailOptions = {
      from: `CampusCuts <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your CampusCuts Account',
      text: generateVerificationEmailText(code, frontendUrl),
      html: generateVerificationEmailHtml(code, frontendUrl)
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Verification email sent to ${email}`, { messageId: info.messageId });
  } catch (error: any) {
    logger.error(`Failed to send verification email to ${email}:`, error.message);
    throw new Error('Failed to send verification email. Please try again later.');
  }
}

/**
 * Send Password Reset Email
 * 
 * Sends a password reset link to the user's email address.
 * Skips sending if AUTO_VERIFY_EMAILS=true.
 * 
 * @param email - User's email address
 * @param resetLink - Password reset URL with token
 * @returns Promise<void>
 * 
 * @example
 * const resetLink = `https://campuscuts.com/reset-password?token=${token}`;
 * await sendPasswordResetEmail('student@university.edu', resetLink);
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  // Skip email sending in auto-verify mode
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping password reset email to ${email}`);
    logger.info(`[AUTO-VERIFY MODE] Reset link: ${resetLink}`);
    return;
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `CampusCuts <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your CampusCuts Password',
      text: generatePasswordResetEmailText(resetLink),
      html: generatePasswordResetEmailHtml(resetLink)
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Password reset email sent to ${email}`, { messageId: info.messageId });
  } catch (error: any) {
    logger.error(`Failed to send password reset email to ${email}:`, error.message);
    throw new Error('Failed to send password reset email. Please try again later.');
  }
}

/**
 * Verify SMTP Configuration
 * 
 * Tests SMTP connection to ensure email service is properly configured.
 * 
 * @returns Promise<boolean> - true if connection successful
 */
export async function verifyEmailService(): Promise<boolean> {
  // Skip verification in auto-verify mode
  if (isAutoVerifyEnabled()) {
    logger.info('[AUTO-VERIFY MODE] Email service verification skipped');
    return true;
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email service verified successfully');
    return true;
  } catch (error: any) {
    logger.error('Email service verification failed:', error.message);
    return false;
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Generate Verification Email Plain Text
 */
function generateVerificationEmailText(code: string, frontendUrl: string): string {
  return `
Welcome to CampusCuts!

Your verification code is: ${code}

This code will expire in 10 minutes.

To verify your account, enter this code on the verification page:
${frontendUrl}/verify-email

If you didn't create an account with CampusCuts, please ignore this email.

---
CampusCuts - Campus Haircuts Made Easy
`.trim();
}

/**
 * Generate Verification Email HTML
 */
function generateVerificationEmailHtml(code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9fafb;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .code-box {
      background-color: #fff;
      border: 2px solid #2563eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #2563eb;
      font-family: 'Courier New', monospace;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✂️ CampusCuts</div>
      <h1>Verify Your Account</h1>
    </div>
    
    <p>Welcome to CampusCuts! We're excited to have you join our campus community.</p>
    
    <p>Your verification code is:</p>
    
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    
    <p style="text-align: center;">
      <strong>This code expires in 10 minutes</strong>
    </p>
    
    <p style="text-align: center;">
      <a href="${frontendUrl}/verify-email" class="button">Verify My Account</a>
    </p>
    
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #2563eb;">${frontendUrl}/verify-email</p>
    
    <div class="footer">
      <p>If you didn't create an account with CampusCuts, you can safely ignore this email.</p>
      <p>© ${new Date().getFullYear()} CampusCuts - Campus Haircuts Made Easy</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate Password Reset Email Plain Text
 */
function generatePasswordResetEmailText(resetLink: string): string {
  return `
Reset Your CampusCuts Password

You requested to reset your password for your CampusCuts account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

---
CampusCuts - Campus Haircuts Made Easy
`.trim();
}

/**
 * Generate Password Reset Email HTML
 */
function generatePasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9fafb;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✂️ CampusCuts</div>
      <h1>Reset Your Password</h1>
    </div>
    
    <p>You requested to reset your password for your CampusCuts account.</p>
    
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">Reset My Password</a>
    </p>
    
    <p><strong>This link expires in 1 hour.</strong></p>
    
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #2563eb;">${resetLink}</p>
    
    <div class="footer">
      <p>If you didn't request a password reset, you can safely ignore this email or contact support if you have concerns.</p>
      <p>© ${new Date().getFullYear()} CampusCuts - Campus Haircuts Made Easy</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Send Welcome Email (Optional)
 * 
 * Sends a welcome email after successful verification.
 * 
 * @param email - User's email address
 * @param firstName - User's first name
 */
export async function sendWelcomeEmail(email: string, firstName: string): Promise<void> {
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping welcome email to ${email}`);
    return;
  }

  try {
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const mailOptions = {
      from: `CampusCuts <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to CampusCuts!',
      text: `
Welcome to CampusCuts, ${firstName}!

Your account has been successfully verified. You can now:
- Book appointments with talented barbers on your campus
- Browse barber profiles and portfolios
- Manage your bookings and payment methods
- Leave reviews and ratings

Get started: ${frontendUrl}/discover

We're excited to help you look your best!

---
CampusCuts Team
`.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background-color: #f9fafb; border-radius: 8px; padding: 30px; border: 1px solid #e5e7eb; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✂️ CampusCuts</div>
      <h1>Welcome, ${firstName}!</h1>
    </div>
    <p>Your account has been successfully verified. You're all set to start booking appointments!</p>
    <p style="text-align: center;">
      <a href="${frontendUrl}/discover" class="button">Discover Barbers</a>
    </p>
    <p>We're excited to help you look your best! 💈</p>
  </div>
</body>
</html>
`.trim()
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${email}`);
  } catch (error: any) {
    // Don't throw - welcome email is non-critical
    logger.error(`Failed to send welcome email to ${email}:`, error.message);
  }
}
