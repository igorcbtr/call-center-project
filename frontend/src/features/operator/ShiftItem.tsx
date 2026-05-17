import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ShiftEntry } from '../../api/types';
import { Button } from '../../components/common/Button';
import { useRespondShiftMutation } from '../../api/api';
import { toast } from 'react-toastify';
import styles from './ShiftItem.module.css';

interface Props {
  entry: ShiftEntry;
  onChanged: () => void;
}

export function ShiftItem({ entry, onChanged }: Props) {
  const [respond, { isLoading }] = useRespondShiftMutation();

  const dateLabel = format(new Date(`${entry.date}T12:00:00`), 'EEEE d MMM', { locale: ru });
  const pending = entry.status === 'pending';

  const onRespond = async (action: 'confirm' | 'decline') => {
    try {
      await respond({ id: entry.id, body: { action } }).unwrap();

      toast.success(action === 'confirm' ? 'Смена подтверждена' : 'Смена отклонена');

      onChanged();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка')
          : 'Ошибка';

      toast.error(msg);
    }
  };

  return (
    <article className={styles.card}>
      <div className={styles.left}>
        <p className={styles.date}>{dateLabel}</p>

        <p className={styles.title}>{entry.shift_name ?? 'Смена'}</p>

        <p className={styles.time}>
          {entry.start_time} – {entry.end_time}
        </p>
      </div>

      <div className={styles.right}>
        <span
          className={
            entry.status === 'confirmed'
              ? styles.badgeOk
              : entry.status === 'declined'
                ? styles.badgeOff
                : styles.badgeWait
          }
        >
          {entry.status === 'confirmed'
            ? 'Подтверждено'
            : entry.status === 'declined'
              ? 'Отклонено'
              : 'В ожидании'}
        </span>

        {pending ? (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => void onRespond('decline')}
              loading={isLoading}
            >
              Отказ
            </Button>

            <Button
              type="button"
              onClick={() => void onRespond('confirm')}
              loading={isLoading}
            >
              Подтвердить
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}