import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, id, error, className = '', ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className={[styles.input, error ? styles.inputError : '', className].join(' ')} {...rest} />
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
