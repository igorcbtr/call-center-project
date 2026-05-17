import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import {
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useEmployeesQuery,
  useUpdateEmployeeMutation,
} from '../../api/api';
import type { User, UserRole } from '../../api/types';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select, type SelectOption } from '../../components/common/Select';
import styles from './UsersTab.module.css';

const roles: SelectOption[] = [
  { value: 'admin', label: 'Администратор' },
  { value: 'moderator', label: 'Модератор' },
  { value: 'operator', label: 'Оператор' },
  { value: 'stajer', label: 'Стажёр' },
  { value: 'uchenik', label: 'Ученик' },
];

const baseSchema = z.object({
  fio: z.string().min(2, 'Минимум 2 символа'),
  role: z.enum(['admin', 'moderator', 'operator', 'stajer', 'uchenik']),
  username: z.string().optional(),
  password: z.string().optional(),
  status: z.boolean().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

export function UsersTab() {
  const { data = [], isLoading, isFetching } = useEmployeesQuery();
  const [createEmp] = useCreateEmployeeMutation();
  const [updateEmp] = useUpdateEmployeeMutation();
  const [deleteEmp] = useDeleteEmployeeMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const schema = useMemo(() => {
    return baseSchema.superRefine((val, ctx) => {
      if (!editing && val.password && val.password.length > 0 && val.password.length < 6) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Минимум 6 символов' });
      }
    });
  }, [editing]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fio: '', role: 'operator', username: '', password: '', status: true },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ fio: '', role: 'operator', username: '', password: '', status: true });
    setOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    form.reset({
      fio: u.fio,
      role: u.role,
      username: u.username ?? '',
      password: '',
      status: u.status,
    });
    setOpen(true);
  };

  const onSubmit = async (v: FormValues) => {
    try {
      if (editing) {
        await updateEmp({
          id: editing.id,
          body: {
            fio: v.fio,
            role: v.role as UserRole,
            status: v.status ?? true,
            username: v.username || null,
          },
        }).unwrap();
        toast.success('Сотрудник обновлён');
      } else {
        await createEmp({
          fio: v.fio,
          role: v.role as UserRole,
          status: v.status ?? true,
          username: v.username || undefined,
          password: v.password || undefined,
        }).unwrap();
        toast.success('Сотрудник создан');
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка')
          : 'Ошибка';
      toast.error(msg);
    }
  };

  const onDelete = async (u: User) => {
    if (!window.confirm(`Удалить ${u.fio}?`)) return;
    try {
      await deleteEmp(u.id).unwrap();
      toast.success('Удалено');
    } catch {
      toast.error('Не удалось удалить');
    }
  };

  const columns: Column<User>[] = [
    { key: 'fio', header: 'Имя', render: (r) => <span className={styles.strong}>{r.fio}</span> },
    { key: 'user', header: 'Логин', render: (r) => r.username || '—' },
    { key: 'role', header: 'Роль', render: (r) => <span className={styles.pill}>{r.role}</span> },
    {
      key: 'status',
      header: 'Статус',
      render: (r) => (
        <span className={r.status ? styles.ok : styles.off}>
          {r.status ? 'Активен' : 'Неактивен'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '200px',
      render: (r) => (
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => openEdit(r)}>
            Редактировать
          </Button>
          <Button variant="danger" onClick={() => onDelete(r)}>
            Удалить
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Сотрудники</h1>
          <p className={styles.sub}>Управление аккаунтами, ролями и доступом к платформе.</p>
        </div>
        <Button onClick={openCreate}>Новый сотрудник</Button>
      </div>

      <div className={styles.card}>
        {isLoading || isFetching ? <p className={styles.muted}>Загрузка…</p> : null}
        <DataTable columns={columns} rows={data} rowKey={(r) => r.id} />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Редактирование сотрудника' : 'Новый сотрудник'}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="emp-form">
              Сохранить
            </Button>
          </>
        }
      >
        <form id="emp-form" className={styles.form} onSubmit={form.handleSubmit(onSubmit)}>
          <Input label="Полное имя" {...form.register('fio')} error={form.formState.errors.fio?.message} />
          <Input
            label="Логин (опционально)"
            {...form.register('username')}
            error={form.formState.errors.username?.message}
          />
          <Select
            label="Роль"
            options={roles}
            {...form.register('role')}
            error={form.formState.errors.role?.message}
          />
          {!editing ? (
            <Input
              label="Начальный пароль (опционально)"
              type="password"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
          ) : null}
          <label className={styles.check}>
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
            Активный аккаунт
          </label>
        </form>
      </Modal>
    </div>
  );
}