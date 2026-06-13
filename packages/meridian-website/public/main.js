(function () {
  'use strict';

  const ua = navigator.userAgent.toLowerCase();
  const os = ua.includes('mac') ? 'mac' : 'windows';

  document.querySelectorAll('[data-os]').forEach((el) => {
    if (el.dataset.os === os) el.classList.add('recommended');
  });

  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle?.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.stagger-group').forEach((group) => {
    group.querySelectorAll('.stagger-item').forEach((item, i) => {
      item.style.setProperty('--stagger-index', i);
    });
  });

  const revealTargets = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (prefersReducedMotion) {
    revealTargets.forEach((el) => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
    );
    revealTargets.forEach((el) => observer.observe(el));
  }

  document.querySelectorAll('.workflow-step').forEach((step, i) => {
    step.classList.add(i % 2 === 0 ? 'reveal-left' : 'reveal-right');
    if (!prefersReducedMotion) {
      const stepObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              stepObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );
      stepObserver.observe(step);
    } else {
      step.classList.add('visible');
    }
  });

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    if (Number.isNaN(target)) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) {
    if (prefersReducedMotion) {
      statsBar.classList.add('visible');
    } else {
      const statsObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              entry.target.querySelectorAll('[data-count]').forEach(animateCount);
              statsObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35 }
      );
      statsObserver.observe(statsBar);
    }
  }

  const demoAppEl = document.getElementById('demo-app');

  const nav = document.querySelector('.nav');
  if (nav && !prefersReducedMotion) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        nav.classList.toggle('nav-scrolled', window.scrollY > 12);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (nav) {
    nav.classList.add('nav-scrolled');
  }

  async function initDownloads() {
    const versionEl = document.getElementById('download-version');
    const noticeEl = document.getElementById('download-notice');

    try {
      const res = await fetch('/downloads/manifest.json');
      if (!res.ok) throw new Error('manifest missing');
      const manifest = await res.json();

      if (versionEl && manifest.version) {
        versionEl.textContent = `Version ${manifest.version} · Activate your plan after install`;
      }

      const byOs = Object.fromEntries((manifest.files || []).map((f) => [f.id, f]));

      document.querySelectorAll('[data-os]').forEach((el) => {
        const file = byOs[el.dataset.os];
        if (!file || (file.id === 'mac' && !file.size)) {
          el.classList.add('unavailable');
          el.removeAttribute('href');
          el.setAttribute('aria-disabled', 'true');
          return;
        }
        el.removeAttribute('aria-disabled');
        const url = file.url.startsWith('http') ? file.url : new URL(file.url, window.location.origin).href;
        el.href = url;
        el.setAttribute('download', file.filename);
        if (file.external) {
          el.setAttribute('rel', 'noopener');
          el.setAttribute('target', '_blank');
        }
        if (el.classList.contains('download-card')) {
          const span = el.querySelector('span');
          if (span) span.textContent = `${file.filename} · ${file.sizeLabel}`;
        } else if (el.classList.contains('dl-btn')) {
          const small = el.querySelector('small');
          if (small) {
            const platform = file.platform || small.textContent;
            small.innerHTML = `${platform}<br><span class="dl-size">${file.sizeLabel}</span>`;
          }
        }
      });

      const missing = ['windows', 'mac'].filter((id) => {
        const file = byOs[id];
        if (!file) return true;
        return id === 'mac' && !file.size;
      });
      if (missing.length && noticeEl) {
        const labels = { windows: 'Windows', mac: 'macOS' };
        noticeEl.textContent = missing.length === 2
          ? 'Installers are being prepared. Clone the repo and run npm run release to build locally.'
          : `${labels[missing[0]]} installer coming soon — ${missing[0] === 'mac' ? 'build on a Mac with npm run build:mac, then npm run sync-downloads && npm run website:deploy' : 'build with npm run build:exe from repo root'}.`;
        noticeEl.classList.remove('hidden');
      } else if (noticeEl) {
        noticeEl.classList.add('hidden');
      }
    } catch {
      if (noticeEl) {
        noticeEl.textContent = 'Download manifest unavailable. Run npm run sync-downloads after building the app.';
        noticeEl.classList.remove('hidden');
      }
    }
  }

  initDownloads();

  function initMarquee() {
    const track = document.getElementById('marquee-track');
    if (!track) return;

    const groups = track.querySelectorAll('.marquee-group');
    if (groups.length < 2) return;

    const syncMarquee = () => {
      const width = groups[0].getBoundingClientRect().width;
      track.style.setProperty('--marquee-distance', `${width}px`);
    };

    syncMarquee();
    window.addEventListener('resize', syncMarquee, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncMarquee);
      ro.observe(groups[0]);
    }
  }

  initMarquee();

  const progressBar = document.getElementById('scroll-progress');
  if (progressBar && !prefersReducedMotion) {
    window.addEventListener('scroll', () => {
      const doc = document.documentElement;
      const pct = (window.scrollY / (doc.scrollHeight - doc.clientHeight)) * 100;
      progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }, { passive: true });
  }

  document.querySelectorAll('.feature-glow').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--glow-x', `${x}%`);
      card.style.setProperty('--glow-y', `${y}%`);
    });
  });

  if (!prefersReducedMotion) {
    document.querySelectorAll('[data-shortcut]').forEach((card, i) => {
      setInterval(() => {
        card.classList.add('pressed');
        setTimeout(() => card.classList.remove('pressed'), 180);
      }, 3200 + i * 400);
    });
  }

  const sectionIds = ['demo', 'workflow', 'features', 'highlights', 'prompt-lab', 'pricing', 'faq', 'download'];
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  if (navAnchors.length && !prefersReducedMotion) {
    const sectionEls = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const onSectionScroll = () => {
      const y = window.scrollY + 100;
      let current = sectionIds[0];
      for (const el of sectionEls) {
        if (el.offsetTop <= y) current = el.id;
      }
      navAnchors.forEach((a) => {
        a.classList.toggle('nav-active', a.getAttribute('href') === `#${current}`);
      });
    };

    window.addEventListener('scroll', onSectionScroll, { passive: true });
    onSectionScroll();
  }

  navAnchors.forEach((a) => {
    a.addEventListener('click', () => {
      navLinks?.classList.remove('open');
      toggle?.classList.remove('open');
    });
  });

  document.querySelectorAll('#faq-list .faq-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('#faq-list .faq-item').forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const demoApp = demoAppEl;
  if (!demoApp) return;

  let plan = 'free';
  const paywall = document.getElementById('demo-paywall');
  const aiPanel = document.getElementById('demo-ai');
  const aiMessages = document.getElementById('demo-ai-messages');
  const aiInput = document.getElementById('demo-ai-input');
  const aiSend = document.getElementById('demo-ai-send');

  const PRO_ONLY_VIEWS = new Set(['ai', 'git']);

  const BOT_REPLIES = [
    'You can refactor this into a custom hook for cleaner state management.',
    'Consider extracting theme tokens into a shared config file.',
    'This pattern matches React 18 concurrent features — looks good.',
    'Add error boundaries around the editor for production resilience.',
  ];

  function isPro() {
    return plan === 'pro';
  }

  function showPaywall() {
    paywall.classList.remove('hidden');
  }

  function hidePaywall() {
    paywall.classList.add('hidden');
  }

  function requiresPro() {
    if (isPro()) return false;
    showPaywall();
    return true;
  }

  document.querySelectorAll('.mode-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      plan = btn.dataset.plan;
      hidePaywall();
      if (plan === 'free' && !aiPanel.classList.contains('hidden')) {
        aiPanel.classList.add('hidden');
        document.querySelector('.demo-act-ai')?.classList.remove('active');
      }
    });
  });

  document.getElementById('paywall-dismiss')?.addEventListener('click', hidePaywall);

  document.querySelectorAll('.demo-act').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (PRO_ONLY_VIEWS.has(view) && requiresPro()) return;

      document.querySelectorAll('.demo-act').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'ai') {
        aiPanel.classList.remove('hidden');
        aiInput.focus();
        return;
      }

      aiPanel.classList.add('hidden');
      document.querySelectorAll('.demo-panel').forEach((p) => {
        p.classList.toggle('active', p.dataset.panel === view);
      });
    });
  });

  document.querySelector('.demo-ai-close')?.addEventListener('click', () => {
    aiPanel.classList.add('hidden');
    document.querySelector('.demo-act-ai')?.classList.remove('active');
    document.querySelector('.demo-act[data-view="explorer"]')?.classList.add('active');
  });

  function openFile(fileId) {
    document.querySelectorAll('.demo-file').forEach((f) => {
      f.classList.toggle('active', f.dataset.file === fileId);
    });

    const tabs = document.getElementById('demo-tabs');
    let tab = tabs.querySelector(`.demo-tab[data-file="${fileId}"]`);
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'demo-tab';
      tab.dataset.file = fileId;
      tab.textContent = fileId === 'readme' ? 'README.md' : `${fileId}.${fileId === 'styles' ? 'css' : fileId === 'main' ? 'ts' : 'tsx'}`;
      tabs.appendChild(tab);
      tab.addEventListener('click', () => openFile(fileId));
    }

    document.querySelectorAll('.demo-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.file === fileId);
    });

    document.querySelectorAll('.demo-code').forEach((c) => {
      const isActive = c.dataset.file === fileId;
      c.classList.toggle('active', isActive);
      if (isActive) {
        c.style.animation = 'none';
        void c.offsetHeight;
        c.style.animation = '';
      }
    });
  }

  document.querySelectorAll('.demo-file').forEach((btn) => {
    btn.addEventListener('click', () => openFile(btn.dataset.file));
  });

  document.querySelectorAll('.demo-tab').forEach((tab) => {
    tab.addEventListener('click', () => openFile(tab.dataset.file));
  });

  document.querySelector('.demo-search-hit')?.addEventListener('click', () => {
    openFile('main');
    document.querySelector('.demo-act[data-view="explorer"]')?.click();
  });

  document.querySelectorAll('.demo-bottom-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('demo-locked-feature') && requiresPro()) return;
      document.querySelectorAll('.demo-bottom-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  function appendMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = `demo-msg ${role}`;
    msg.textContent = text;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return msg;
  }

  function sendAiMessage() {
    if (requiresPro()) return;
    const text = aiInput.value.trim();
    if (!text) return;
    aiInput.value = '';
    appendMessage(text, 'user');

    const typing = appendMessage('Thinking…', 'typing');
    setTimeout(() => {
      typing.remove();
      const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      appendMessage(reply, 'bot');
    }, 900);
  }

  aiSend?.addEventListener('click', sendAiMessage);
  aiInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiMessage();
  });
})();
