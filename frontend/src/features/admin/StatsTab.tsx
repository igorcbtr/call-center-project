import { useMemo, useState } from 'react';
import { useShiftStatsQuery, useShiftLimitsDataQuery } from '../../api/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './StatsTab.module.css';

const roleLabels: Record<string,string> = {
  admin:'Администратор', moderator:'Модератор', operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик',
};

export function StatsTab() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);

  const { data = [], isLoading } = useShiftStatsQuery({ year, month });
  const { data: limData } = useShiftLimitsDataQuery();

  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  // Find users below minimum
  const belowMin = useMemo(() => {
    if (!limData) return [];
    return data.filter(u => {
      const ex  = limData.exceptions.find(e => e.user_id === u.id);
      const lim = limData.limits.find(l => l.role === u.role);
      const min = ex ? ex.min_shifts_per_week : lim?.min_shifts_per_week ?? 0;
      // approximate: monthly min ≈ weekly min * 4
      return min > 0 && u.shift_count < min * 4;
    });
  }, [data, limData]);

  const total = data.reduce((s, u) => s + u.shift_count, 0);
  const chartData = data.filter(u => u.shift_count > 0).slice(0, 20);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div><h1 className={styles.title}>Статистика</h1><p className={styles.sub}>Смены по сотрудникам за выбранный месяц</p></div>
        <div className={styles.controls}>
          <select className={styles.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" className={styles.yearInput} value={year} min={2020} max={2030} onChange={e => setYear(Number(e.target.value))} />
        </div>
      </div>

      {belowMin.length > 0 && (
        <div className={styles.warnBox}>
          <div className={styles.warnTitle}>⚠️ Сотрудники ниже минимума смен ({belowMin.length})</div>
          <div className={styles.warnList}>
            {belowMin.map(u => (
              <div key={u.id} className={styles.warnRow}>
                <span className={styles.warnFio}>{u.fio}</span>
                <span className={styles.warnRole}>{roleLabels[u.role]||u.role}</span>
                <span className={styles.warnCount}>Смен: {u.shift_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.summaryCards}>
        <div className={styles.card}><span className={styles.cardNum}>{data.length}</span><span className={styles.cardLabel}>Сотрудников</span></div>
        <div className={styles.card}><span className={styles.cardNum}>{total}</span><span className={styles.cardLabel}>Всего смен</span></div>
        <div className={styles.card}><span className={styles.cardNum}>{data.length ? (total/data.length).toFixed(1) : 0}</span><span className={styles.cardLabel}>Среднее на чел.</span></div>
      </div>

      {isLoading ? <div className={styles.loading}>Загрузка…</div> : (
        <>
          {chartData.length > 0 && (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{top:10,right:10,left:0,bottom:60}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="fio" tick={{fontSize:11}} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{fontSize:12}} />
                  <Tooltip formatter={(v) => [`${Number(v ?? 0)} смен`, 'Смены']} />
                  <Bar dataKey="shift_count" fill="#6366f1" radius={[4,4,0,0]} name="Смены" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>Сотрудник</th><th>Роль</th><th>Смен</th><th>Статус</th></tr></thead>
              <tbody>
                {data.length===0 && <tr><td colSpan={5} className={styles.empty}>Нет данных</td></tr>}
                {[...data].sort((a,b) => b.shift_count-a.shift_count).map((u,i) => {
                  const ex  = limData?.exceptions.find(e => e.user_id===u.id);
                  const lim = limData?.limits.find(l => l.role===u.role);
                  const min = ex ? ex.min_shifts_per_week : lim?.min_shifts_per_week ?? 0;
                  const max = ex ? ex.max_shifts_per_week : lim?.max_shifts_per_week ?? 99;
                  const isLow  = min > 0 && u.shift_count < min * 4;
                  const isHigh = u.shift_count > max * 4;
                  return (
                    <tr key={u.id} className={isLow?styles.rowLow:isHigh?styles.rowHigh:''}>
                      <td className={styles.num}>{i+1}</td>
                      <td className={styles.fio}>{u.fio}</td>
                      <td><span className={styles.rolePill}>{roleLabels[u.role]||u.role}</span></td>
                      <td><span className={styles.count}>{u.shift_count}</span></td>
                      <td>
                        {isLow  && <span className={styles.badgeLow}>Мало смен</span>}
                        {isHigh && <span className={styles.badgeHigh}>Много смен</span>}
                        {!isLow && !isHigh && <span className={styles.badgeOk}>В норме</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
