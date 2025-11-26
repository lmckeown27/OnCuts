/**
 * Email Service for CampusCuts
 * Transferred from CampusKinect with CampusCuts adaptations
 * 
 * Handles:
 * - .edu email verification
 * - Booking confirmations
 * - Appointment reminders
 * - Password reset
 * - Notification emails
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Create email transporter based on environment configuration
const createTransporter = (): Transporter => {
  console.log('🔧 EMAIL DEBUG: Environment variables check:');
  console.log('🔧 SMTP_HOST:', process.env.SMTP_HOST);
  console.log('🔧 SMTP_PORT:', process.env.SMTP_PORT);
  console.log(
    '🔧 SMTP_USER:',
    process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 5) + '***' : 'NOT SET'
  );
  console.log('🔧 SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET');

  // For Gmail, use service account with App Password
  if (process.env.SMTP_HOST === 'smtp.gmail.com') {
    console.log('✅ EMAIL DEBUG: Using Gmail configuration');
    return nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
  }

  // Fallback: Force Gmail if SMTP_HOST missing or localhost
  if (
    !process.env.SMTP_HOST ||
    process.env.SMTP_HOST === '127.0.0.1' ||
    process.env.SMTP_HOST === 'localhost'
  ) {
    console.log('🚨 EMAIL DEBUG: SMTP_HOST missing or localhost, forcing Gmail configuration');

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('❌ EMAIL ERROR: Gmail credentials missing!');
      throw new Error('Email service not configured: Missing SMTP_USER or SMTP_PASS');
    }

    return nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
  }

  // Generic SMTP configuration
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Email templates configuration
const BRAND_COLOR = '#8B4513'; // Earthy brown for barber theme
const BRAND_GRADIENT = 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)';

/**
 * Send verification email for .edu email address
 */
export const sendVerificationEmail = async (
  email: string,
  firstName: string,
  token: string
): Promise<boolean> => {
  try {
    console.log('📧 Attempting to send verification email to:', email);

    const transporter = createTransporter();
    console.log('✅ Email transporter created successfully');

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"CampusCuts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your CampusCuts Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✂️ CampusCuts</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Campus Barber Marketplace</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              Welcome to CampusCuts! We're excited to have you join our community of students 
              and barbers making campus grooming easy and convenient.
            </p>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              To get started, please verify your .edu email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: ${BRAND_GRADIENT}; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold;
                        font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              If the button doesn't work, copy and paste this link:
            </p>
            
            <p style="color: ${BRAND_COLOR}; font-size: 14px; word-break: break-all; margin-bottom: 25px;">
              ${verificationUrl}
            </p>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              This verification link will expire in 24 hours.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              If you didn't create a CampusCuts account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
        Welcome to CampusCuts!
        
        Hi ${firstName},
        
        Welcome to CampusCuts! Please verify your email address by visiting:
        ${verificationUrl}
        
        This verification link will expire in 24 hours.
        
        If you didn't create a CampusCuts account, you can safely ignore this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return false;
  }
};

/**
 * Send booking confirmation email
 */
export const sendBookingConfirmationEmail = async (
  email: string,
  firstName: string,
  booking: {
    barberName: string;
    service: string;
    dateTime: string;
    location: string;
    price: number;
  }
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"CampusCuts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Booking Confirmed - CampusCuts',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✂️ CampusCuts</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Booking Confirmed</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hey ${firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              Your appointment with <strong>${booking.barberName}</strong> is confirmed!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: ${BRAND_COLOR}; margin-top: 0;">Appointment Details</h3>
              <p style="margin: 10px 0;"><strong>Service:</strong> ${booking.service}</p>
              <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${booking.dateTime}</p>
              <p style="margin: 10px 0;"><strong>Location:</strong> ${booking.location}</p>
              <p style="margin: 10px 0;"><strong>Price:</strong> $${booking.price.toFixed(2)}</p>
            </div>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              We'll send you a reminder before your appointment. See you soon!
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              Need to cancel or reschedule? Open the CampusCuts app to manage your bookings.
            </p>
          </div>
        </div>
      `,
      text: `
        CampusCuts - Booking Confirmed
        
        Hey ${firstName}!
        
        Your appointment is confirmed:
        Barber: ${booking.barberName}
        Service: ${booking.service}
        Date & Time: ${booking.dateTime}
        Location: ${booking.location}
        Price: $${booking.price.toFixed(2)}
        
        We'll send you a reminder before your appointment!
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Booking confirmation email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send booking confirmation email:', error);
    return false;
  }
};

