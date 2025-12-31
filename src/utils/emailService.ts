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
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure Hostinger SMTP
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(config.SMTP_PORT || '587'),
      secure: false, // Use TLS
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendEmail({ to, subject, text, html }: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: `"${config.SMTP_FROM_NAME || 'HiPro Commerce'}" <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendOTPEmail(to: string, data: OTPEmailData): Promise<void> {
    const subject = 'Verify Your Email - OTP Code';
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .otp-box {
            background: #f8fafc;
            border: 2px dashed #2563eb;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }
        .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">HiPro Commerce</div>
            <h1>Email Verification Required</h1>
        </div>
        
        <p>Hello <strong>${data.name}</strong>,</p>
        
        <p>Thank you for registering with HiPro Commerce! To complete your account setup, please verify your email address using the OTP code below:</p>
        
        <div class="otp-box">
            <div class="otp-code">${data.otp}</div>
            <p style="margin-top: 15px; color: #6b7280;">Enter this 6-digit code to verify your email</p>
        </div>
        
        <div class="warning">
            <strong>Important:</strong> This OTP will expire in 10 minutes for security reasons. If you didn't request this verification, please ignore this email.
        </div>
        
        <p>Once verified, you'll be able to:</p>
        <ul>
            <li>Add items to your cart</li>
            <li>Place orders</li>
            <li>Track your order history</li>
            <li>Manage your profile and addresses</li>
        </ul>
        
        <p>If you have any questions, feel free to contact our support team.</p>
        
        <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2024 HiPro Commerce. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Hello ${data.name},

Thank you for registering with HiPro Commerce! 

Your verification code is: ${data.otp}

This code will expire in 10 minutes. Enter this code to verify your email address and complete your registration.

If you didn't request this verification, please ignore this email.

Best regards,
HiPro Commerce Team
`;

    await this.sendEmail({ to, subject, text, html });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to HiPro Commerce!';
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to HiPro Commerce</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .welcome-badge {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            display: inline-block;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">HiPro Commerce</div>
            <h1>🎉 Welcome to Our Community!</h1>
        </div>
        
        <p>Hello <strong>${name}</strong>,</p>
        
        <div style="text-align: center;">
            <div class="welcome-badge">Your account is now active!</div>
        </div>
        
        <p>Congratulations! Your email has been successfully verified and your HiPro Commerce account is now ready to use.</p>
        
        <p>You can now enjoy all our features:</p>
        <ul>
            <li>🛍️ Browse our extensive product catalog</li>
            <li>🛒 Add items to your cart</li>
            <li>📦 Place and track orders</li>
            <li>👤 Manage your profile and preferences</li>
            <li>📍 Save multiple addresses for easy checkout</li>
        </ul>
        
        <p>Start exploring our products and find amazing deals waiting for you!</p>
        
        <p>Happy shopping!</p>
        
        <div class="footer">
            <p>Need help? Contact our support team anytime.</p>
            <p>&copy; 2024 HiPro Commerce. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Hello ${name},

Welcome to HiPro Commerce! 🎉

Your email has been successfully verified and your account is now active.

You can now:
- Browse our products
- Add items to your cart
- Place and track orders  
- Manage your profile and addresses

Start exploring our products and enjoy shopping with us!

Best regards,
HiPro Commerce Team
`;

    await this.sendEmail({ to, subject, text, html });
  }
}

export const emailService = new EmailService();