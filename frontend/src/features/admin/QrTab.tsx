import { useState } from 'react';
import { toast } from 'react-toastify';
import { useQrPlacesQuery, useCreateQrMutation, useDeleteQrMutation } from '../../api/api';
import type { QrPlace } from '../../api/types';
import { Button } from '../../components/common/Button';
import styles from './QrTab.module.css';

export function QrTab() {
  const { data: places = [], refetch } = useQrPlacesQuery();
  const [createQr, { isLoading }] = useCreateQrMutation();
  const [deleteQr] = useDeleteQrMutation();
  const [placeName, setPlaceName] = useState('');
  const [lastQr, setLastQr] = useState<QrPlace | null>(null);

  const handleCreate = async () => {
    if (!placeName.trim()) { toast.error('Введите название места'); return; }
    try {
      const res = await createQr({ place: placeName.trim() }).unwrap();
      setLastQr(res);
      setPlaceName('');
      toast.success('QR-код создан');
      void refetch();
    } catch { toast.error('Ошибка создания QR'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить QR-код?')) return;
    try { await deleteQr(id).unwrap(); toast.success('Удалено'); void refetch(); }
    catch { toast.error('Ошибка'); }
  };

  const downloadQr = (qr: QrPlace) => {
    if (!qr.qrDataUrl) { toast.error('QR не содержит изображение — пересоздайте'); return; }
    const a = document.createElement('a');
    a.href = qr.qrDataUrl;
    a.download = `qr_${qr.place.replace(/\s+/g,'_')}.png`;
    a.click();
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>QR-коды рабочих мест</h1>
          <p className={styles.sub}>Создавайте QR-коды для отметки присутствия. Распечатайте и разместите на рабочих местах.</p>
        </div>
      </div>

      <div className={styles.createCard}>
        <h2 className={styles.createTitle}>Создать новый QR-код</h2>
        <div className={styles.createRow}>
          <input
            className={styles.input}
            value={placeName}
            onChange={e => setPlaceName(e.target.value)}
            placeholder='Например: "Оператор 1" или "Стол 5"'
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
          />
          <Button onClick={() => void handleCreate()} loading={isLoading}>Создать QR</Button>
        </div>
        <p className={styles.hint}>Этот текст будет записан в БД при каждой отметке сотрудника.</p>
      </div>

      {lastQr && (
        <div className={styles.newQrCard}>
          <div className={styles.newQrLeft}>
            {lastQr.qrDataUrl && <img src={lastQr.qrDataUrl} alt="QR" className={styles.qrImg} />}
          </div>
          <div className={styles.newQrRight}>
            <div className={styles.newQrLabel}>Только что создан</div>
            <div className={styles.newQrPlace}>{lastQr.place}</div>
            <div className={styles.newQrLink}>
              <a href={lastQr.link} target="_blank" rel="noreferrer">{lastQr.link}</a>
            </div>
            <div className={styles.newQrActions}>
              <Button onClick={() => downloadQr(lastQr)}>⬇ Скачать PNG</Button>
              <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(lastQr.link); toast.success('Ссылка скопирована'); }}>
                Копировать ссылку
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.list}>
        <h2 className={styles.secTitle}>Все QR-коды ({places.length})</h2>
        {places.length === 0 && <p className={styles.empty}>Нет QR-кодов. Создайте первый выше.</p>}
        {places.map((p: QrPlace) => (
          <div key={p.id} className={styles.row}>
            <div className={styles.rowIcon}>📍</div>
            <div className={styles.rowBody}>
              <div className={styles.rowPlace}>{p.place}</div>
              <a className={styles.rowLink} href={p.link} target="_blank" rel="noreferrer">{p.link}</a>
              <div className={styles.rowDate}>{new Date(p.created_at).toLocaleString('ru-RU')}</div>
            </div>
            <div className={styles.rowActions}>
              <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(p.link); toast.success('Скопировано'); }}>
                Копировать
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>Удалить</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
