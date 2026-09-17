'use client';

import { useState } from 'react';
import { cx } from '@/components/ui';

/**
 * The review switch for one cluster.
 *
 * Off (the default): a document is filed the moment it is uploaded. On: each
 * upload stops at a review screen first. The copy under the switch says which
 * is in force in plain words, because the difference is the whole product
 * promise and should never have to be inferred from a toggle's colour.
 */
export function ReviewToggle({ cluster, initial }: { cluster: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !on;
    setOn(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clusters/${encodeURIComponent(cluster)}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewBeforeFiling: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save');
      }
    } catch (err) {
      setOn(!next);
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 px-1 text-small">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={saving}
        onClick={flip}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          on ? 'border-accent bg-accent' : 'border-line bg-white/[0.06]',
          saving && 'opacity-60',
        )}
      >
        <span
          className={cx(
            'inline-block h-3.5 w-3.5 rounded-full bg-ink shadow transition-transform',
            on ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
      <div className="min-w-0">
        <span className="font-medium text-ink">Review each document before it is filed</span>
        <p className="text-muted">
          {on
            ? 'On. Every upload stops at a review screen; nothing is filed until someone approves it. Costs a second agent run per document.'
            : 'Off. Documents are filed as they arrive, checked, and committed so any ingest can be undone.'}
        </p>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
}
