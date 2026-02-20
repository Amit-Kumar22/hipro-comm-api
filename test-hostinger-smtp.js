import nodemailer from 'nodemailer';

// Test Hostinger SMTP with info@hiprotech.org credentials
const testHostingerSMTP = async () => {
    console.log('🔧 Testing Hostinger SMTP Configuration (info@hiprotech.org)');
    console.log('Email: info@hiprotech.org');
    console.log('Host: smtp.hostinger.com');
    console.log('Port: 587');
    console.log('Secure: false');

    const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false, // false for 587
        auth: {
            user: 'info@hiprotech.org',
            pass: 'Abhi@2026'
        },
        tls: {
            rejectUnauthorized: false
        },
        debug: true, // Enable debug mode
        logger: true // Enable logging
    });

    try {
        console.log('🔄 Testing SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        
        // Test sending an actual email
        console.log('📧 Sending test OTP email...');
        const info = await transporter.sendMail({
            from: '"HiPro Commerce" <info@hiprotech.org>',
            to: 'info@hiprotech.org', // Send to self for testing
            subject: 'Test OTP - HiPro Commerce Registration',
            text: 'Hello Test User,\n\nYour verification code is: 123456\n\nThis is a test email to verify SMTP configuration.\n\nBest regards,\nHiPro Commerce Team',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #f97316;">Verify Your Email</h2>
              <p>Hello <strong>Test User</strong>,</p>
              <p>Thank you for registering with HiPro Commerce!</p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h3 style="color: #374151; margin: 0;">Your verification code is:</h3>
                <div style="font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 8px; margin: 15px 0;">123456</div>
                <p style="color: #6b7280; margin: 0; font-size: 14px;">This code will expire in 10 minutes</p>
              </div>
              
              <p>Enter this code to verify your email address and complete your registration.</p>
              <p style="color: #6b7280; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px;">Best regards,<br>HiPro Commerce Team</p>
            </div>`
        });
        
        console.log('✅ Test OTP email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('Accepted:', info.accepted);
        console.log('Rejected:', info.rejected);
        
    } catch (error) {
        console.error('❌ SMTP test failed:', error);
        console.error('Error details:', {
            code: error.code,
            errno: error.errno,
            command: error.command,
            response: error.response
        });
    }
};

testHostingerSMTP();