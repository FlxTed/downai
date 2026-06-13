function summarizePrompt(text: string, max = 72): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export async function notifyAiComplete(options: {
  prompt: string;
  success: boolean;
  kind?: 'chat' | 'edit';
  error?: string;
}) {
  const { prompt, success, kind = 'chat', error } = options;
  const summary = summarizePrompt(prompt);

  const title = success
    ? kind === 'edit'
      ? 'DownAI — Edit ready'
      : 'DownAI — Response ready'
    : kind === 'edit'
      ? 'DownAI — Edit failed'
      : 'DownAI — Request failed';

  const body = success
    ? summary || (kind === 'edit' ? 'Your inline edit is ready to apply.' : 'Your chat response is ready.')
    : error || summary || 'Something went wrong.';

  try {
    await window.downai.notification.show({
      title,
      body,
      force: document.hidden,
    });
  } catch {
    /* notifications optional */
  }
}
