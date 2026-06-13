import { resolveProvider, getDefaultModel, listProviderStatus } from './providers.mjs';

const OPENAI_MODELS = /^gpt-|^o[134]-/i;

const VISION_MODELS = {
  groq: () => process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview',
  openai: () => process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  gemini: () => process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  openrouter: () => process.env.OPENROUTER_VISION_MODEL || 'openai/gpt-4o-mini',
  mistral: () => process.env.MISTRAL_VISION_MODEL || 'pixtral-12b-2409',
  deepseek: () => process.env.DEEPSEEK_VISION_MODEL || 'deepseek-chat',
};

/** Use the active provider's model when the client sends a generic OpenAI default. */
function resolveRequestModel(provider, requested, { vision = false } = {}) {
  if (vision) {
    const pick = VISION_MODELS[provider.id];
    return pick ? pick() : provider.model;
  }
  const fallback = process.env.DOWNAI_AI_MODEL?.trim() || provider.model;
  const name = requested?.trim();
  if (!name) return fallback;
  if (provider.id !== 'openai' && OPENAI_MODELS.test(name)) return fallback;
  return name;
}

function messageHasImages(messages) {
  return messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((p) => p.type === 'image_url');
    }
    return Boolean(m.images?.length);
  });
}

function formatMessagesForApi(messages) {
  return messages.map((m) => {
    if (Array.isArray(m.content)) return { role: m.role, content: m.content };
    if (m.images?.length) {
      const parts = [];
      if (m.content?.trim()) parts.push({ type: 'text', text: m.content });
      for (const url of m.images) {
        parts.push({ type: 'image_url', image_url: { url } });
      }
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content ?? '' };
  });
}

async function chatCompletion(messages, { model, temperature = 0.35, max_tokens = 4096 } = {}) {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error('No AI provider configured. Paste at least one API key in packages/prism-api/.env');
  }

  const formatted = formatMessagesForApi(messages);
  const vision = messageHasImages(formatted);
  const resolvedModel = resolveRequestModel(provider, model, { vision });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
    ...provider.extraHeaders,
  };

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages: formatted,
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.label} failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export { resolveProvider, getDefaultModel, listProviderStatus, chatCompletion };
