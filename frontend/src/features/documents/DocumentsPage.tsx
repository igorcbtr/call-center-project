import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './DocumentsPage.module.css';

interface Doc {
  id: number;
  user_id: number;
  display_name: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

function getToken() {
  return localStorage.getItem('mvp_token') || '';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fileIcon(mime: string) {
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('word') || mime?.includes('document')) return '📝';
  if (mime?.includes('excel') || mime?.includes('sheet')) return '📊';
  if (mime?.includes('image')) return '🖼️';
  return '📎';
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/documents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchDocs());
  }, [fetchDocs]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Выберите файл'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('display_name', displayName || file.name);
      const res = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Ошибка');
      toast.success('Документ загружен');
      setDisplayName('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      void fetchDocs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Doc) => {
    try {
      const res = await fetch(`${baseUrl}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { toast.error('Ошибка скачивания'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Ошибка скачивания');
    }
  };

  const handleDelete = async (doc: Doc) => {
    if (!window.confirm(`Удалить «${doc.display_name}»?`)) return;
    try {
      const res = await fetch(`${baseUrl}/documents/${doc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      toast.success('Удалено');
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Мои документы</h1>
          <p className={styles.sub}>Загружайте и храните свои рабочие документы. Доступны для скачивания в любое время.</p>
        </div>
      </div>

      {/* Upload card */}
      <div className={styles.uploadCard}>
        <h2 className={styles.uploadTitle}>📤 Загрузить документ</h2>
        <div className={styles.uploadRow}>
          <div className={styles.uploadFields}>
            <input
              className={styles.input}
              placeholder="Название документа (необязательно)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
            <label className={styles.fileLabel}>
              <input
                ref={fileRef}
                type="file"
                className={styles.fileInput}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                onChange={e => setFileName(e.target.files?.[0]?.name || '')}
              />
              <span className={styles.fileLabelText}>
                {fileName || '📎 Выбрать файл'}
              </span>
            </label>
          </div>
          <button
            className={styles.uploadBtn}
            onClick={() => void handleUpload()}
            disabled={uploading}
          >
            {uploading ? 'Загрузка…' : '⬆ Загрузить'}
          </button>
        </div>
        <p className={styles.hint}>Поддерживаемые форматы: PDF, Word, Excel, изображения, текст. Максимум 20 МБ.</p>
      </div>

      {/* Documents list */}
      <div className={styles.listSection}>
        <div className={styles.listHead}>
          <h2 className={styles.secTitle}>Мои файлы ({docs.length})</h2>
          <button className={styles.refreshBtn} onClick={() => void fetchDocs()} disabled={loading}>
            {loading ? '…' : '↻ Обновить'}
          </button>
        </div>

        {loading && <div className={styles.empty}>Загрузка…</div>}
        {!loading && docs.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📁</div>
            <p className={styles.emptyText}>Документов пока нет</p>
            <p className={styles.emptyHint}>Загрузите первый документ выше</p>
          </div>
        )}

        <div className={styles.docGrid}>
          {docs.map(doc => (
            <div key={doc.id} className={styles.docCard}>
              <div className={styles.docIcon}>{fileIcon(doc.mime_type)}</div>
              <div className={styles.docInfo}>
                <div className={styles.docName}>{doc.display_name}</div>
                <div className={styles.docMeta}>
                  <span>{formatSize(doc.file_size)}</span>
                  <span>·</span>
                  <span>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div className={styles.docActions}>
                <button
                  className={styles.downloadBtn}
                  onClick={() => void handleDownload(doc)}
                  title="Скачать"
                >
                  ⬇ Скачать
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => void handleDelete(doc)}
                  title="Удалить"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
