/**
 * SMTP Test for info@hiprotech.org (Hostinger)
 * 
 * Before running this test:
 * 1. Update the .env file with your actual Hostinger password for info@hiprotech.org
 * 2. Make sure SMTP is enabled in your Hostinger hPanel
 * 3. Run: node test-hiprotech-smtp.js
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

async function testHiprotechSMTP() {
  console.log('🧪 Testing Hostinger SMTP Configuration for info@hiprotech.org');
  console.log('='.repeat(60));
  
  console.log('📋 Configuration:');
  console.log('  Email User:', process.env.EMAIL_USER);
  console.log('  Email From:', process.env.EMAIL_FROM);
  console.log('  SMTP Host:', process.env.SMTP_HOST);
  console.log('  SMTP Port:', process.env.SMTP_PORT);
  console.log('  SMTP Secure:', process.env.SMTP_SECURE);
  console.log('');
  
  // Check if credentials are properly set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Error: EMAIL_USER and EMAIL_PASS must be set in .env file');
    console.error('   Please update your .env file with the actual Hostinger credentials for info@hiprotech.org');
    return;
  }
  
  if (process.env.EMAIL_PASS === 'YOUR_HOSTINGER_PASSWORD') {
    console.error('❌ Error: Please replace YOUR_HOSTINGER_PASSWORD with the actual password');
    console.error('   Update the EMAIL_PASS and SMTP_PASS values in your .env file');
    return;
  }
  
  try {
    // Create transporter with Hostinger settings
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔄 Step 1: Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ Step 1: SMTP connection successful!');
    console.log('');
    
    console.log('🔄 Step 2: Sending test OTP email...');
    const testEmail = {
      from: `"HiPro Commerce" <${process.env.EMAIL_FROM}>`,
      to: 'aachalpriya554@gmail.com', // Replace with your test email
      subject: 'Test OTP Email - HiPro Commerce',
      text: `Hello Test User,

This is a test OTP email from HiPro Commerce!

Your verification code is: 123456

This is just a test to verify that emails are working correctly.

Best regards,
HiPro Commerce Team`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f97316;">Test OTP Email</h2>
        <p>Hello <strong>Test User</strong>,</p>
        <p>This is a test OTP email from HiPro Commerce!</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h3 style="color: #374151; margin: 0;">Test verification code:</h3>
          <div style="font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 8px; margin: 15px 0;">123456</div>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">This is just a test email</p>
        </div>
        
        <p>This is just a test to verify that emails are working correctly.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">Best regards,<br>HiPro Commerce Team</p>
      </div>`
    };
    
    const info = await transporter.sendMail(testEmail);
    
    console.log('✅ Step 2: Test email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    console.log('');
    console.log('🎉 SUCCESS: Hostinger SMTP is working correctly!');
    console.log('   - Check the recipient email for the test message');
    console.log('   - Your OTP system should now work properly');
    
  } catch (error) {
    console.error('❌ SMTP Test Failed:', error.message);
    console.error('');
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    
    console.error('');
    console.error('🔧 Troubleshooting Steps:');
    
    if (error.response && error.response.includes('554 5.7.1')) {
      if (error.response.includes('Disabled by user from hPanel')) {
        console.error('   1. ⚠️  SMTP is disabled in Hostinger hPanel');
        console.error('   2. 🔧 Log into your Hostinger control panel');
        console.error('   3. 🔧 Go to Email section > Email Accounts');
        console.error('   4. 🔧 Find info@hiprotech.org and enable SMTP');
        console.error('   5. 🔧 Re-run this test');
      } else {
        console.error('   1. ⚠️  Hostinger SMTP access denied');
        console.error('   2. 🔧 Check your email account permissions');
        console.error('   3. 🔧 Verify email account exists in Hostinger');
      }
    } else if (error.code === 'EAUTH') {
      console.error('   1. ⚠️  Authentication failed');
      console.error('   2. 🔧 Verify EMAIL_USER: info@hiprotech.org');
      console.error('   3. 🔧 Verify EMAIL_PASS is correct');
      console.error('   4. 🔧 Check if email account exists in Hostinger');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('   1. ⚠️  Connection failed');
      console.error('   2. 🔧 Check your internet connection');
      console.error('   3. 🔧 Verify SMTP_HOST: smtp.hostinger.com');
      console.error('   4. 🔧 Verify SMTP_PORT: 587');
    } else {
      console.error('   1. 🔧 Check all environment variables in .env');
      console.error('   2. 🔧 Verify email account exists in Hostinger');
      console.error('   3. 🔧 Check Hostinger email settings');
    }
  }
}

// Run the test
testHiprotechSMTP().catch(console.error);