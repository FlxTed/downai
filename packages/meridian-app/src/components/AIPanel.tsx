import { useState, useRef, useEffect } from 'react';
import { ArrowUp, X, AtSign, Plus, ImagePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuid } from 'uuid';
import { flattenFiles } from '../utils/fileTree';
import { useEditorStore } from '../store/editorStore';
import { useLicenseStore } from '../store/licenseStore';
import { useChatStore, type ChatMessage, type ChatMode } from '../store/chatStore';
import { notifyAiComplete } from '../utils/notifyAiComplete';
import { filesToDataUrls, MAX_IMAGES } from '../utils/chatImages';
import { AiStatusLine } from './AiStatusLine';
import styles from './AIPanel.module.css';

interface Props {
  onClose: () => void;
  onUpgrade: (reason?: string) => void;
}

const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: 'agent', label: 'Agent', hint: 'Multi-step coding assistant' },
  { id: 'ask', label: 'Ask', hint: 'Quick Q&A' },
  { id: 'edit', label: 'Edit', hint: 'Code changes with Apply' },
];

function looksLikePath(lang: string) {
  return lang.includes('/') || lang.includes('.');
}

function CodeBlock({
  code,
  lang,
  onApply,
  onWriteFile,
}: {
  code: string;
  lang?: string;
  onApply?: (c: string) => void;
  onWriteFile?: (path: string, c: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const filePath = lang && looksLikePath(lang) ? lang : null;
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        {filePath && <span className={styles.codeLang}>{filePath}</span>}
        <button className={styles.codeAction} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {onApply && !filePath && (
          <button className={styles.codeAction} onClick={() => onApply(code)}>Apply</button>
        )}
        {onWriteFile && filePath && (
          <button className={styles.codeAction} onClick={() => onWriteFile(filePath, code)}>Write file</button>
        )}
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function MessageImages({ images }: { images: string[] }) {
  return (
    <div className={styles.messageImages}>
      {images.map((src, i) => (
        <img key={i} src={src} alt="" className={styles.messageImage} />
      ))}
    </div>
  );
}

export function AIPanel({ onClose, onUpgrade }: Props) {
  const {
    loaded, threads, activeThreadId, mode,
    load, setMode, setActiveThread, newThread, updateActiveMessages,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'context' | 'generating' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getContextForAI, getActiveFile, updateFileContent, getFileContent, fileTree, openFile, createFile, refreshTree, projectPath } = useEditorStore();
  const { status, refresh: refreshLicense } = useLicenseStore();

  const messages = threads.find(t => t.id === activeThreadId)?.messages ?? [];

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, attachments]);

  const addContext = () => {
    const file = getActiveFile();
    if (file) setInput(prev => prev + (prev ? ' ' : '') + `@${file.name}`);
  };

  const addImages = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    try {
      const urls = await filesToDataUrls(files);
      if (!urls.length) return;
      setAttachments(prev => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add image';
      updateActiveMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: msg }]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const applyCode = (code: string) => {
    const file = getActiveFile();
    if (file) updateFileContent(file.path, code);
  };

  const writeToFile = async (filePath: string, code: string) => {
    const existing = flattenFiles(fileTree).find(f => f.path === filePath || f.path.endsWith(`/${filePath}`));
    if (existing) {
      updateFileContent(existing.path, code);
      await openFile(existing.path);
    } else {
      await createFile(filePath);
      updateFileContent(filePath, code);
      await refreshTree();
    }
  };

  const buildContext = async (text: string) => {
    let ctx = getContextForAI();
    const mentions = text.match(/@([\w.-]+)/g);
    if (!mentions) return ctx;
    const files = flattenFiles(fileTree);
    for (const m of mentions) {
      const name = m.slice(1);
      const match = files.find(f => f.name === name || f.path.endsWith(`/${name}`) || f.path === name);
      if (match) {
        const content = await getFileContent(match.path);
        if (content) ctx += `\n\n--- @${name} (${match.path}) ---\n${content.slice(0, 3000)}`;
      }
    }
    return ctx;
  };

  const sendMessage = async () => {
    const text = input.trim();
    const images = attachments.length ? [...attachments] : undefined;
    if ((!text && !images?.length) || loading) return;

    const userMsg: ChatMessage = { id: uuid(), role: 'user', content: text, images };
    updateActiveMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setLoadingPhase('context');

    try {
      const context = await buildContext(text);
      setLoadingPhase('generating');
      const payload = [...messages, userMsg]
        .filter(m => !isHistoryNoise(m))
        .slice(-20)
        .map(m => ({
          role: m.role,
          content: m.content,
          images: m.images,
        }));

      const response = await window.downai.ai.chat(payload, {
        context,
        mode,
        projectPath,
      });
      updateActiveMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: response }]);
      await refreshLicense();
      void notifyAiComplete({ prompt: text || 'Image message', success: true, kind: 'chat' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateActiveMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: errorMsg }]);
      void notifyAiComplete({ prompt: text || 'Image message', success: false, kind: 'chat', error: errorMsg });
      if (errorMsg.includes('Free plan') || errorMsg.includes('Upgrade')) onUpgrade(errorMsg);
      await refreshLicense();
    } finally {
      setLoading(false);
      setLoadingPhase(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      void addImages(imageFiles);
    }
  };

  const showApply = mode === 'edit' || mode === 'agent';
  const showWrite = mode === 'agent';
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !loading;

  const isErrorMessage = (content: string) =>
    content.startsWith('Error') ||
    content.includes('failed (') ||
    content.includes('Something went wrong') ||
    content.includes('Could not add image');

  const isHistoryNoise = (msg: ChatMessage) =>
    msg.role === 'assistant' && isErrorMessage(msg.content);

  const renderContent = (content: string, isAssistant: boolean) => {
    if (!isAssistant) return content ? <p>{content}</p> : null;
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const match = part.match(/^```(\w*[\w./\-]*)\n?([\s\S]*?)```$/);
      if (match) {
        const lang = match[1] || undefined;
        return (
          <CodeBlock
            key={i}
            lang={lang}
            code={match[2].trim()}
            onApply={showApply ? applyCode : undefined}
            onWriteFile={showWrite ? writeToFile : undefined}
          />
        );
      }
      if (!part.trim()) return null;
      return <ReactMarkdown key={i}>{part}</ReactMarkdown>;
    });
  };

  if (!loaded) {
    return (
      <aside className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Chat</span>
        </div>
        <div className={styles.empty}>
          <p className={styles.emptyHint}>Loading chat…</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {threads.length > 1 ? (
            <select
              className={styles.threadSelect}
              value={activeThreadId}
              onChange={e => setActiveThread(e.target.value)}
            >
              {threads.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          ) : (
            <span className={styles.headerTitle}>Chat</span>
          )}
          {!status.isPro && (
            <button className={styles.proBadge} onClick={() => onUpgrade()}>Upgrade</button>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={() => newThread(uuid())} title="New chat">
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <button className={styles.headerBtn} onClick={onClose} title="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className={styles.modeBar}>
        {MODES.map(m => (
          <button
            key={m.id}
            className={`${styles.modeBtn} ${mode === m.id ? styles.modeActive : ''}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && !loading && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Start a conversation</p>
            <p className={styles.emptyHint}>{MODES.find(m => m.id === mode)?.hint}</p>
          </div>
        )}
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          const isError = msg.role === 'assistant' && isErrorMessage(msg.content);

          if (isUser) {
            return (
              <div key={msg.id} className={`${styles.message} ${styles.user}`}>
                <div className={styles.bubble}>
                  {msg.images?.length ? <MessageImages images={msg.images} /> : null}
                  {msg.content ? <div className={styles.messageBody}><p>{msg.content}</p></div> : null}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`${styles.message} ${styles.assistant} ${isError ? styles.error : ''}`}
            >
              {isError ? (
                <div className={styles.bubble}>
                  <div className={styles.messageBody}>{msg.content}</div>
                </div>
              ) : (
                <div className={styles.assistantBody}>
                  <div className={styles.messageBody}>
                    {renderContent(msg.content, true)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className={`${styles.message} ${styles.statusMessage}`}>
            <div className={styles.assistantBody}>
              <AiStatusLine active={loading} phase={loadingPhase} variant="chat" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.composerWrap}>
        <div className={styles.composer}>
          {attachments.length > 0 && (
            <div className={styles.attachmentRow}>
              {attachments.map((src, i) => (
                <div key={i} className={styles.attachmentThumb}>
                  <img src={src} alt="" />
                  <button
                    type="button"
                    className={styles.attachmentRemove}
                    onClick={() => removeAttachment(i)}
                    aria-label="Remove image"
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message… (paste or attach images)"
            rows={2}
          />
          <div className={styles.composerBar}>
            <div className={styles.composerTools}>
              <button className={styles.toolBtn} title="Add context" onClick={addContext}>
                <AtSign size={14} strokeWidth={1.5} />
              </button>
              <button
                className={styles.toolBtn}
                title="Attach image"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_IMAGES}
              >
                <ImagePlus size={14} strokeWidth={1.5} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.hiddenInput}
                onChange={e => {
                  void addImages(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <button
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={!canSend}
            >
              <ArrowUp size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
