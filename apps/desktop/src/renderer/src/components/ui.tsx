import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react';
import { AlertCircle, Check, LoaderCircle, Search, X } from 'lucide-react';

type ButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: 'small' | 'medium';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = 'secondary', size = 'medium', loading = false, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`button button--${tone} button--${size}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
});

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: PropsWithChildren<{
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}>): React.JSX.Element {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StateDot({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  label: string;
}): React.JSX.Element {
  return (
    <span className="state-dot-label">
      <span className={`state-dot state-dot--${tone}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}): React.JSX.Element {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <div className="page-header__title-row">
          <h1>{title}</h1>
          {meta}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = '',
}: PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>): React.JSX.Element {
  return (
    <section className={`section ${className}`}>
      {title || action ? (
        <div className="section__heading">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function TextField({
  label,
  hint,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}): React.JSX.Element {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={error ? 'input input--error' : 'input'}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId}>
          <AlertCircle aria-hidden="true" /> {error}
        </span>
      ) : null}
    </div>
  );
}

export function SearchField({
  label = 'Search',
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  const inputId = useId();
  return (
    <div className="search-field">
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
      />
      {value ? (
        <IconButton label="Clear search" onClick={() => onChange('')}>
          <X aria-hidden="true" />
        </IconButton>
      ) : null}
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
      <div className="empty-state__mark" aria-hidden="true">
        <Check />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }): React.JSX.Element {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingScreen(): React.JSX.Element {
  return (
    <main className="loading-screen" aria-label="Loading Bot Combinator" aria-busy="true">
      <div className="brand-mark brand-mark--large" aria-hidden="true">
        O
      </div>
      <div>
        <h1>Opening your local vault</h1>
        <p role="status">Verifying the seed and rebuilding today’s work queue.</p>
      </div>
      <div className="loading-lines" aria-hidden="true">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </main>
  );
}

export function ErrorScreen({
  message,
  retry,
  retrying = false,
}: {
  message: string;
  retry: () => void;
  retrying?: boolean;
}): React.JSX.Element {
  return (
    <main className="error-screen">
      <AlertCircle aria-hidden="true" />
      <h1>Bot Combinator could not open the vault</h1>
      <p>{message}</p>
      <Button tone="primary" loading={retrying} onClick={retry}>
        Try again
      </Button>
    </main>
  );
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  footer,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
}>): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const lastOutsideFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const rememberOutsideFocus = (event: FocusEvent): void => {
      if (event.target instanceof HTMLElement && !event.target.closest('dialog')) {
        lastOutsideFocusRef.current = event.target;
      }
    };
    if (
      document.activeElement instanceof HTMLElement &&
      !dialogRef.current?.contains(document.activeElement)
    ) {
      lastOutsideFocusRef.current = document.activeElement;
    }
    document.addEventListener('focusin', rememberOutsideFocus);
    return () => document.removeEventListener('focusin', rememberOutsideFocus);
  }, []);

  useEffect(() => {
    const node = dialogRef.current;
    if (open) {
      previouslyFocusedRef.current = lastOutsideFocusRef.current;
      wasOpenRef.current = true;
      if (node && !node.open) node.showModal();
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const previouslyFocused = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
  }, [open]);

  useEffect(
    () => () => {
      if (!wasOpenRef.current) return;
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    },
    [],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="dialog__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <div className="dialog__body">{children}</div>
      {footer ? <div className="dialog__footer">{footer}</div> : null}
    </dialog>
  );
}

export function ToastRegion({
  toasts,
  dismiss,
}: {
  toasts: Array<{ id: number; tone: 'success' | 'error' | 'info'; title: string; detail?: string }>;
  dismiss: (id: number) => void;
}): React.JSX.Element {
  return (
    <div className="toast-region" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          className={`toast toast--${toast.tone}`}
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <div>
            <strong>{toast.title}</strong>
            {toast.detail ? <p>{toast.detail}</p> : null}
          </div>
          <IconButton label="Dismiss notification" onClick={() => dismiss(toast.id)}>
            <X aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

export function Stack({
  gap = 'medium',
  className = '',
  children,
  ...props
}: PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & { gap?: 'small' | 'medium' | 'large' }
>): React.JSX.Element {
  return (
    <div className={`stack stack--${gap} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function formatMoney(value: number | null, compact = false): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: includeTime ? 'numeric' : undefined,
    minute: includeTime ? '2-digit' : undefined,
  }).format(date);
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
