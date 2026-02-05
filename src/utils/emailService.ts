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
  private isConnected: boolean = false;

  constructor() {
    console.log('🔧 Initializing Hostinger Email Service (info@hiprotech.org)');
    console.log('Email Service:', process.env.EMAIL_SERVICE);
    console.log('Email User:', process.env.EMAIL_USER);
    console.log('Email From:', process.env.EMAIL_FROM);
    console.log('SMTP Host:', process.env.SMTP_HOST);
    console.log('SMTP Port:', process.env.SMTP_PORT);
    console.log('SMTP Secure:', process.env.SMTP_SECURE);
    
    // Hostinger SMTP configuration for info@hiprotech.org
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000 // 10 seconds
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      console.log('🔄 Testing Hostinger SMTP connection with user configuration...');
      await this.transporter.verify();
      this.isConnected = true;
      console.log('✅ Hostinger SMTP connection successful - info@hiprotech.org ready for OTP emails');
    } catch (error: any) {
      this.isConnected = false;
      console.error('❌ Hostinger SMTP connection failed:', error.message);
      console.error('⚠️ Email service will be unavailable but API will continue to work');
      console.error('⚠️ Please check your SMTP credentials and network connectivity');
    }
  }

  async sendEmail({ to, subject, text, html }: EmailOptions): Promise<void> {
    // Check if email service is available
    if (!this.isConnected) {
      console.warn('⚠️ Email service is not connected. Attempting to reconnect...');
      try {
        await this.transporter.verify();
        this.isConnected = true;
        console.log('✅ Reconnected to email service successfully');
      } catch (error) {
        console.error('❌ Failed to reconnect to email service:', error);
        throw new Error('Email service is temporarily unavailable. Please try again later.');
      }
    }

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'HiPro Commerce'}" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        text,
        html
      };

      console.log('📧 Sending email via Hostinger SMTP...');
      console.log('  To:', to);
      console.log('  From:', mailOptions.from);
      console.log('  Subject:', subject);
      console.log('  SMTP Host:', process.env.SMTP_HOST);
      console.log('  SMTP Port:', process.env.SMTP_PORT);
      console.log('  SMTP User:', process.env.EMAIL_USER);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully!');
      console.log('  Message ID:', info.messageId);
      console.log('  Response:', info.response);
      console.log('  Accepted recipients:', info.accepted);
      console.log('  Rejected recipients:', info.rejected);
      
    } catch (error: any) {
      this.isConnected = false; // Mark as disconnected for future attempts
      console.error('❌ Failed to send email:', error);
      console.error('Error details:', {
        code: error.code,
        errno: error.errno,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      
      // Provide specific error messages based on common SMTP errors
      if (error.response && typeof error.response === 'string') {
        if (error.response.includes('554 5.7.1') && error.response.includes('Disabled by user from hPanel')) {
          throw new Error('SMTP is disabled in Hostinger hPanel. Please enable email sending in your Hostinger control panel.');
        } else if (error.response.includes('535 Authentication failed')) {
          throw new Error('Email authentication failed. Please check your email credentials in the .env file.');
        } else if (error.response.includes('550 Mailbox unavailable')) {
          throw new Error('Sender email address is not valid or available.');
        } else if (error.response.includes('553 sorry, that domain isn\'t in my list of allowed rcpthosts')) {
          throw new Error('Domain not allowed for sending emails.');
        }
      }
      
      // Handle common nodemailer error codes
      if (error.code) {
        switch (error.code) {
          case 'EAUTH':
            throw new Error('Hostinger email authentication failed. Please verify your email credentials.');
          case 'ECONNECTION':
          case 'ECONNREFUSED':
          case 'ETIMEDOUT':
            throw new Error('Cannot connect to email server. Please check your network connection or try again later.');
          case 'EENVELOPE':
            throw new Error('Invalid email envelope. Please check sender and recipient addresses.');
          case 'EMESSAGE':
            throw new Error('Invalid email message content.');
          default:
            throw new Error(`SMTP Error [${error.code}]: ${error.message}`);
        }
      }
      
      throw new Error(`Failed to send email: ${error.message}`);
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

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f97316;">Verify Your Email</h2>
      <p>Hello <strong>${data.name}</strong>,</p>
      <p>Thank you for registering with HiPro Commerce!</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <h3 style="color: #374151; margin: 0;">Your verification code is:</h3>
        <div style="font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 8px; margin: 15px 0;">${data.otp}</div>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">This code will expire in 10 minutes</p>
      </div>
      
      <p>Enter this code to verify your email address and complete your registration.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
      
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">Best regards,<br>HiPro Commerce Team</p>
    </div>`;

    console.log('🔑 [OTP] Generating verification email for:', to);
    console.log('🔑 [OTP] Code:', data.otp);

    try {
      await this.sendEmail({ to, subject, text, html });
      console.log('✅ [SUCCESS] OTP email delivered to', to);
    } catch (error: any) {
      console.error('❌ [FAILURE] OTP email failed for', to, ':', error.message);
      throw error; // Re-throw to let controller handle it
    }
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
