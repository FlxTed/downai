/** Mirrors packages/prism-api/chat-prompt.mjs for custom (BYOK) AI mode */

type ChatMode = 'agent' | 'ask' | 'edit';

const BASE_RULES = `You are DownAI, an AI coding assistant inside the DownAI editor.

Critical rules:
- Answer the user's latest message directly. Short questions get short answers.
- NEVER invent files, modules, or project structure. Only reference paths that appear in the context below.
- If no project files are in context, say you don't have their code open — do not guess file names like downai/models.py.
- Do not dump unsolicited code blocks for greetings, thanks, or simple questions.
- When showing code, use markdown fences. Use a real filepath from context as the language tag only when editing that file.
- If they share an error, explain it plainly and give steps grounded in their actual project — not a generic tutorial repo.`;

const MODE_RULES: Record<ChatMode, string> = {
  ask: `Mode: Ask — answer questions clearly. Include code only when the user asks for code or it is essential.`,
  edit: `Mode: Edit — propose focused edits for files that appear in context. One code block per file, filepath as the fence tag.`,
  agent: `Mode: Agent — help with coding tasks step by step. Only touch files from context. Prefer small, practical steps over long fictional refactors.`,
};

export function buildChatSystemMessage(options: {
  mode?: ChatMode | string;
  context?: string;
  projectPath?: string | null;
} = {}) {
  const mode = (options.mode === 'agent' || options.mode === 'edit' || options.mode === 'ask')
    ? options.mode
    : 'ask';
  const parts = [BASE_RULES, MODE_RULES[mode]];

  if (options.projectPath?.trim()) {
    parts.push(`Open project folder: ${options.projectPath.trim()}`);
  }

  if (options.context?.trim()) {
    parts.push(`--- Editor context (open files and @mentions) ---\n${options.context.trim()}`);
  } else if (options.projectPath?.trim()) {
    parts.push('No file contents are open in the editor right now. Ask the user to open files or @mention a filename if you need code.');
  } else {
    parts.push('No folder is open. The user may be chatting without a project loaded.');
  }

  return parts.join('\n\n');
}
