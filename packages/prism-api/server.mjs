/**
 * DownAI proxy — hosted AI for all users (keys in .env only).
 */
import http from 'http';
import { activateLicenseKey, resolveAuth } from './license.mjs';
import { handleStripeWebhook } from './stripe-webhook.mjs';
import { handlePromptGeneration, parsePromptResponse } from './prompts.mjs';
import { chatCompletion, resolveProvider, getDefaultModel, listProviderStatus } from './ai.mjs';
import { buildChatSystemMessage } from './chat-prompt.mjs';
import { getUsage, bumpUsage } from './usage-store.mjs';
import { corsHeaders, json, readAuth } from './security.mjs';
import { verifySessionToken } from './session.mjs';
import { attachCollaboration } from './collaboration.mjs';

const PORT = Number(process.env.PORT || 8787);
const FREE_DAILY_LIMIT = Number(process.env.DOWNAI_FREE_DAILY_LIMIT || 10);
const PROMPT_DAILY_LIMIT = Number(process.env.DOWNAI_PROMPT_DAILY_LIMIT || 8);
const isProduction = process.env.NODE_ENV === 'production';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    const active = resolveProvider();
    if (isProduction) {
      return json(res, req, 200, { ok: true, provider: active?.id ?? null });
    }
    return json(res, req, 200, {
      ok: true,
      provider: active?.id ?? null,
      model: active?.model ?? getDefaultModel(),
      providers: listProviderStatus(),
    });
  }

  if (req.method === 'POST' && req.url === '/webhooks/stripe') {
    try {
      const raw = await readBody(req);
      const sig = req.headers['stripe-signature'] || '';
      const result = await handleStripeWebhook(raw, sig);
      return json(res, req, result.status, result.body);
    } catch (e) {
      return json(res, req, 500, { error: e instanceof Error ? e.message : 'Webhook error' });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/license/activate') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const key = body.key?.trim();
      const deviceId = body.deviceId?.trim();
      if (!key || !deviceId) {
        return json(res, req, 400, { error: 'key and deviceId are required' });
      }
      const result = activateLicenseKey(key, deviceId);
      return json(res, req, result.status, result.body);
    } catch (e) {
      return json(res, req, 500, { error: e instanceof Error ? e.message : 'Activation error' });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/license/status') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const auth = readAuth(req);
      const token = body.token || auth.bearer;
      const deviceId = body.deviceId || auth.deviceId;
      const session = verifySessionToken(token);
      if (!session.valid) {
        return json(res, req, 401, { error: 'Session expired. Activate your license again.' });
      }
      if (session.payload.deviceId && session.payload.deviceId !== deviceId) {
        return json(res, req, 403, { error: 'Device mismatch' });
      }
      return json(res, req, 200, {
        plan: session.payload.plan,
        isPro: session.payload.plan === 'pro',
        email: session.payload.email,
        expiresAt: session.payload.licenseExpiresAt,
      });
    } catch (e) {
      return json(res, req, 500, { error: e instanceof Error ? e.message : 'Status error' });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/prompts') {
    if (!resolveProvider()) {
      return json(res, req, 503, { error: 'Prompt generator unavailable.' });
    }
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const auth = readAuth(req);
      const entitlement = resolveAuth(auth);
      const usageId = entitlement.isPro ? entitlement.usageId : `prompt:${auth.deviceId}`;
      const dailyLimit = entitlement.isPro ? 999999 : PROMPT_DAILY_LIMIT;

      const prep = await handlePromptGeneration(body, auth.deviceId, getUsage, bumpUsage, {
        daily: dailyLimit,
        usageId,
      });
      if (!prep.ok) return json(res, req, prep.status, prep.body);

      const content = await chatCompletion(
        [
          { role: 'system', content: prep.systemMessage },
          { role: 'user', content: prep.userMessage },
        ],
        { temperature: 0.65, max_tokens: 1200 }
      );

      const prompts = parsePromptResponse(content);
      if (!prompts) {
        return json(res, req, 502, { error: 'Could not parse AI response. Try again.' });
      }

      bumpUsage(prep.usageId);

      return json(res, req, 200, {
        prompts,
        usage: {
          generationsToday: prep.used.count + 1,
          dailyLimit,
          isPro: entitlement.isPro,
        },
      });
    } catch (e) {
      return json(res, req, 500, { error: e instanceof Error ? e.message : 'Server error' });
    }
  }

  if (req.method !== 'POST' || req.url !== '/v1/chat') {
    return json(res, req, 404, { error: 'Not found' });
  }

  if (!resolveProvider()) {
    return json(res, req, 503, { error: 'No AI provider configured.' });
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const auth = readAuth(req);
    const entitlement = resolveAuth(auth);
    const usageId = entitlement.isPro ? entitlement.usageId : `free:${auth.deviceId}`;
    const used = getUsage(usageId);

    if (!entitlement.isPro && used.count >= FREE_DAILY_LIMIT) {
      return json(res, req, 429, {
        error: `Free plan includes ${FREE_DAILY_LIMIT} AI messages per day. Upgrade to Pro for unlimited.`,
      });
    }

    const messages = body.messages;
    const context = body.context || '';
    const mode = body.mode || 'ask';
    const projectPath = body.projectPath || '';
    if (!Array.isArray(messages) || messages.length === 0) {
      return json(res, req, 400, { error: 'messages required' });
    }

    const systemMessage = buildChatSystemMessage({ mode, context, projectPath });

    const content = await chatCompletion(
      [{ role: 'system', content: systemMessage }, ...messages],
      { model: body.model || getDefaultModel(), temperature: 0.35 }
    );

    bumpUsage(usageId);

    return json(res, req, 200, {
      content,
      usage: {
        messagesToday: used.count + 1,
        dailyLimit: entitlement.isPro ? 999999 : FREE_DAILY_LIMIT,
        isPro: entitlement.isPro,
      },
    });
  } catch (e) {
    return json(res, req, 500, { error: e instanceof Error ? e.message : 'Server error' });
  }
});

attachCollaboration(server);

server.listen(PORT, () => {
  const active = resolveProvider();
  console.log(`DownAI proxy on http://localhost:${PORT}`);
  if (active) {
    console.log(`Provider: ${active.label} (${active.id}) · Model: ${active.model}`);
  } else {
    console.log('WARNING: No API keys configured — edit packages/prism-api/.env');
  }
  if (!process.env.DOWNAI_LICENSE_SECRET) {
    console.log('WARNING: DOWNAI_LICENSE_SECRET not set — license activation disabled');
  }
  console.log(`Free limit: ${FREE_DAILY_LIMIT}/day · Prompt lab: ${PROMPT_DAILY_LIMIT}/day`);
});
