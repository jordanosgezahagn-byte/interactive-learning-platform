import nodemailer from 'nodemailer';
import { parseFrontendOrigins } from './environment.js';

let transporter;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`${name} is required to send verification emails.`);
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }
  return value;
}

export function getEmailTransport() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: requiredEnv('GMAIL_USER'),
      pass: requiredEnv('GMAIL_APP_PASSWORD')?.replace(/\s+/g, ''),
    },
  });

  return transporter;
}

export async function sendVerificationEmail(email, name, token) {
  const sender = requiredEnv('GMAIL_USER');
  const [frontendOrigin] = parseFrontendOrigins(process.env.FRONTEND_URL);
  const verificationUrl = new URL('/verify-email', frontendOrigin);
  verificationUrl.searchParams.set('token', token);
  const emailTransport = getEmailTransport();

  try {
    await emailTransport.sendMail({
      from: sender,
      to: email,
      subject: 'Verify your CodeBloom email address',
      text: `Hi ${name},\n\nVerify your email address by opening this link:\n${verificationUrl.href}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
      html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your email address by clicking the link below. The link expires in 24 hours.</p><p><a href="${verificationUrl.href}">Verify my email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
    });
  } catch (cause) {
    const error = new Error('Verification email delivery failed.', { cause });
    error.code = 'EMAIL_DELIVERY_FAILED';
    throw error;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
