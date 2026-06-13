/**
 * AI provider configs — paste keys in .env, set DOWNAI_PROVIDER to switch.
 * Keys: https://links in packages/prism-api/SETUP.md
 */

const PLACEHOLDER = /^PASTE_|^sk-your|^gsk_your|^your_/i;

function isRealKey(key) {
  return Boolean(key?.trim()) && !PLACEHOLDER.test(key.trim());
}

const PROVIDERS = {
  groq: {
    label: 'Groq',
    apiKey: process.env.GROQ_API_KEY || '',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview',
  },
  gemini: {
    label: 'Google Gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
  openai: {
    label: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  openrouter: {
    label: 'OpenRouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
    extraHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://downai.dev',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'DownAI',
    },
  },
  mistral: {
    label: 'Mistral',
    apiKey: process.env.MISTRAL_API_KEY || '',
    baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  },
  deepseek: {
    label: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
};

export function listProviderStatus() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    configured: isRealKey(p.apiKey),
    model: p.model,
  }));
}

/** Active provider for all hosted AI requests */
export function resolveProvider() {
  const preferred = (process.env.DOWNAI_PROVIDER || 'groq').toLowerCase().trim();
  const cfg = PROVIDERS[preferred];

  if (cfg && isRealKey(cfg.apiKey)) {
    return { id: preferred, ...cfg, extraHeaders: cfg.extraHeaders || {} };
  }

  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (isRealKey(p.apiKey)) {
      return { id, ...p, extraHeaders: p.extraHeaders || {} };
    }
  }

  return null;
}

export function getDefaultModel() {
  const p = resolveProvider();
  if (p) return p.model;
  return process.env.DOWNAI_AI_MODEL || 'gpt-4o-mini';
}