/**
 * Send appointment reminder email
 */
export const sendAppointmentReminderEmail = async (
  email: string,
  firstName: string,
  reminder: {
    barberName: string;
    service: string;
    dateTime: string;
    location: string;
    hoursUntil: number;
  }
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"CampusCuts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Reminder: Your appointment in ${reminder.hoursUntil} hours`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⏰ Appointment Reminder</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hey ${firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              Your appointment with <strong>${reminder.barberName}</strong> is coming up in <strong>${reminder.hoursUntil} hours</strong>!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>Service:</strong> ${reminder.service}</p>
              <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${reminder.dateTime}</p>
              <p style="margin: 10px 0;"><strong>Location:</strong> ${reminder.location}</p>
            </div>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              Looking forward to seeing you!
            </p>
          </div>
        </div>
      `,
      text: `
        Appointment Reminder - CampusCuts
        
        Hey ${firstName}!
        
        Your appointment in ${reminder.hoursUntil} hours:
        Barber: ${reminder.barberName}
        Service: ${reminder.service}
        Time: ${reminder.dateTime}
        Location: ${reminder.location}
        
        See you soon!
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Appointment reminder email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send reminder email:', error);
    return false;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  firstName: string,
  token: string
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"CampusCuts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your CampusCuts Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✂️ CampusCuts</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              We received a request to reset your CampusCuts password. 
              If you didn't make this request, you can safely ignore this email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: ${BRAND_GRADIENT}; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold;
                        font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              If the button doesn't work, copy and paste this link:
            </p>
            
            <p style="color: ${BRAND_COLOR}; font-size: 14px; word-break: break-all; margin-bottom: 25px;">
              ${resetUrl}
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              This reset link will expire in 1 hour.
            </p>
          </div>
        </div>
      `,
      text: `
        Password Reset Request - CampusCuts
        
        Hi ${firstName},
        
        Reset your password by visiting: ${resetUrl}
        
        This link expires in 1 hour.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
};

/**
 * Send verification code email (6-digit code)
 */
export const sendVerificationCode = async (
  email: string,
  firstName: string,
  code: string
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"CampusCuts Team" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your CampusCuts Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✂️ CampusCuts</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Account Verification</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              Enter this verification code in the CampusCuts app:
            </p>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 10px; border: 2px dashed ${BRAND_COLOR};">
              <h3 style="color: ${BRAND_COLOR}; margin: 0 0 10px 0; font-size: 24px;">Your Verification Code</h3>
              <div style="font-size: 36px; font-weight: bold; color: ${BRAND_COLOR}; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${code}
              </div>
              <p style="color: #888; margin: 10px 0 0 0; font-size: 14px;">
                This code expires in 10 minutes
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
        CampusCuts - Account Verification
        
        Hi ${firstName},
        
        Your Verification Code: ${code}
        (Expires in 10 minutes)
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Verification code email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification code email:', error);
    return false;
  }
};

/**
 * Send generic notification email
 */
export const sendNotificationEmail = async (
  email: string,
  firstName: string,
  subject: string,
  message: string,
  actionUrl: string | null = null,
  actionText: string | null = null
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    let actionButton = '';
    if (actionUrl && actionText) {
      actionButton = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background: ${BRAND_GRADIENT}; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 25px; 
                    display: inline-block; 
                    font-weight: bold;
                    font-size: 16px;">
            ${actionText}
          </a>
        </div>
      `;
    }

    const mailOptions = {
      from: `"CampusCuts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${BRAND_GRADIENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✂️ CampusCuts</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${firstName}!</h2>
            
            <div style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              ${message}
            </div>
            
            ${actionButton}
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              Manage your notification preferences in the CampusCuts app settings.
            </p>
          </div>
        </div>
      `,
      text: `
        ${subject} - CampusCuts
        
        Hi ${firstName},
        
        ${message}
        
        ${actionUrl ? `\n${actionText}: ${actionUrl}` : ''}
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Notification email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send notification email:', error);
    return false;
  }
};

/**
 * Test email service
 */
export const testEmailService = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is working correctly');
    return true;
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    return false;
  }
};

export default {
  sendVerificationEmail,
  sendBookingConfirmationEmail,
  sendAppointmentReminderEmail,
  sendPasswordResetEmail,
  sendVerificationCode,
  sendNotificationEmail,
  testEmailService,
};

