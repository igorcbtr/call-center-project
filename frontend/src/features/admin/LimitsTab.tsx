import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { usePutShiftLimitsMutation, useShiftLimitsQuery } from '../../api/api';
import type { ShiftLimit, UserRole } from '../../api/types';
import { Button } from '../../components/common/Button';
import styles from './LimitsTab.module.css';

const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  operator: 'Оператор',
  stajer: 'Стажёр',
  uchenik: 'Ученик',
};

export function LimitsTab() {
  const { data = [], isLoading } = useShiftLimitsQuery();
  const [putLimits, { isLoading: saving }] = usePutShiftLimitsMutation();
  const [draft, setDraft] = useState<ShiftLimit[]>([]);

  useEffect(() => {
    setDraft(data);
  }, [data]);

  const update = (role: UserRole, value: number) => {
    setDraft((prev) => {
      const next = [...prev];
      const i = next.findIndex((r) => r.role === role);
      if (i >= 0) next[i] = { ...next[i], max_shifts_per_week: value };
      return next;
    });
  };

  const save = async () => {
    try {
      await putLimits({ limits: draft }).unwrap();
      toast.success('Лимиты сохранены');
    } catch {
      toast.error('Ошибка при сохранении');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Лимиты смен</h1>
          <p className={styles.sub}>Максимальное количество смен в неделю по роли (MVP).</p>
        </div>
        <Button onClick={() => void save()} loading={saving} disabled={isLoading}>
          Сохранить
        </Button>
      </div>

      <div className={styles.grid}>
        {draft.map((row) => (
          <div key={row.role} className={styles.card}>
            <p className={styles.role}>{roleLabels[row.role]}</p>
            <label className={styles.lbl} htmlFor={`lim-${row.role}`}>
              Макс / неделю
            </label>
            <input
              id={`lim-${row.role}`}
              className={styles.input}
              type="number"
              min={0}
              max={99}
              value={row.max_shifts_per_week}
              onChange={(e) => update(row.role, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}