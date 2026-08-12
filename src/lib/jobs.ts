import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError, JOBS_DIR, INGEST_TIMEOUT_MS, clusterPath } from './config';
import { ensureDashboardDirs } from './clusters';
import { runHermes } from './hermes';
import { diffAgainst, snapshot, type IngestDiff } from './wiki';

/**
 * Ingest job state.
 *
 * There is no queue and no worker pool — uploads are one at a time by design,
 * so there is no backlog to order. What survives from that idea is the pair of
 * things that were actually load-bearing:
 *
 *  1. A per-cluster busy check, so two writers can't both rewrite index.md and
 *     have one silently lose. One shared password means concurrent humans the
 *     UI cannot prevent.
 *  2. A disk-backed job record, so an ingest outlives the HTTP request that
 *     started it. A page refresh, a navigation, or a proxy timeout must not
 *     kill a write that is minutes long.
 *
 * Reject-vs-hold for upload #2 is deliberately still 409-reject. Upgrading to
 * hold is an array and a drain call; the decision waits on measured ingest
 * wall-clock from the spike.
 */

export type JobStatus = 'running' | 'done' | 'failed' | 'interrupted';

export interface Job {
  id: string;
  cluster: string;
  filename: string;
  status: JobStatus;
  startedAt: string;
  endedAt: string | null;
  lines: string[];
  diff: IngestDiff | null;
  error: string | null;
}

/** cluster → the job currently writing to it. The busy lock. */
const busy = new Map<string, string>();

/** Live subscribers, for SSE. Disk is the durable copy; this is the fast path. */
const listeners = new Map<string, Set<(job: Job) => void>>();

const cache = new Map<string, Job>();

export function isBusy(cluster: string): string | null {
  return busy.get(cluster) ?? null;
}

/**
 * A restart kills the spawned Hermes with it, so any job still marked running
 * on boot is dead. Mark it so the UI can say "interrupted — re-upload" instead
 * of streaming a progress bar that will never move.
 */
export async function reconcileOnBoot(): Promise<void> {
  await ensureDashboardDirs();
  let files: string[] = [];
  try {
    files = await fs.readdir(JOBS_DIR);
  } catch {
    return;
  }
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    const job = await readJobFile(path.join(JOBS_DIR, file));
    if (job?.status === 'running') {
      job.status = 'interrupted';
      job.endedAt = new Date().toISOString();
      job.error = 'The server restarted while this ingest was running. Re-upload the file.';
      await persist(job);
    }
  }
}

export async function getJob(id: string): Promise<Job | null> {
  if (cache.has(id)) return cache.get(id)!;
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new HttpError(400, 'Malformed job id');
  return readJobFile(path.join(JOBS_DIR, `${id}.json`));
}

export function subscribe(id: string, fn: (job: Job) => void): () => void {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(fn);
  return () => listeners.get(id)?.delete(fn);
}

/**
 * Start an ingest. Returns immediately with the job id — the work continues
 * after this promise resolves, and the client subscribes to it over SSE.
 */
export async function startIngest(opts: {
  cluster: string;
  filename: string;
  stagedPath: string;
}): Promise<Job> {
  const held = busy.get(opts.cluster);
  if (held) {
    throw new HttpError(
      409,
      `This cluster is already processing a file. Wait for it to finish, then upload again.`,
    );
  }

  const job: Job = {
    id: randomUUID(),
    cluster: opts.cluster,
    filename: opts.filename,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lines: [],
    diff: null,
    error: null,
  };

  busy.set(opts.cluster, job.id);
  cache.set(job.id, job);
  await persist(job);

  // Deliberately not awaited. The HTTP response goes out now.
  void ingest(job, opts.stagedPath);

  return job;
}

async function ingest(job: Job, stagedPath: string): Promise<void> {
  const before = await snapshot(job.cluster);

  const prompt = [
    `A new source document has been placed at: ${stagedPath}`,
    ``,
    `Read SCHEMA.md first — it defines this cluster's scope, naming rules, and the parsing`,
    `tools available to you. Convert the document with markitdown, falling back to OCR only`,
    `if it has no text layer.`,
    ``,
    `Then file it into the wiki: move the source into raw/, create or update the entity and`,
    `concept pages it warrants, link them with [[wikilinks]], update index.md, and append an`,
    `entry to log.md describing what changed.`,
    ``,
    `Prefer updating an existing page over creating a near-duplicate.`,
  ].join('\n');

  const run = runHermes({
    prompt,
    clusterPath: clusterPath(job.cluster),
    usageFile: path.join(JOBS_DIR, `${job.id}.usage.json`),
    timeoutMs: INGEST_TIMEOUT_MS,
  });

  try {
    for await (const line of run.lines) {
      if (!line.trim()) continue;
      job.lines.push(line);
      emit(job);
    }
    const code = await run.done;
    if (code !== 0) throw new Error(`Hermes exited with code ${code}`);

    job.diff = await diffAgainst(job.cluster, before);
    job.status = 'done';
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  } finally {
    job.endedAt = new Date().toISOString();
    busy.delete(job.cluster);
    await persist(job);
    emit(job);
  }
}

function emit(job: Job): void {
  for (const fn of listeners.get(job.id) ?? []) fn(job);
}

async function persist(job: Job): Promise<void> {
  cache.set(job.id, job);
  await ensureDashboardDirs();
  await fs.writeFile(path.join(JOBS_DIR, `${job.id}.json`), JSON.stringify(job, null, 2), 'utf8');
}

async function readJobFile(file: string): Promise<Job | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as Job;
  } catch {
    return null;
  }
}
