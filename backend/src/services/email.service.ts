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
 * Send Generic Email
 * 
 * Sends a generic email with subject and body.
 * 
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param body - Email body (plain text or HTML)
 * @returns Promise<void>
 * 
 * @example
 * await sendEmail('admin@campuscuts.com', 'Alert', 'Gas wallet is low!');
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping email to ${to}, subject: ${subject}`);
    return;
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: body,
      html: body.includes('<') ? body : `<p>${body.replace(/\n/g, '<br>')}</p>`
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent to ${to}`, { messageId: info.messageId, subject });
  } catch (error: any) {
    logger.error(`Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email. Please try again later.');
  }
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
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your CampusCut Account - Code Inside',
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
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your CampusCut Password',
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
Welcome to CampusCut!

Your verification code is: ${code}

This code will expire in 10 minutes.

To verify your account, enter this code on the verification page:
${frontendUrl}/web/verify-email

If you didn't create an account with CampusCut, please ignore this email.

---
CampusCut - Campus Haircuts Made Easy
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
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #022b19 0%, #034d2e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">CampusCut</h1>
    <p style="color: #4ade80; margin: 10px 0 0 0; font-size: 16px;">Account Verification</p>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #022b19; margin-bottom: 20px;">Welcome to CampusCut!</h2>
    
    <p style="color: #555555; line-height: 1.6; margin-bottom: 25px;">
      We're excited to have you join our campus community. To complete your registration, 
      please enter the verification code below.
    </p>
    
    <div style="text-align: center; margin: 30px 0; padding: 25px; background-color: #dcfce7; border-radius: 12px; border: 2px dashed #22c55e;">
      <p style="color: #166534; margin: 0 0 10px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
        Your Verification Code
      </p>
      <div style="font-size: 40px; font-weight: bold; color: #000000; letter-spacing: 10px; font-family: 'Courier New', monospace;">
        ${code}
      </div>
      <p style="color: #374151; margin: 15px 0 0 0; font-size: 13px;">
        This code expires in <strong>10 minutes</strong>
      </p>
    </div>
    
    <p style="text-align: center;">
      <a href="${frontendUrl}/web/verify-email" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Verify My Account
      </a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #6b7280; font-size: 13px; text-align: center;">
      If you didn't create an account with CampusCut, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} CampusCut - Campus Haircuts Made Easy</p>
    <p style="margin: 5px 0 0 0;">
      <a href="${frontendUrl}/help" style="color: #22c55e; text-decoration: none;">Help Center</a> • 
      <a href="${frontendUrl}/privacy" style="color: #22c55e; text-decoration: none;">Privacy Policy</a>
    </p>
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
Reset Your CampusCut Password

You requested to reset your password for your CampusCut account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

---
CampusCut - Campus Haircuts Made Easy
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
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #022b19 0%, #034d2e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">CampusCut</h1>
    <p style="color: #4ade80; margin: 10px 0 0 0; font-size: 16px;">Password Reset</p>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #022b19; margin-bottom: 20px;">Reset Your Password</h2>
    
    <p style="color: #555555; line-height: 1.6; margin-bottom: 25px;">
      You requested to reset your password for your CampusCut account. 
      Click the button below to create a new password.
    </p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Reset My Password
      </a>
    </p>
    
    <p style="color: #dc2626; font-size: 14px; text-align: center;">
      This link expires in <strong>1 hour</strong>
    </p>
    
    <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="word-break: break-all; color: #22c55e; font-size: 13px;">${resetLink}</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #6b7280; font-size: 13px; text-align: center;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} CampusCut - Campus Haircuts Made Easy</p>
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
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to CampusCut!',
      text: `
Welcome to CampusCut, ${firstName}!

Your account has been successfully verified. You can now:
- Book appointments with talented barbers on your campus
- Browse barber profiles and portfolios
- Manage your bookings and payment methods
- Leave reviews and ratings

Get started: ${frontendUrl}/web/discover

We're excited to help you look your best!

---
CampusCut Team
`.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #022b19 0%, #034d2e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">CampusCut</h1>
    <p style="color: #4ade80; margin: 10px 0 0 0; font-size: 16px;">Welcome Aboard!</p>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #022b19; margin-bottom: 20px;">Hey ${firstName}!</h2>
    
    <p style="color: #555555; line-height: 1.6; margin-bottom: 20px;">
      Your account has been verified and you're all set! Welcome to the CampusCut community.
    </p>
    
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="color: #166534; font-weight: 600; margin: 0 0 10px 0;">Here's what you can do now:</p>
      <ul style="color: #555555; margin: 0; padding-left: 20px;">
        <li>Discover talented barbers on your campus</li>
        <li>Book appointments that fit your schedule</li>
        <li>Pay securely through the app</li>
        <li>Leave reviews and help others find great cuts</li>
      </ul>
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${frontendUrl}/web/discover" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Find Your Barber
      </a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      We're excited to help you look your best! 💈
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} CampusCut - Campus Haircuts Made Easy</p>
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

/**
 * Booking Confirmation Details Interface
 */
interface BookingConfirmationDetails {
  bookingId: string;
  serviceName: string;
  price: number; // in dollars
  scheduledDate: string; // formatted date string
  scheduledTime: string; // formatted time string
  location?: string;
  notes?: string;
  consumerName: string;
  consumerEmail: string;
  barberName: string;
  barberEmail: string;
}

/**
 * Send Booking Confirmation Emails
 * 
 * Sends confirmation emails to both the consumer and barber when a booking is accepted.
 * 
 * @param details - Booking confirmation details
 */
export async function sendBookingConfirmationEmails(details: BookingConfirmationDetails): Promise<void> {
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping booking confirmation emails for booking ${details.bookingId}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://campuscut.com';

  // Send to consumer
  try {
    const transporter = createTransporter();
    
    const consumerMailOptions = {
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: details.consumerEmail,
      subject: `Booking Confirmed! Your ${details.serviceName} with ${details.barberName}`,
      text: generateBookingConfirmationText(details, 'consumer'),
      html: generateBookingConfirmationHtml(details, 'consumer', frontendUrl)
    };

    await transporter.sendMail(consumerMailOptions);
    logger.info(`Booking confirmation email sent to consumer: ${details.consumerEmail}`);
  } catch (error: any) {
    logger.error(`Failed to send booking confirmation to consumer ${details.consumerEmail}:`, error.message);
  }

  // Send to barber
  try {
    const transporter = createTransporter();
    
    const barberMailOptions = {
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: details.barberEmail,
      subject: `New Booking Confirmed: ${details.serviceName} with ${details.consumerName}`,
      text: generateBookingConfirmationText(details, 'barber'),
      html: generateBookingConfirmationHtml(details, 'barber', frontendUrl)
    };

    await transporter.sendMail(barberMailOptions);
    logger.info(`Booking confirmation email sent to barber: ${details.barberEmail}`);
  } catch (error: any) {
    logger.error(`Failed to send booking confirmation to barber ${details.barberEmail}:`, error.message);
  }
}

/**
 * Generate Booking Confirmation Plain Text
 */
function generateBookingConfirmationText(
  details: BookingConfirmationDetails, 
  recipient: 'consumer' | 'barber'
): string {
  const isConsumer = recipient === 'consumer';
  const greeting = isConsumer 
    ? `Hi ${details.consumerName.split(' ')[0]}!` 
    : `Hi ${details.barberName.split(' ')[0]}!`;
  
  const intro = isConsumer
    ? `Great news! Your booking with ${details.barberName} has been confirmed.`
    : `You have a new confirmed booking with ${details.consumerName}.`;

  return `
${greeting}

${intro}

BOOKING DETAILS
---------------
Service: ${details.serviceName}
Date: ${details.scheduledDate}
Time: ${details.scheduledTime}
Price: $${details.price.toFixed(2)}
${details.location ? `Location: ${details.location}` : ''}
${details.notes ? `Notes: ${details.notes}` : ''}

${isConsumer ? 'Customer' : 'Barber'}: ${isConsumer ? details.barberName : details.consumerName}

Booking Reference: ${details.bookingId.slice(0, 8).toUpperCase()}

${isConsumer 
  ? 'Please arrive on time. You can message your barber through the app if you need to make any changes.'
  : 'Please review the booking details and be ready for your client at the scheduled time.'}

---
CampusCut - Campus Haircuts Made Easy
`.trim();
}

/**
 * Generate Booking Confirmation HTML Email
 */
function generateBookingConfirmationHtml(
  details: BookingConfirmationDetails, 
  recipient: 'consumer' | 'barber',
  frontendUrl: string
): string {
  const isConsumer = recipient === 'consumer';
  const greeting = isConsumer 
    ? `Hi ${details.consumerName.split(' ')[0]}!` 
    : `Hi ${details.barberName.split(' ')[0]}!`;
  
  const intro = isConsumer
    ? `Great news! Your booking with <strong>${details.barberName}</strong> has been confirmed.`
    : `You have a new confirmed booking with <strong>${details.consumerName}</strong>.`;

  const ctaText = isConsumer ? 'View My Bookings' : 'View Dashboard';
  const ctaLink = isConsumer ? `${frontendUrl}/web/consumer` : `${frontendUrl}/web/barber`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #022b19 0%, #034d2e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">CampusCut</h1>
    <p style="color: #4ade80; margin: 10px 0 0 0; font-size: 16px;">Booking Confirmed! ✅</p>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #022b19; margin-bottom: 10px;">${greeting}</h2>
    
    <p style="color: #555555; line-height: 1.6; margin-bottom: 25px;">
      ${intro}
    </p>
    
    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 25px; margin: 20px 0; border: 1px solid #bbf7d0;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
        📋 Booking Details
      </h3>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #6b7280; width: 40%;">Service</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #1f2937; font-weight: 600;">${details.serviceName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #6b7280;">Date</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #1f2937; font-weight: 600;">${details.scheduledDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #6b7280;">Time</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #1f2937; font-weight: 600;">${details.scheduledTime}</td>
        </tr>
        ${details.location ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #6b7280;">Location</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #1f2937; font-weight: 600;">${details.location}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #6b7280;">${isConsumer ? 'Your Barber' : 'Customer'}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #dcfce7; color: #1f2937; font-weight: 600;">${isConsumer ? details.barberName : details.consumerName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">Price</td>
          <td style="padding: 10px 0; color: #22c55e; font-weight: 700; font-size: 20px;">$${details.price.toFixed(2)}</td>
        </tr>
      </table>
      
      ${details.notes ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dcfce7;">
        <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 14px;">Notes:</p>
        <p style="color: #1f2937; margin: 0; font-style: italic;">"${details.notes}"</p>
      </div>
      ` : ''}
    </div>
    
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
      <p style="color: #6b7280; margin: 0; font-size: 14px;">Booking Reference</p>
      <p style="color: #1f2937; margin: 5px 0 0 0; font-size: 18px; font-weight: 700; letter-spacing: 2px;">${details.bookingId.slice(0, 8).toUpperCase()}</p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
      ${isConsumer 
        ? 'Please arrive on time. You can message your barber through the app if you need to make any changes.'
        : 'Please review the booking details and be ready for your client at the scheduled time.'}
    </p>
    
    <p style="text-align: center; margin: 30px 0 20px 0;">
      <a href="${ctaLink}" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${ctaText}
      </a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} CampusCut - Campus Haircuts Made Easy</p>
    <p style="margin: 10px 0 0 0;">
      <a href="${frontendUrl}/web/consumer/messages" style="color: #9ca3af;">Messages</a> • 
      <a href="${frontendUrl}/help" style="color: #9ca3af;">Help Center</a>
    </p>
  </div>
