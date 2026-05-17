import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[`size_${size}`], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      <span className={styles.inner}>
        {loading ? <span className={styles.spinner} aria-hidden /> : null}
        <span className={loading ? styles.dim : undefined}>{children}</span>
      </span>
    </button>
  );
}
