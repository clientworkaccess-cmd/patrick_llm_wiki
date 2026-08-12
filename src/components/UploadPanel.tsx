'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileUp, TriangleAlert, RotateCcw, Sparkles } from 'lucide-react';
import { Button, Card, Skeleton, Badge } from '@/components/ui';
import { Reveal } from '@/components/Reveal';

interface Job {
  id: string;
  status: 'running' | 'done' | 'failed' | 'interrupted';
  filename: string;
  lines: string[];
  diff: { newPages: number; updatedPages: number; newConnections: number } | null;
  error: string | null;
}

/**
 * Upload → job id → SSE.
 *
 * The POST returns as soon as the file is on disk; the ingest keeps running
 * behind it. The job id is kept in localStorage so a refresh mid-ingest
 * reattaches to the same run instead of losing it — which is the whole reason
 * the job record exists.
 */
export function UploadPanel({ cluster }: { cluster: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = `ingest:${cluster}`;

  const attach = useCallback(
    (jobId: string) => {
      const source = new EventSource(`/api/jobs/${jobId}`);

      source.addEventListener('job', (ev) => {
        const next = JSON.parse((ev as MessageEvent).data) as Job;
        setJob(next);
        if (next.status !== 'running') {
          localStorage.removeItem(storageKey);
          source.close();
          // Pull the freshly written pages into the sidebar and index.
          router.refresh();
        }
      });

      source.onerror = () => source.close();
      return () => source.close();
    },
    [router, storageKey],
  );

  // Reattach after a refresh.
  useEffect(() => {
    const pending = localStorage.getItem(storageKey);
    if (pending) return attach(pending);
  }, [attach, storageKey]);

  async function send(file: File) {
    setError(null);
    setSending(true);
    try {
      const body = new FormData();
      body.append('cluster', cluster);
      body.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      localStorage.setItem(storageKey, data.jobId);
      setJob({ id: data.jobId, status: 'running', filename: file.name, lines: [], diff: null, error: null });
      attach(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSending(false);
    }
  }

  const running = job?.status === 'running' || sending;

  if (job && job.status === 'done' && job.diff) {
    return <IngestDiff job={job} onDismiss={() => setJob(null)} />;
  }

  if (job && (job.status === 'failed' || job.status === 'interrupted')) {
    return (
      <Card className="border-danger/30 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" strokeWidth={1.75} />
          <div className="flex-1">
            <h3 className="text-ink font-semibold">
              {job.status === 'interrupted' ? 'Ingest interrupted' : 'Ingest failed'}
            </h3>
            <p className="mt-1.5 text-small">{job.error ?? 'The agent stopped before finishing.'}</p>
            <p className="mt-1.5 text-small text-muted/70">
              Nothing was half-written that you need to clean up — the wiki is under version
              control and this run left no entry in the log.
            </p>
            <Button variant="ghost" className="mt-4" onClick={() => setJob(null)}>
              <RotateCcw className="h-4 w-4" strokeWidth={2} />
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (running) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.75} />
          <span className="text-ink font-medium">Reading {job?.filename ?? 'your file'}</span>
        </div>
        <p className="mt-1.5 text-small">
          This takes a few minutes. You can leave this page — it keeps running.
        </p>

        {/* Shimmer, not a spinner. */}
        <div className="mt-5 space-y-2">
          {job && job.lines.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded border border-line bg-white/[0.02] p-3">
              {job.lines.slice(-40).map((line, i) => (
                <p key={i} className="font-mono text-[0.75rem] leading-relaxed text-muted/80">
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-6 transition-colors ${dragging ? 'border-accent bg-accent/5' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void send(file);
      }}
    >
      <div className="flex flex-col items-center text-center">
        <span className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
          <UploadCloud className="h-5 w-5 text-accent" strokeWidth={1.75} />
        </span>
        <h3 className="text-ink font-semibold">Add a document</h3>
        <p className="mt-1.5 max-w-prose text-small">
          Drop a file here, or choose one. PDF, Word, Excel, PowerPoint, or plain text — you do
          not need to organise it first.
        </p>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void send(file);
            e.target.value = '';
          }}
        />
        <Button className="mt-5" onClick={() => inputRef.current?.click()}>
          <FileUp className="h-4 w-4" strokeWidth={2} />
          Choose a file
        </Button>

        {error && <p className="mt-3.5 text-small text-danger">{error}</p>}
      </div>
    </Card>
  );
}

/**
 * The payoff screen. This is the moment the product sells itself — not the
 * chat, but the fact that a pile of documents visibly became something with a
 * shape.
 *
 * The numbers are computed from what is actually on disk before and after, not
 * from the agent's own summary of what it did.
 */
function IngestDiff({ job, onDismiss }: { job: Job; onDismiss: () => void }) {
  const diff = job.diff!;
  const stats = [
    { value: diff.newPages, label: diff.newPages === 1 ? 'new page' : 'new pages' },
    { value: diff.updatedPages, label: diff.updatedPages === 1 ? 'page updated' : 'pages updated' },
    { value: diff.newConnections, label: diff.newConnections === 1 ? 'new connection' : 'new connections' },
  ];

  return (
    <Reveal>
      <Card className="border-accent/30 p-6">
        <Badge tone="success">Filed</Badge>
        <h3 className="mt-3.5 text-h2 text-ink">
          {job.filename} is now <span className="font-serif italic text-accent">part of the wiki</span>
        </h3>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded border border-line bg-white/[0.02] px-4 py-4 text-center">
              <div className="font-mono text-h1 text-ink tabular-nums">{stat.value}</div>
              <div className="mt-1 text-small text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        <p className="mt-5 max-w-prose text-small">
          Nothing was duplicated — where this document covered ground the wiki already had, the
          existing pages were updated instead.
        </p>

        <Button variant="ghost" className="mt-5" onClick={onDismiss}>
          Add another
        </Button>
      </Card>
    </Reveal>
  );
}