</body>
</html>
`.trim();
}

/**
 * Interface for pending booking email details
 */
interface PendingBookingEmailDetails {
  consumerEmail: string;
  consumerName: string;
  barberEmail: string;
  barberName: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  price: number;
  location?: string;
  notes?: string;
  bookingId: string;
}

/**
 * Send Pending Booking Receipt Emails
 * 
 * Sends receipt emails to the consumer when a booking is created (pending status).
 * Also notifies the barber about the new booking request.
 */
export async function sendPendingBookingEmails(details: PendingBookingEmailDetails): Promise<void> {
  if (isAutoVerifyEnabled()) {
    logger.info(`[AUTO-VERIFY MODE] Skipping pending booking emails for booking ${details.bookingId}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://campuscut.com';

  // Send receipt to consumer
  try {
    const transporter = createTransporter();
    
    const consumerMailOptions = {
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: details.consumerEmail,
      subject: `Booking Request Submitted - ${details.serviceName} with ${details.barberName}`,
      text: generatePendingBookingText(details, 'consumer'),
      html: generatePendingBookingHtml(details, 'consumer', frontendUrl)
    };

    await transporter.sendMail(consumerMailOptions);
    logger.info(`Pending booking receipt sent to consumer: ${details.consumerEmail}`);
  } catch (error: any) {
    logger.error(`Failed to send pending booking email to consumer ${details.consumerEmail}:`, error.message);
  }

  // Send notification to barber
  try {
    const transporter = createTransporter();
    
    const barberMailOptions = {
      from: `CampusCut <${process.env.SMTP_USER}>`,
      to: details.barberEmail,
      subject: `New Booking Request from ${details.consumerName}`,
      text: generatePendingBookingText(details, 'barber'),
      html: generatePendingBookingHtml(details, 'barber', frontendUrl)
    };

    await transporter.sendMail(barberMailOptions);
    logger.info(`Pending booking notification sent to barber: ${details.barberEmail}`);
  } catch (error: any) {
    logger.error(`Failed to send pending booking email to barber ${details.barberEmail}:`, error.message);
  }
}

