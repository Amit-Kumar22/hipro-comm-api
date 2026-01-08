// Direct test of email service without server
import { emailService } from './src/utils/emailService.js';

async function testEmailService() {
  try {
    console.log('🧪 Testing email service directly...');
    
    await emailService.sendOTPEmail('aachalpriya554@gmail.com', {
      name: 'Test User',
      otp: '123456'
    });
    
    console.log('✅ Email service test completed successfully!');
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    console.error('Full error:', error);
  }
}

testEmailService();