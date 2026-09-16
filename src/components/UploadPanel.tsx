'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileUp,
  TriangleAlert,
  RotateCcw,
  Sparkles,
  ClipboardPaste,
  FileText,
} from 'lucide-react';
import { Button, Card, Skeleton, Badge } from '@/components/ui';
import { Reveal } from '@/components/Reveal';
import { parseDocx, parsePdf, parseTxt } from '@/lib/parser';

interface Finding {
  code: string;
  severity: 'error' | 'warning';
  detail: string;
}

interface Job {
  id: string;
  status: 'running' | 'done' | 'attention' | 'failed' | 'interrupted';
  filename: string;
  startedAt?: string;
  lines: string[];
  diff: { newPages: number; updatedPages: number; newConnections: number } | null;
  lint: { ok: boolean; findings: Finding[] } | null;
  error: string | null;
}

type TabMode = 'file' | 'paste';

/**
 * Upload & Paste Panel.
 * Performs client-side pre-parsing (.docx -> mammoth+turndown, .pdf -> pdfjs with OCR guard, .txt/paste -> native text)
 * and submits formatted Markdown directly to /api/upload for saving into raw/.
 */
export function UploadPanel({ cluster }: { cluster: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [parsingMsg, setParsingMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<TabMode>('file');

  // Pasted text state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

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
          router.refresh();
        }
      });

      source.onerror = () => source.close();
      return () => source.close();
    },
    [router, storageKey],
  );

  useEffect(() => {
    const pending = localStorage.getItem(storageKey);
    if (pending) return attach(pending);
  }, [attach, storageKey]);

  async function handleFileSubmit(file: File) {
    setError(null);
    setParsingMsg('Extracting document text...');
    setSending(true);

    try {
      let extractedText = '';
      const nameLower = file.name.toLowerCase();

      if (nameLower.endsWith('.docx')) {
        extractedText = await parseDocx(file);
      } else if (nameLower.endsWith('.pdf')) {
        const res = await parsePdf(file);
        extractedText = res.text;
      } else {
        extractedText = await parseTxt(file);
      }

      if (!extractedText.trim()) {
        throw new Error('No text could be extracted from this document.');
      }

      setParsingMsg('Sending file to server...');

      const body = new FormData();
      body.append('cluster', cluster);
      body.append('parsedText', extractedText);
      body.append('filename', file.name);
      body.append('file', file); // Save original binary in .dashboard/originals/

      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      localStorage.setItem(storageKey, data.jobId);
      setJob({
        id: data.jobId,
        status: 'running',
        filename: file.name,
        lines: [],
        diff: null,
        lint: null,
        error: null,
      });
      attach(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File parsing/upload failed');
    } finally {
      setSending(false);
      setParsingMsg(null);
    }
  }

  async function handlePasteSubmit() {
    if (!pasteContent.trim()) {
      setError('Please paste or type text before submitting.');
      return;
    }

    setError(null);
    setSending(true);

    try {
      const filename = pasteTitle.trim()
        ? `${pasteTitle.trim().replace(/[^\w.\- ]+/g, '_')}.md`
        : `pasted_note_${new Date().toISOString().slice(0, 10)}.md`;

      const body = new FormData();
      body.append('cluster', cluster);
      body.append('parsedText', pasteContent.trim());
      body.append('filename', filename);

      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');

      localStorage.setItem(storageKey, data.jobId);
      setJob({
        id: data.jobId,
        status: 'running',
        filename,
        lines: [],
        diff: null,
        lint: null,
        error: null,
      });
      attach(data.jobId);
      setPasteTitle('');
      setPasteContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSending(false);
    }
  }

  const running = job?.status === 'running' || sending;

  if (job && (job.status === 'done' || job.status === 'attention') && job.diff) {
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
              Nothing was half-written — the wiki is under version control.
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
          <span className="text-ink font-medium">
            {parsingMsg ?? `Reading ${job?.filename ?? 'your content'}`}
          </span>
          {job?.startedAt && <Elapsed since={job.startedAt} />}
        </div>
        <p className="mt-1.5 text-small">
          The agent reads the whole document, then writes and links the pages in one pass. It reports
          when it is finished, not as it goes. You can leave this page; it keeps running.
        </p>

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
    <Card className="p-5">
      {/* Header controls & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.02] p-1">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'file' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
            }`}
            onClick={() => {
              setTab('file');
              setError(null);
            }}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload File
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'paste' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
            }`}
            onClick={() => {
              setTab('paste');
              setError(null);
            }}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste Text
          </button>
        </div>

        <span className="text-xs text-muted">Files land directly in <code className="text-accent font-mono">raw/</code></span>
      </div>

      {tab === 'file' ? (
        <div
          className={`mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-accent bg-accent/5' : 'border-line'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFileSubmit(file);
          }}
        >
          <div className="flex flex-col items-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
              <FileText className="h-5 w-5 text-accent" strokeWidth={1.75} />
            </span>
            <h3 className="text-ink font-semibold">Upload Document</h3>
            <p className="mt-1 max-w-prose text-small text-muted">
              Drop a Word (.docx), PDF (.pdf), or Plain Text (.txt, .md) file here.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSubmit(file);
                e.target.value = '';
              }}
            />
            <Button className="mt-4" onClick={() => inputRef.current?.click()}>
              <FileUp className="h-4 w-4" strokeWidth={2} />
              Choose File
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Document Title / Reference (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Q3 Strategic Plan Notes"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              className="w-full rounded border border-line bg-background px-3 py-2 text-small text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Content / Text:</label>
            <textarea
              rows={6}
              placeholder="Paste raw text or Markdown here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full rounded border border-line bg-background p-3 text-small text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <Button onClick={handlePasteSubmit} disabled={!pasteContent.trim()}>
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            Ingest Text
          </Button>
        </div>
      )}

      {error && <p className="mt-3.5 text-small text-danger">{error}</p>}
    </Card>
  );
}

/** "working, N min" — the honest running state for an agent that answers in one block. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const label = s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${s % 60}s`;
  return (
    <span className="ml-auto font-mono text-[0.75rem] tabular-nums text-muted/70" aria-live="off">
      {label}
    </span>
  );
}

function IngestDiff({ job, onDismiss }: { job: Job; onDismiss: () => void }) {
  const diff = job.diff!;
  const findings = job.lint?.findings ?? [];
  const attention = job.status === 'attention';
  const stats = [
    { value: diff.newPages, label: diff.newPages === 1 ? 'new page' : 'new pages' },
    { value: diff.updatedPages, label: diff.updatedPages === 1 ? 'page updated' : 'pages updated' },
    { value: diff.newConnections, label: diff.newConnections === 1 ? 'new connection' : 'new connections' },
  ];

  return (
    <Reveal>
      <Card className="border-accent/30 p-6">
        <Badge tone={attention ? 'danger' : 'success'}>{attention ? 'Needs attention' : 'Filed'}</Badge>
        <h3 className="mt-3.5 text-h2 text-ink">
          {attention ? (
            <>{job.filename} was read, but the record is <span className="font-serif italic text-danger">not in order</span></>
          ) : (
            <>{job.filename} is now <span className="font-serif italic text-accent">part of the wiki</span></>
          )}
        </h3>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded border border-line bg-white/[0.02] px-4 py-4 text-center">
              <div className="font-mono text-h1 text-ink tabular-nums">{stat.value}</div>
              <div className="mt-1 text-small text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        {findings.length > 0 ? (
          <ul className="mt-5 space-y-2" aria-label="Checks on what was written">
            {findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-small">
                <TriangleAlert
                  className={`mt-0.5 h-4 w-4 shrink-0 ${f.severity === 'error' ? 'text-danger' : 'text-muted/70'}`}
                  strokeWidth={1.75}
                />
                <span className={f.severity === 'error' ? 'text-ink' : 'text-muted'}>{f.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 max-w-prose text-small">
            Checked against the disk: the index and the log were updated, every new page is linked,
            and every link points at a page that exists.
          </p>
        )}

        <Button variant="ghost" className="mt-5" onClick={onDismiss}>
          {attention ? 'Add another anyway' : 'Add another'}
        </Button>
      </Card>
    </Reveal>
  );
}