/**
 * Generate Pending Booking Plain Text
 */
function generatePendingBookingText(
  details: PendingBookingEmailDetails, 
  recipient: 'consumer' | 'barber'
): string {
  const isConsumer = recipient === 'consumer';
  const greeting = isConsumer 
    ? `Hi ${details.consumerName.split(' ')[0]}!` 
    : `Hi ${details.barberName.split(' ')[0]}!`;
  
  const intro = isConsumer
    ? `Your booking request with ${details.barberName} has been submitted and is awaiting confirmation.`
    : `You have a new booking request from ${details.consumerName}!`;

  return `
${greeting}

${intro}

BOOKING REQUEST DETAILS
-----------------------
Service: ${details.serviceName}
Requested Date: ${details.scheduledDate}
Requested Time: ${details.scheduledTime}
Price: $${details.price.toFixed(2)}
${details.location ? `Location: ${details.location}` : ''}
${details.notes ? `Notes: ${details.notes}` : ''}

${isConsumer ? 'Barber' : 'Customer'}: ${isConsumer ? details.barberName : details.consumerName}

Booking Reference: ${details.bookingId.slice(0, 8).toUpperCase()}

${isConsumer 
  ? "We'll notify you once the barber confirms your booking. You can track your booking status in the app."
  : 'Please review and respond to this booking request in the CampusCut app.'}

---
CampusCut - Campus Haircuts Made Easy
`.trim();
}

