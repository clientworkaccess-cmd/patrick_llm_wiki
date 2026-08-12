import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The primitive set, straight off Desing.md §Components. Everything else in the
 * app composes these — no one-off button styling further down the tree.
 */

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded font-semibold text-small transition-all duration-200 ' +
  'disabled:opacity-40 disabled:pointer-events-none active:translate-y-px';

const VARIANTS = {
  // Accent fill, hover darkens 8% and lifts. No outer glow — the spec is explicit.
  primary: 'bg-accent text-ink px-4 py-2.5 hover:bg-[#2f6fdb] hover:shadow-lift',
  // 1.5px outline in a muted tone, subtle fill on hover.
  ghost: 'border-[1.5px] border-line text-ink px-4 py-2.5 hover:bg-white/5',
  quiet: 'text-muted px-3 py-2 hover:text-ink hover:bg-white/5',
  danger: 'border-[1.5px] border-danger/40 text-danger px-4 py-2.5 hover:bg-danger/10',
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={cx(BUTTON_BASE, VARIANTS[variant], className)} {...rest} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(BUTTON_BASE, VARIANTS[variant], className)} {...rest} />;
}

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cx('rounded border border-line bg-elevated shadow-card', className)}
      {...rest}
    />
  );
}

/** Label above the input. No floating labels — the spec rules them out. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-small font-medium text-ink tracking-wide">{label}</span>
      {hint && <span className="mt-1 block text-small text-muted/80">{hint}</span>}
      <div className="mt-2">{children}</div>
      {error && <span className="mt-1.5 block text-small text-danger">{error}</span>}
    </label>
  );
}

const INPUT =
  'w-full rounded border border-line bg-white/[0.03] px-3.5 py-2.5 text-body text-ink ' +
  'placeholder:text-muted/50 transition-colors focus:border-accent/60';

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx(INPUT, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx(INPUT, 'resize-y min-h-[7rem]', className)} {...rest} />;
}

/** Shimmer, sized to the thing it stands in for. Desing.md forbids spinners. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('shimmer rounded', className)} aria-hidden />;
}

/** Icon composition + descriptive text + an action. Never a bare "no data". */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-line px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
      </span>
      <h2 className="text-h2 text-ink">{title}</h2>
      <p className="mt-2 max-w-prose text-body text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'accent' }) {
  const tones = {
    neutral: 'border-line text-muted',
    success: 'border-success/40 text-success',
    danger: 'border-danger/40 text-danger',
    accent: 'border-accent/40 text-accent',
  } as const;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.75rem] tracking-wide',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export { cx };
