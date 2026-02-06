import nodemailer from 'nodemailer';

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
  private transporter: nodemailer.Transporter;
  private isConnected = false;

  constructor() {
    console.log('🔧 Initializing Hostinger Email Service');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_USER:', process.env.SMTP_USER);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,          // MUST be false for port 587
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER, // info@hiprotech.org
        pass: process.env.SMTP_PASS, // Abhi@2026
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      console.log('🔄 Verifying SMTP connection...');
      await this.transporter.verify();
      this.isConnected = true;
      console.log('✅ SMTP connection successful');
    } catch (error: any) {
      this.isConnected = false;
      console.error('❌ SMTP verification failed:', error.message);
      console.error('⚠️ Email service unavailable');
    }
  }

  private async ensureConnection(): Promise<void> {
    if (this.isConnected) return;

    try {
      console.log('🔁 Reconnecting SMTP...');
      await this.transporter.verify();
      this.isConnected = true;
      console.log('✅ SMTP reconnected');
    } catch {
      throw new Error(
        'Email service is temporarily unavailable. Please try again later.'
      );
    }
  }

  async sendEmail({ to, subject, text, html }: EmailOptions): Promise<void> {
    await this.ensureConnection();

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'HiPro Commerce'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      };

      console.log('📧 Sending email');
      console.log('To:', to);
      console.log('Subject:', subject);

      const info = await this.transporter.sendMail(mailOptions);

      console.log('✅ Email sent');
      console.log('Message ID:', info.messageId);
    } catch (error: any) {
      this.isConnected = false;
      console.error('❌ Email send failed:', error);

      if (error.code === 'EAUTH') {
        throw new Error('Email authentication failed. Please contact support.');
      }

      if (
        error.code === 'ECONNECTION' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT'
      ) {
        throw new Error('Cannot connect to email server.');
      }

      throw new Error('Email service is temporarily unavailable.');
    }
  }

  async sendOTPEmail(to: string, data: OTPEmailData): Promise<void> {
    const subject = 'Verify Your Email - OTP Code';

    const text = `Hello ${data.name},

Your verification code is: ${data.otp}

This code will expire in 10 minutes.

HiPro Commerce Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color:#f97316;">Email Verification</h2>
        <p>Hello <strong>${data.name}</strong>,</p>
        <p>Your OTP code is:</p>
        <div style="font-size:32px;font-weight:bold;color:#111;margin:20px 0;">
          ${data.otp}
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <hr/>
        <p style="font-size:12px;color:#666;">HiPro Commerce</p>
      </div>
    `;

    console.log('🔑 Sending OTP to:', to);

    await this.sendEmail({ to, subject, text, html });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to HiPro Commerce';

    const text = `Hello ${name},

Welcome to HiPro Commerce!
Your account is now active.

Happy shopping!
HiPro Commerce Team`;

    await this.sendEmail({ to, subject, text });
  }
}

export const emailService = new EmailService();
