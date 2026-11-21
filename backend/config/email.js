import { parseFrontendOrigins } from './environment.js';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`${name} is required to send verification emails.`);
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }
  return value;
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

export async function sendVerificationEmail(email, name, token) {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const fromAddress = process.env.EMAIL_FROM?.trim() || 'CodeBloom <onboarding@resend.dev>';
  const [frontendOrigin] = parseFrontendOrigins(process.env.FRONTEND_URL);
  const verificationUrl = new URL('/verify-email', frontendOrigin);
  verificationUrl.searchParams.set('token', token);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Verify your CodeBloom email address',
        text: `Hi ${name},\n\nVerify your email address by opening this link:\n${verificationUrl.href}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
        html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your email address by clicking the link below. The link expires in 24 hours.</p><p><a href="${verificationUrl.href}">Verify my email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend API error (${response.status}): ${details}`);
    }
  } catch (cause) {
    console.error('EMAIL_DELIVERY_FAILED:', cause?.code, cause?.message);
    const error = new Error('Verification email delivery failed.', { cause });
    error.code = 'EMAIL_DELIVERY_FAILED';
    throw error;
  }
}