(function () {
  'use strict';

  const form = document.getElementById('prompt-form');
  if (!form) return;

  const taskEl = document.getElementById('prompt-task');
  const stackEl = document.getElementById('prompt-stack');
  const modeEl = document.getElementById('prompt-mode');
  const modeSelect = document.getElementById('prompt-mode-select');
  const submitBtn = document.getElementById('prompt-submit');
  const usageEl = document.getElementById('prompt-usage');
  const errorEl = document.getElementById('prompt-error');
  const resultsEl = document.getElementById('prompt-results');

  const API_URL = window.DOWNAI_PROMPT_API || '/api/v1/prompts';

  if (modeSelect) {
    const trigger = modeSelect.querySelector('.custom-select-trigger');
    const label = modeSelect.querySelector('.custom-select-label');
    const options = modeSelect.querySelectorAll('.custom-select-option');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = modeSelect.classList.toggle('open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const value = opt.dataset.value || 'both';
        const text = opt.dataset.label || opt.textContent?.trim() || '';
        if (modeEl) modeEl.value = value;
        if (label) label.textContent = text;
        options.forEach((o) => {
          o.classList.toggle('active', o === opt);
          o.setAttribute('aria-selected', o === opt ? 'true' : 'false');
        });
        modeSelect.classList.remove('open');
        trigger?.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', () => {
      modeSelect.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modeSelect.classList.remove('open');
        trigger?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function getDeviceId() {
    const key = 'downai-prompt-device';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function generateLocalPrompts(task, stack, mode) {
    const s = stack || 'the current project stack';
    const chatPrompt = `I'm working in DownAI on ${s}.

Goal: ${task}

Please:
- Use @mentions for relevant open files when you need context
- Propose a step-by-step plan before large changes
- Show code in markdown blocks with language tags
- Call out edge cases and how to test the change

Start by asking what files I have open if context is missing.`;

    const inlinePrompt = `In the current file/selection (${s}):

${task}

Keep existing style and naming conventions. Output only the updated code unless I need a brief note. Preserve imports and exports unless the task requires changing them.`;

    const contextTip = `Open the main files related to this task, then @mention them in chat (e.g. the component, API route, or test file). For inline edit, select the exact block to change and press Ctrl+K.`;

    const followUp = `Review what you just changed for bugs, missing error handling, and a quick manual test checklist. Suggest one improvement I might have missed.`;

    if (mode === 'chat') return { chatPrompt, inlinePrompt: '', contextTip, followUp };
    if (mode === 'inline') return { chatPrompt: '', inlinePrompt, contextTip, followUp: '' };
    return { chatPrompt, inlinePrompt, contextTip, followUp };
  }

  function showResults(prompts, mode) {
    const chatWrap = document.getElementById('result-chat-wrap');
    const inlineWrap = document.getElementById('result-inline-wrap');
    const tipWrap = document.getElementById('result-tip-wrap');
    const followWrap = document.getElementById('result-follow-wrap');

    document.getElementById('result-chat').textContent = prompts.chatPrompt || '';
    document.getElementById('result-inline').textContent = prompts.inlinePrompt || '';
    document.getElementById('result-tip').textContent = prompts.contextTip || '';
    document.getElementById('result-follow').textContent = prompts.followUp || '';

    chatWrap.classList.toggle('hidden', mode === 'inline' || !prompts.chatPrompt);
    inlineWrap.classList.toggle('hidden', mode === 'chat' || !prompts.inlinePrompt);
    tipWrap.classList.toggle('hidden', !prompts.contextTip);
    followWrap.classList.toggle('hidden', !prompts.followUp);

    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Generating…' : 'Generate prompts';
  }

  document.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      taskEl.value = chip.dataset.task || '';
      taskEl.focus();
    });
  });

  document.querySelectorAll('.prompt-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.copy;
      const map = {
        chat: 'result-chat',
        inline: 'result-inline',
        follow: 'result-follow',
      };
      const el = document.getElementById(map[kind]);
      if (!el?.textContent) return;
      await navigator.clipboard.writeText(el.textContent);
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = prev; }, 1500);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    usageEl.classList.add('hidden');

    const task = taskEl.value.trim();
    const stack = stackEl.value.trim();
    const mode = modeEl?.value || 'both';

    if (task.length < 3) {
      errorEl.textContent = 'Describe your goal in a few words.';
      errorEl.classList.remove('hidden');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DownAI-Device': getDeviceId(),
        },
        body: JSON.stringify({ task, stack, mode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      showResults(data.prompts, mode);

      if (data.usage) {
        usageEl.textContent = `${data.usage.generationsToday} / ${data.usage.dailyLimit} generations today`;
        usageEl.classList.remove('hidden');
      }
    } catch (err) {
      const fallback = generateLocalPrompts(task, stack, mode);
      showResults(fallback, mode);
      errorEl.textContent =
        err instanceof Error && err.message.includes('fetch')
          ? 'AI server offline — showing template prompts. Run npm run api for live generation.'
          : `${err instanceof Error ? err.message : 'Generation failed'} — showing template prompts.`;
      errorEl.classList.remove('hidden');
    } finally {
      setLoading(false);
    }
  });
})();
