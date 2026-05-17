import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useShiftStatsQuery } from '../../api/api';
import styles from './StatsTab.module.css';

export function StatsTab() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data = [], isLoading } = useShiftStatsQuery({ year, month });

  const chartData = useMemo(
    () =>
      data.map((r) => ({
        name: r.fio.length > 18 ? `${r.fio.slice(0, 16)}…` : r.fio,
        full: r.fio,
        shifts: r.shift_count,
      })),
    [data]
  );

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Статистика</h1>
          <p className={styles.sub}>Количество смен у сотрудников за выбранный месяц.</p>
        </div>

        <div className={styles.filters}>
          <label className={styles.f}>
            Год
            <select
              className={styles.sel}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.f}>
            Месяц
            <select
              className={styles.sel}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.card}>
        {isLoading ? <p className={styles.muted}>Загрузка…</p> : null}

        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  const row = payload[0].payload as {
                    full: string;
                    shifts: number;
                  };

                  return (
                    <div className={styles.tt}>
                      <div className={styles.ttTitle}>{row.full}</div>
                      <div className={styles.ttVal}>{row.shifts} смен</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="shifts" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}