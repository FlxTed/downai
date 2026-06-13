(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const planParam = params.get('plan');
  const planSelect = document.getElementById('plan-select');
  if (planSelect && (planParam === 'enterprise' || planParam === 'team')) {
    planSelect.value = planParam;
  }

  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle?.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  document.querySelectorAll('.reveal').forEach((el) => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  const form = document.getElementById('contact-form');
  const formError = document.getElementById('form-error');
  const success = document.getElementById('contact-success');
  const layout = document.querySelector('.contact-layout');
  const intro = document.querySelector('.contact-intro');

  let lastMailto = '';
  let lastBody = '';

  function salesEmail(plan) {
    return plan === 'enterprise' ? 'enterprise@downai.dev' : 'sales@downai.dev';
  }

  function buildMessage(data) {
    const planLabel = data.plan === 'enterprise' ? 'Enterprise' : 'Team';
    return [
      `Hi DownAI team,`,
      ``,
      `I'm interested in DownAI ${planLabel}.`,
      ``,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Company: ${data.company}`,
      `Team size: ${data.seats}`,
      ``,
      data.message,
      ``,
      `Thanks,`,
      data.name,
    ].join('\n');
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.classList.remove('hidden');
  }

  function clearError() {
    formError.classList.add('hidden');
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const fd = new FormData(form);
    const data = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      seats: String(fd.get('seats') || '').trim(),
      plan: String(fd.get('plan') || 'team'),
      message: String(fd.get('message') || '').trim(),
    };

    if (!data.name || !data.email || !data.company || !data.seats || !data.message) {
      showError('Please fill in all fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showError('Enter a valid work email.');
      return;
    }

    const to = salesEmail(data.plan);
    const subject = encodeURIComponent(`DownAI ${data.plan === 'enterprise' ? 'Enterprise' : 'Team'} inquiry — ${data.company}`);
    lastBody = buildMessage(data);
    lastMailto = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(lastBody)}`;

    window.location.href = lastMailto;

    layout?.classList.add('hidden');
    intro?.classList.add('hidden');
    form.classList.add('hidden');
    success?.classList.remove('hidden');
  });

  document.getElementById('open-mail-btn')?.addEventListener('click', () => {
    if (lastMailto) window.location.href = lastMailto;
  });

  document.getElementById('copy-mail-btn')?.addEventListener('click', async () => {
    if (!lastBody) return;
    try {
      await navigator.clipboard.writeText(lastBody);
      const btn = document.getElementById('copy-mail-btn');
      if (btn) btn.textContent = 'Copied!';
      setTimeout(() => {
        if (btn) btn.textContent = 'Copy message';
      }, 2000);
    } catch {
      showError('Could not copy — use Open in email app instead.');
      success?.classList.add('hidden');
      form.classList.remove('hidden');
      layout?.classList.remove('hidden');
      intro?.classList.remove('hidden');
    }
  });
})();
