import crypto from 'crypto';
import { generateLicenseKey } from './license.mjs';
import { loadIssued, saveIssued } from './license-registry.mjs';

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function sendLicenseEmail(to, licenseKey) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DOWNAI_EMAIL_FROM || 'DownAI <onboarding@resend.dev>';

  const subject = 'Your DownAI Pro license key';
  const html = `
    <p>Thanks for subscribing to DownAI Pro.</p>
    <p><strong>Your license key:</strong></p>
    <p style="font-family:monospace;font-size:16px;background:#f4f4f5;padding:12px;border-radius:8px;">${licenseKey}</p>
    <p><strong>Activate in the app:</strong></p>
    <ol>
      <li>Open DownAI</li>
      <li>Settings → Plan → Activate license</li>
      <li>Or press Ctrl+Shift+P → "Activate License"</li>
    </ol>
    <p>Need help? Reply to this email.</p>
  `;

  if (!apiKey) {
    console.log(`[stripe] No RESEND_API_KEY — email ${to} manually with key: ${licenseKey}`);
    return { sent: false, reason: 'no_resend_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[stripe] Resend failed:', err);
    return { sent: false, reason: err };
  }

  return { sent: true };
}

/**
 * Handle Stripe checkout.session.completed — issue license and email customer.
 */
export async function handleStripeWebhook(rawBody, sigHeader) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { ok: false, status: 503, body: { error: 'Stripe webhook not configured' } };
  }

  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    return { ok: false, status: 400, body: { error: 'Invalid signature' } };
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, body: { error: 'Invalid JSON' } };
  }

  if (event.type !== 'checkout.session.completed') {
    return { ok: true, status: 200, body: { received: true, ignored: event.type } };
  }

  const session = event.data?.object;
  const email = session?.customer_details?.email || session?.customer_email;
  const sessionId = session?.id;

  if (!email) {
    console.warn('[stripe] checkout completed but no email on session', sessionId);
    return { ok: true, status: 200, body: { received: true, warning: 'no_email' } };
  }

  const issued = loadIssued();
  const existing = issued.find((r) => r.stripeSessionId === sessionId);
  if (existing) {
    return { ok: true, status: 200, body: { received: true, duplicate: true } };
  }

  const licenseKey = generateLicenseKey(12, {
    email,
    stripeSessionId: sessionId,
    stripeCustomerId: session?.customer ?? null,
    amountTotal: session?.amount_total ?? null,
    currency: session?.currency ?? null,
  });

  const mail = await sendLicenseEmail(email, licenseKey);
  console.log(`[stripe] Pro license issued to ${email} (email sent: ${mail.sent})`);

  return {
    ok: true,
    status: 200,
    body: { received: true, emailSent: mail.sent },
  };
}
