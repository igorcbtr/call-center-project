import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useCreateFreeTimeMutation } from '../../api/api';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import styles from './FreeTimeForm.module.css';

const schema = z.object({
  date: z.string().min(1, 'Выберите дату'),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  kind: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

const kinds = [
  { value: 'personal', label: 'Личное' },
  { value: 'medical', label: 'Медицинское' },
  { value: 'training', label: 'Обучение' },
];

interface Props {
  userId: number;
  onCreated: () => void;
}

export function FreeTimeForm({ userId, onCreated }: Props) {
  const [createFt, { isLoading }] = useCreateFreeTimeMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', start_time: '09:00', end_time: '12:00', kind: 'personal' },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      await createFt({
        user_id: userId,
        date: v.date,
        start_time: v.start_time,
        end_time: v.end_time,
        kind: v.kind,
      }).unwrap();

      toast.success('Доступность сохранена');

      form.reset({ ...form.getValues(), date: '' });

      onCreated();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка')
          : 'Ошибка';

      toast.error(msg);
    }
  };

  return (
    <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)}>
      <h3 className={styles.h}>Свободное время / недоступность</h3>

      <div className={styles.row}>
        <Input
          type="date"
          label="Дата"
          {...form.register('date')}
          error={form.formState.errors.date?.message}
        />

        <Input
          type="time"
          label="С"
          {...form.register('start_time')}
          error={form.formState.errors.start_time?.message}
        />

        <Input
          type="time"
          label="До"
          {...form.register('end_time')}
          error={form.formState.errors.end_time?.message}
        />

        <Select
          label="Тип"
          options={kinds}
          {...form.register('kind')}
          error={form.formState.errors.kind?.message}
        />
      </div>

      <Button type="submit" loading={isLoading}>
        Добавить
      </Button>
    </form>
  );
}