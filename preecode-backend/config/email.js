const sgMail = require('@sendgrid/mail');

// Validate required environment variables
const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

if (!apiKey) {
  console.warn('[email] Missing SENDGRID_API_KEY. Email sending will fail.');
} else {
  console.log('[email] SendGrid configuration loaded successfully');
  sgMail.setApiKey(apiKey);
}

if (!fromEmail) {
  console.warn('[email] Missing SENDGRID_FROM_EMAIL. Using default: noreply@preecode.com');
}

const sendEmail = async ({ to, subject, text, html }) => {
  if (!apiKey) {
    console.error('[email] Cannot send email: SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  const msg = {
    to,
    from: fromEmail || 'noreply@preecode.com',
    subject,
    text,
    html,
  };

  try {
    console.log('[email] Sending email to:', to, 'subject:', subject);
    await sgMail.send(msg);
    console.log('[email] Email sent successfully to:', to);
    return { success: true };
  } catch (error) {
    console.error('[email] SendGrid error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

const sendOtpEmail = async (email, otp) => {
  console.log('[email] Preparing OTP email for:', email);
  const subject = 'Preecode - Password Reset OTP';
  const text = `Your OTP for password reset is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0B0F14; color: #fff; border-radius: 12px;">
      <h2 style="color: #ffa116; margin-bottom: 16px;">Password Reset</h2>
      <p style="color: #d4d4d4; margin-bottom: 24px;">Use the following OTP to reset your password:</p>
      <div style="background: #1a1f26; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ffa116;">${otp}</span>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="color: #9ca3af; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #2d3748; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 12px; text-align: center;">Preecode - Practice Coding, Master DSA</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

module.exports = { sendEmail, sendOtpEmail };
