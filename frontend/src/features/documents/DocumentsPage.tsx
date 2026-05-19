import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useEmployeesQuery } from '../../api/api';
import { useAuth } from '../../hooks/useAuth';
import styles from './DocumentsPage.module.css';

interface Category { id:number; name:string; }
interface Doc {
  id:number; user_id:number; display_name:string; original_name:string; mime_type:string;
  file_size:number; created_at:string; category_id?:number; category_name?:string;
  access_scope?:'owner'|'all'|'specific'; uploaded_by_fio?:string;
  access_users?:{id:number;fio:string}[];
}

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const getToken = () => localStorage.getItem('mvp_token') || '';
const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} Б` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;

export function DocumentsPage() {
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'moderator';
  const { data: employees = [] } = useEmployeesQuery(undefined, { skip: !canManage });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accessScope, setAccessScope] = useState<'all'|'specific'>('all');
  const [accessUserIds, setAccessUserIds] = useState<number[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${getToken()}` }), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, catsRes] = await Promise.all([
        fetch(`${baseUrl}/documents`, { headers }),
        fetch(`${baseUrl}/documents/categories`, { headers }),
      ]);
      const docsData = await docsRes.json();
      const catsData = await catsRes.json();
      if (!docsRes.ok) throw new Error(docsData.message || 'Ошибка загрузки документов');
      if (!catsRes.ok) throw new Error(catsData.message || 'Ошибка загрузки разделов');
      setDocs(Array.isArray(docsData) ? docsData : []);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { queueMicrotask(() => void fetchAll()); }, [fetchAll]);

  const createCategory = async () => {
    if (!categoryName.trim()) { toast.error('Введите название раздела'); return; }
    try {
      const res = await fetch(`${baseUrl}/documents/categories`, {
        method:'POST', headers:{ ...headers, 'Content-Type':'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Ошибка');
      setCategoryName('');
      toast.success('Раздел создан');
      void fetchAll();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };

  const toggleAccessUser = (id: number) => setAccessUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Выберите PDF-файл'); return; }
    if (file.type !== 'application/pdf') { toast.error('Разрешены только PDF-файлы'); return; }
    if (!categoryId) { toast.error('Выберите раздел'); return; }
    if (accessScope === 'specific' && accessUserIds.length === 0) { toast.error('Выберите сотрудников'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('display_name', displayName || file.name);
      fd.append('category_id', categoryId);
      fd.append('access_scope', accessScope);
      fd.append('access_user_ids', JSON.stringify(accessUserIds));
      const res = await fetch(`${baseUrl}/documents/upload`, { method:'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Ошибка');
      toast.success('Документ загружен');
      setDisplayName(''); setFileName(''); setAccessUserIds([]); setAccessScope('all');
      if (fileRef.current) fileRef.current.value = '';
      void fetchAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally { setUploading(false); }
  };

  const handleDownload = async (doc: Doc) => {
    const res = await fetch(`${baseUrl}/documents/${doc.id}/download`, { headers });
    if (!res.ok) { toast.error('Ошибка скачивания'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = doc.original_name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (doc: Doc) => {
    if (!window.confirm(`Удалить «${doc.display_name}»?`)) return;
    const res = await fetch(`${baseUrl}/documents/${doc.id}`, { method:'DELETE', headers });
    if (!res.ok) { toast.error('Ошибка удаления'); return; }
    toast.success('Удалено');
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const grouped = categories.map(c => ({ category:c, docs:docs.filter(d => d.category_id === c.id) }));
  const withoutCategory = docs.filter(d => !d.category_id);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Документы</h1>
          <p className={styles.sub}>{canManage ? 'Создавайте разделы, загружайте PDF и управляйте доступом.' : 'Просматривайте и скачивайте доступные документы.'}</p>
        </div>
      </div>

      {canManage && (
        <div className={styles.uploadCard}>
          <h2 className={styles.uploadTitle}>Разделы и PDF-документы</h2>
          <div className={styles.uploadRow}>
            <input className={styles.input} placeholder="Новый раздел" value={categoryName} onChange={e => setCategoryName(e.target.value)} />
            <button className={styles.refreshBtn} onClick={() => void createCategory()}>+ Добавить раздел</button>
          </div>
          <div className={styles.uploadFields}>
            <select className={styles.input} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Выберите раздел</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className={styles.input} placeholder="Название файла" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <select className={styles.input} value={accessScope} onChange={e => setAccessScope(e.target.value as 'all'|'specific')}>
              <option value="all">Доступ всем</option>
              <option value="specific">Конкретным сотрудникам</option>
            </select>
            {accessScope === 'specific' && (
              <div className={styles.accessGrid}>
                {employees.map(u => (
                  <label key={u.id} className={styles.accessCheck}>
                    <input type="checkbox" checked={accessUserIds.includes(u.id)} onChange={() => toggleAccessUser(u.id)} />
                    {u.fio}
                  </label>
                ))}
              </div>
            )}
            <label className={styles.fileLabel}>
              <input ref={fileRef} type="file" className={styles.fileInput} accept="application/pdf,.pdf" onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
              <span className={styles.fileLabelText}>{fileName || 'Выбрать PDF'}</span>
            </label>
            <button className={styles.uploadBtn} onClick={() => void handleUpload()} disabled={uploading}>{uploading ? 'Загрузка…' : 'Загрузить PDF'}</button>
          </div>
        </div>
      )}

      <div className={styles.listSection}>
        <div className={styles.listHead}>
          <h2 className={styles.secTitle}>Файлы ({docs.length})</h2>
          <button className={styles.refreshBtn} onClick={() => void fetchAll()} disabled={loading}>{loading ? '…' : '↻ Обновить'}</button>
        </div>
        {loading && <div className={styles.empty}>Загрузка…</div>}
        {!loading && docs.length === 0 && <div className={styles.emptyState}><div className={styles.emptyIcon}>📁</div><p className={styles.emptyText}>Документов пока нет</p></div>}
        {[...grouped, ...(withoutCategory.length ? [{ category:{id:0,name:'Без раздела'}, docs:withoutCategory }] : [])].map(group => (
          group.docs.length > 0 && (
            <div key={group.category.id} className={styles.docSection}>
              <h3 className={styles.categoryTitle}>{group.category.name}</h3>
              <div className={styles.docGrid}>
                {group.docs.map(doc => (
                  <div key={doc.id} className={styles.docCard}>
                    <div className={styles.docIcon}>📄</div>
                    <div className={styles.docInfo}>
                      <div className={styles.docName}>{doc.display_name}</div>
                      <div className={styles.docMeta}>
                        <span>{formatSize(doc.file_size)}</span><span>·</span>
                        <span>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                        {canManage && <><span>·</span><span>{doc.access_scope === 'all' ? 'Всем' : `${doc.access_users?.length || 0} сотрудн.`}</span></>}
                      </div>
                    </div>
                    <div className={styles.docActions}>
                      <button className={styles.downloadBtn} onClick={() => void handleDownload(doc)}>Скачать</button>
                      {canManage && <button className={styles.deleteBtn} onClick={() => void handleDelete(doc)}>Удалить</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
