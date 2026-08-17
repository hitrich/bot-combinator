import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Visibility } from '../lib/types';
import { visibilityLabels } from '../lib/visibility';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function Button({
  children,
  className,
  tone = 'secondary',
  size = 'medium',
  icon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'small' | 'medium';
  icon?: ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cx('button', `button--${tone}`, `button--${size}`, className)}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: PropsWithChildren<{
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'lime';
  dot?: boolean;
}>): React.JSX.Element {
  return (
    <span className={cx('badge', `badge--${tone}`)}>
      {dot ? <i aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }): React.JSX.Element {
  const tone =
    visibility === 'public'
      ? 'success'
      : visibility === 'bot_chain'
        ? 'info'
        : visibility === 'project_private'
          ? 'neutral'
          : 'lime';
  return <Badge tone={tone}>{visibilityLabels[visibility]}</Badge>;
}

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const tone =
    status === 'ready' || status === 'completed' || status === 'approved' || status === 'accepted'
      ? 'success'
      : status === 'blocked' || status === 'changes_requested' || status === 'declined'
        ? 'danger'
        : status === 'interview'
          ? 'info'
          : status === 'in_progress' ||
              status === 'in_review' ||
              status === 'requested' ||
              status === 'submitted'
            ? 'warning'
            : 'neutral';
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function ProgressBar({
  value,
  label,
  compact = false,
}: {
  value: number;
  label?: string;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className={cx('progress', compact && 'progress--compact')}>
      {label ? (
        <div className="progress__label">
          <span>{label}</span>
          <strong>{value}%</strong>
        </div>
      ) : null}
      <div
        className="progress__track"
        aria-label={`${value}% complete`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}>): React.JSX.Element | null {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={cx('dialog', wide && 'dialog--wide')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <span aria-hidden="true">/</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  span = false,
}: PropsWithChildren<{ label: string; hint?: string; span?: boolean }>): React.JSX.Element {
  return (
    <label className={cx('field', span && 'field--span')}>
      <span className="field__label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}): React.JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return <span className={cx('avatar', small && 'avatar--small')}>{initials || 'BC'}</span>;
}

export function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Not set';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function relativeDate(value: string | null): string {
  if (!value) return 'No update';
  const days = Math.floor((Date.now() - new Date(value).valueOf()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
