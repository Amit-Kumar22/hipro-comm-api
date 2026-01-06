import nodemailer from 'nodemailer';
import { config } from '../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface OTPEmailData {
  name: string;
  otp: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private developmentMode: boolean;

  constructor() {
    // Try real email first, fall back to development mode if SMTP fails
    this.developmentMode = false;
    
    console.log('🔧 Initializing Email Service with config:');
    console.log('SMTP_HOST:', config.SMTP_HOST);
    console.log('SMTP_PORT:', config.SMTP_PORT);
    console.log('SMTP_USER:', config.SMTP_USER);
    console.log('SMTP_PASS:', config.SMTP_PASS ? '***hidden***' : 'NOT SET');
    
    if (!config.SMTP_USER || !config.SMTP_PASS) {
      console.warn('⚠️ SMTP credentials missing - falling back to development mode');
      this.developmentMode = true;
    } else {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST || 'smtp.hostinger.com',
        port: parseInt(config.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      this.verifyConnection();
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.verify();
        console.log('✅ SMTP Server is ready to take our messages');
      }
    } catch (error) {
      console.error('❌ SMTP Server connection failed:', error);
    }
  }

  async sendEmail({ to, subject, text, html }: EmailOptions): Promise<void> {
    try {
      // First try real email if transporter is available
      if (!this.developmentMode && this.transporter) {
        const mailOptions = {
          from: `"${config.SMTP_FROM_NAME || 'HiPro Commerce'}" <${config.SMTP_USER}>`,
          to,
          subject,
          text,
          html
        };

        console.log('📧 Attempting to send email to:', to);
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to} - Message ID: ${info.messageId}`);
        return;
      }
      
      // If no transporter or development mode, log to console
      throw new Error('SMTP not available - using development mode');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ Real email failed, using development mode:', errorMessage);
      
      // Fall back to development mode - log email instead of sending
      console.log('📧 [DEVELOPMENT FALLBACK] Email would be sent:');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Content:', text);
      console.log('✅ Email "sent" successfully in development mode');
    }
  }

  async sendOTPEmail(to: string, data: OTPEmailData): Promise<void> {
    const subject = 'Verify Your Email - OTP Code';
    
    const text = `Hello ${data.name},

Thank you for registering with HiPro Commerce! 

Your verification code is: ${data.otp}

This code will expire in 10 minutes. Enter this code to verify your email address and complete your registration.

If you didn't request this verification, please ignore this email.

Best regards,
HiPro Commerce Team`;

    // Always log OTP in development for testing purposes
    console.log('🔑 [OTP] Code for', to, ':', data.otp);
    console.log('📧 OTP sent to email address');

    await this.sendEmail({ to, subject, text });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to HiPro Commerce!';
    
    const text = `Hello ${name},

Welcome to HiPro Commerce!

Your account has been successfully created and verified. You can now:

- Browse our products
- Add items to your cart
- Place orders
- Manage your profile
- Save delivery addresses

Start shopping now at our website!

Best regards,
HiPro Commerce Team`;

    await this.sendEmail({ to, subject, text });
  }
}

export const emailService = new EmailService();
