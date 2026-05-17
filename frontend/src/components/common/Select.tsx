import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export function Select({
  label,
  id,
  options,
  error,
  placeholder,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name;

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>

      <select
        id={selectId}
        className={[styles.select, error ? styles.selectError : '', className].join(' ')}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}