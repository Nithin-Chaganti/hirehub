import nodemailer from 'nodemailer';
import config from '../config/env.js';

/**
 * Email Service
 *
 * Handles all outbound email communication using Nodemailer.
 * Currently used for password reset emails; designed for easy extension
 * to notification emails, application status updates, etc.
 *
 * Why a singleton transporter?
 * Nodemailer recommends creating the transporter once and reusing it.
 * Creating a new transporter per email wastes TCP connections and
 * can trigger SMTP rate limits.
 *
 * Why a generic sendEmail() + specific sendPasswordResetEmail()?
 * sendEmail() is the low-level utility — any future email type just
 * builds an HTML template and calls sendEmail(). This keeps the
 * transport logic centralized and DRY.
 */

// ─── Transporter (Singleton) ─────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

const FROM_ADDRESS = `"HireHub" <${config.SMTP_USER}>`;

// ─── Generic Email Sender ────────────────────────────────────────

/**
 * Send an email using the configured SMTP transporter.
 *
 * @param {object} options
 * @param {string} options.to       — Recipient email address
 * @param {string} options.subject  — Email subject line
 * @param {string} options.html     — HTML email body
 * @returns {Promise<object>} Nodemailer info object
 */
export const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

// ─── Password Reset Email ────────────────────────────────────────

/**
 * Send a password reset email with a tokenized link.
 *
 * The link points to the frontend reset-password page, which will
 * extract the token from the URL and POST it to the backend
 * /api/v1/auth/reset-password/:token endpoint.
 *
 * @param {string} to        — Recipient email address
 * @param {string} resetUrl  — Full reset URL including the token
 * @returns {Promise<object>} Nodemailer info object
 */
export const sendPasswordResetEmail = async (to, resetUrl) => {
  const subject = 'HireHub — Password Reset Request';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f3460 0%, #533483 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">HireHub</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Password Reset Request</h2>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          You requested a password reset for your HireHub account. 
          Click the button below to set a new password:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: linear-gradient(135deg, #e94560 0%, #c0392b 100%); 
                    color: #ffffff; 
                    padding: 14px 32px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-size: 16px; 
                    font-weight: 600;
                    display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="color: #888; font-size: 14px; line-height: 1.6;">
          This link expires in <strong>30 minutes</strong>. If you didn't request 
          this reset, you can safely ignore this email — your password won't change.
        </p>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />

        <p style="color: #aaa; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${resetUrl}" style="color: #0f3460; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};
