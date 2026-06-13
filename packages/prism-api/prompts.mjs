const PROMPT_SYSTEM = `You are a prompt engineer for DownAI, a desktop code editor (Monaco + Electron) with:
- **Chat** (Ctrl+L): multi-turn assistant; users can @mention open files for context
- **Inline edit** (Ctrl+K): transform the current selection or whole file in one shot

Given the user's goal, output ONLY valid JSON (no markdown fences):
{
  "chatPrompt": "A detailed prompt to paste into DownAI chat — include role, task, constraints, and acceptance criteria",
  "inlinePrompt": "A focused prompt for Ctrl+K inline edit on a specific file or selection",
  "contextTip": "Which files or folders to open and @mention in chat",
  "followUp": "One follow-up prompt if the first result needs refinement"
}

Rules:
- Prompts must be ready to copy-paste — no placeholders like [your file]
- Mention DownAI features when helpful (@file context, terminal, git)
- Be concise but specific; prefer bullet constraints in chatPrompt
- Tailor to the user's stack if they mention one`;

export async function handlePromptGeneration(body, deviceId, getUsage, bumpUsage, limits) {
  const task = body?.task?.trim();
  if (!task || task.length < 3) {
    return { ok: false, status: 400, body: { error: 'Describe what you want to build (at least 3 characters).' } };
  }

  const stack = body?.stack?.trim() || 'auto-detect from project';
  const mode = body?.mode === 'inline' ? 'inline' : body?.mode === 'chat' ? 'chat' : 'both';

  const usageId = limits.usageId || `prompt:${deviceId}`;
  const used = getUsage(usageId);
  if (used.count >= limits.daily) {
    return {
      ok: false,
      status: 429,
      body: { error: `Daily limit reached (${limits.daily} generations). Try again tomorrow or use the templates below.` },
    };
  }

  const userMessage = `Goal: ${task}
Stack / language: ${stack}
Focus: ${mode === 'both' ? 'chat + inline edit prompts' : mode + ' prompt only'}

Generate DownAI-ready prompts as JSON.`;

  return {
    ok: true,
    systemMessage: PROMPT_SYSTEM,
    userMessage,
    usageId,
    used,
    limits,
  };
}

export function parsePromptResponse(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.chatPrompt && !parsed.inlinePrompt) return null;
    return {
      chatPrompt: parsed.chatPrompt || '',
      inlinePrompt: parsed.inlinePrompt || '',
      contextTip: parsed.contextTip || '',
      followUp: parsed.followUp || '',
    };
  } catch {
    return null;
  }
}
