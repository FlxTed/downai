import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLicenseStore } from '../store/licenseStore';
import { setAutoSaveEnabled } from '../store/editorStore';
import { applyTheme } from '../utils/theme';
import styles from './SettingsModal.module.css';

type AiMode = 'hosted' | 'custom';

interface Props {
  onClose: () => void;
  onActivateLicense: () => void;
}

export function SettingsModal({ onClose, onActivateLicense }: Props) {
  const [aiMode, setAiMode] = useState<AiMode>('hosted');
  const [hostedApiUrl, setHostedApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [notifyOnAiComplete, setNotifyOnAiComplete] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState(14);
  const [minimap, setMinimap] = useState(true);
  const [saved, setSaved] = useState(false);
  const { status, deactivate } = useLicenseStore();

  useEffect(() => {
    window.downai.settings.load().then(s => {
      setAiMode(s.aiMode || 'hosted');
      setHostedApiUrl(s.hostedApiUrl || '');
      setHasStoredKey(!!s.hasApiKey);
      setApiKey('');
      setApiBaseUrl(s.apiBaseUrl);
      setModel(s.model);
      setNotifyOnAiComplete(s.notifyOnAiComplete !== false);
      setAutoSave(s.autoSave !== false);
      setTheme(s.theme === 'light' ? 'light' : 'dark');
      setFontSize(s.fontSize ?? 14);
      setMinimap(s.minimap !== false);
      setAutoSaveEnabled(s.autoSave !== false);
      applyTheme(s.theme === 'light' ? 'light' : 'dark');
    });
  }, []);

  const handleSave = async () => {
    await window.downai.settings.save({
      aiMode,
      hostedApiUrl,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      apiBaseUrl,
      model,
      theme,
      fontSize,
      minimap,
      notifyOnAiComplete,
      autoSave,
    });
    setAutoSaveEnabled(autoSave);
    applyTheme(theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3>Plan</h3>
            <div className={styles.planCard}>
              <div>
                <strong>{status.isPro ? 'DownAI Pro' : 'DownAI Free'}</strong>
                <p className={styles.hint}>
                  {status.isPro
                    ? `Active${status.expiresAt ? ` · expires ${new Date(status.expiresAt).toLocaleDateString()}` : ''}`
                    : 'Editor only · Pro unlocks chat, terminal, and git'}
                </p>
              </div>
              {status.isPro ? (
                <button className={styles.linkBtn} onClick={() => deactivate()}>Deactivate</button>
              ) : (
                <button className={styles.linkBtn} onClick={onActivateLicense}>Activate Pro</button>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h3>Models</h3>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${aiMode === 'hosted' ? styles.modeBtnActive : ''}`}
                onClick={() => setAiMode('hosted')}
              >
                Hosted
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${aiMode === 'custom' ? styles.modeBtnActive : ''}`}
                onClick={() => setAiMode('custom')}
              >
                API key
              </button>
            </div>

            {aiMode === 'hosted' ? (
              <>
                <p className={styles.hint}>
                  Uses DownAI servers. No API key required on Pro.
                </p>
                <label className={styles.label}>
                  API endpoint (optional)
                  <input
                    type="text"
                    className={styles.input}
                    value={hostedApiUrl}
                    onChange={e => setHostedApiUrl(e.target.value)}
                    placeholder="Leave blank for default"
                  />
                </label>
              </>
            ) : (
              <>
                <p className={styles.hint}>
                  Bring your own OpenAI-compatible key. Requests go directly from your machine.
                </p>
                <label className={styles.label}>
                  API Key
                  <input
                    type="password"
                    className={styles.input}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={hasStoredKey ? '••••••••  (saved — enter new key to replace)' : 'sk-...'}
                  />
                </label>
                <label className={styles.label}>
                  Base URL
                  <input
                    type="text"
                    className={styles.input}
                    value={apiBaseUrl}
                    onChange={e => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
              </>
            )}

            <label className={styles.label}>
              Model
              <select className={styles.select} value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
              </select>
            </label>
          </section>

          <section className={styles.section}>
            <h3>Editor</h3>
            <label className={styles.label}>
              Theme
              <select className={styles.select} value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className={styles.label}>
              Font size
              <input
                type="number"
                className={styles.input}
                min={11}
                max={24}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value) || 14)}
              />
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={minimap} onChange={e => setMinimap(e.target.checked)} />
              <span>
                <strong>Minimap</strong>
                <span className={styles.hint}>Show code overview on the right side of the editor.</span>
              </span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={autoSave}
                onChange={e => setAutoSave(e.target.checked)}
              />
              <span>
                <strong>Auto-save</strong>
                <span className={styles.hint}>Save files automatically 2 seconds after you stop typing.</span>
              </span>
            </label>
          </section>

          <section className={styles.section}>
            <h3>Notifications</h3>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={notifyOnAiComplete}
                onChange={e => setNotifyOnAiComplete(e.target.checked)}
              />
              <span>
                <strong>Notify when AI finishes</strong>
                <span className={styles.hint}>Desktop alert when chat or inline edit completes while DownAI is in the background.</span>
              </span>
            </label>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
