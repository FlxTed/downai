# DownAI API setup

Paste keys in **`.env`** in this folder. Users never see them.

## Get keys

| Provider | Key in `.env` | Sign up |
|----------|---------------|---------|
| Groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| **Gemini** | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai/api-keys |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com/api_keys |

## Which provider is used?

Set in `.env`:

```env
DOWNAI_PROVIDER=gemini
```

Options: `groq` · `gemini` · `openai` · `openrouter` · `mistral` · `deepseek`

If that provider has no key, the server uses the **first provider with a real key**.

## Start

```bash
npm run api
```

Check: http://localhost:8787/health — shows active provider and which keys are configured.

## Example — use Gemini

```env
DOWNAI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
```

Save, restart `npm run api`.