/**
 * Generate Pending Booking HTML Email
 */
function generatePendingBookingHtml(
  details: PendingBookingEmailDetails, 
  recipient: 'consumer' | 'barber',
  frontendUrl: string
): string {
  const isConsumer = recipient === 'consumer';
  
  const title = isConsumer ? 'Booking Request Submitted' : 'New Booking Request';
  const subtitle = isConsumer 
    ? `Awaiting confirmation from ${details.barberName}`
    : `${details.consumerName} wants to book with you`;
  const statusColor = '#f59e0b'; // Amber for pending
  const statusText = 'PENDING CONFIRMATION';
  
  const ctaText = isConsumer ? 'Track Your Booking' : 'View Request';
  const ctaLink = isConsumer 
    ? `${frontendUrl}/web/consumer/booking-status`
    : `${frontendUrl}/web/barber`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #022b19 0%, #034d2e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">CampusCut</h1>
    <p style="color: #4ade80; margin: 10px 0 0 0; font-size: 16px;">${title}</p>
  </div>
  
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #022b19; margin: 0 0 10px 0;">${isConsumer ? `Hi ${details.consumerName.split(' ')[0]}!` : `Hi ${details.barberName.split(' ')[0]}!`}</h2>
    <p style="color: #6b7280; margin: 0 0 20px 0;">${subtitle}</p>
    
    <!-- Status Badge -->
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background-color: ${statusColor}20; color: ${statusColor}; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 1px;">
        ⏳ ${statusText}
      </span>
    </div>
    
    <!-- Booking Details Card -->
    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Booking Request Details</h3>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Service</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; padding: 5px 0;">${details.serviceName}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Requested Date</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; padding: 5px 0;">${details.scheduledDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Requested Time</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; padding: 5px 0;">${details.scheduledTime}</td>
        </tr>
        ${details.location ? `
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Location</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; padding: 5px 0;">${details.location}</td>
        </tr>
        ` : ''}
      </table>
      
      <div style="border-top: 1px dashed #e5e7eb; margin: 15px 0; padding-top: 15px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; font-weight: 600;">Total</td>
            <td style="color: #22c55e; font-weight: 700; font-size: 20px; text-align: right;">$${details.price.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    ${details.notes ? `
    <div style="background-color: #fefce8; border-radius: 8px; padding: 15px; margin: 15px 0;">
      <p style="color: #854d0e; margin: 0; font-size: 14px;"><strong>Notes:</strong> ${details.notes}</p>
    </div>
    ` : ''}
    
    <!-- Person Info -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="color: #166534; margin: 0; font-size: 14px;">
        <strong>${isConsumer ? 'Your Barber:' : 'Customer:'}</strong> ${isConsumer ? details.barberName : details.consumerName}
      </p>
    </div>
    
    <!-- Reference -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="color: #6b7280; margin: 0; font-size: 14px;">Booking Reference</p>
      <p style="color: #1f2937; margin: 5px 0 0 0; font-size: 18px; font-weight: 700; letter-spacing: 2px;">${details.bookingId.slice(0, 8).toUpperCase()}</p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
      ${isConsumer 
        ? "We'll notify you once the barber confirms your booking. You can track your booking status in the app."
        : 'Please review and respond to this booking request in the CampusCut app.'}
    </p>
    
    <p style="text-align: center; margin: 30px 0 20px 0;">
      <a href="${ctaLink}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${ctaText}
      </a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} CampusCut - Campus Haircuts Made Easy</p>
  </div>
</body>
</html>
`.trim();
}
