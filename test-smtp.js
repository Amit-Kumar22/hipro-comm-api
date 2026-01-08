// Test environment variables and SMTP configuration
import { config } from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
config();

console.log('🔍 Checking Email Configuration...');

console.log('Environment Variables:');
console.log('- EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
console.log('- EMAIL_USER:', process.env.EMAIL_USER);
console.log('- EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('- SMTP_HOST:', process.env.SMTP_HOST);
console.log('- SMTP_PORT:', process.env.SMTP_PORT);
console.log('- SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('- EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'undefined');

const testConfig = {
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
};

console.log('\n📧 SMTP Configuration:');
console.log(JSON.stringify({...testConfig, auth: {...testConfig.auth, pass: '[HIDDEN]'}}, null, 2));

async function testConnection() {
  try {
    console.log('\n🔄 Testing SMTP connection...');
    const transporter = nodemailer.createTransport(testConfig);
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    console.log('\n📨 Sending test email...');
    const result = await transporter.sendMail({
      from: `"HiPro Commerce" <${process.env.EMAIL_FROM}>`,
      to: 'aachalpriya554@gmail.com',
      subject: 'Test Email from HiPro Commerce',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a test email to verify SMTP configuration.</p>'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
  }
}

testConnection();