// Email utility for sending transactional emails
// Uses nodemailer with SMTP configuration from environment variables

const nodemailer = require('nodemailer');

// Email configuration from environment
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SyncUp <noreply@syncup.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    // Check if email is configured
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.warn('Email not configured. Set EMAIL_USER and EMAIL_PASSWORD environment variables.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} username - User's username
 */
async function sendPasswordResetEmail(to, resetToken, username) {
  const transport = getTransporter();

  if (!transport) {
    // Email not configured - log the reset link instead
    console.log('='.repeat(60));
    console.log('PASSWORD RESET LINK (email not configured):');
    console.log(`${APP_URL}/auth/reset-password/${resetToken}`);
    console.log('='.repeat(60));
    return { success: true, devMode: true };
  }

  const resetLink = `${APP_URL}/auth/reset-password/${resetToken}`;

  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject: 'Reset Your SyncUp Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Reset Your Password</h2>
        <p>Hi ${username},</p>
        <p>You requested to reset your password for your SyncUp account.</p>
        <p>Click the button below to reset your password:</p>
        <p style="margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #6366f1; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6366f1; word-break: break-all;">${resetLink}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated email from SyncUp. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
Hi ${username},

You requested to reset your password for your SyncUp account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
This is an automated email from SyncUp. Please do not reply to this email.
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
};
