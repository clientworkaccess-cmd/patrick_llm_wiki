import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError, JOBS_DIR, INGEST_TIMEOUT_MS, clusterPath } from './config';
import { ensureDashboardDirs } from './clusters';
import { runHermes } from './hermes';
import { diffAgainst, snapshot, type IngestDiff } from './wiki';
import { beforeIngest, lintAfterIngest, type LintResult } from './lint';

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

export type JobStatus = 'running' | 'done' | 'attention' | 'failed' | 'interrupted';

export interface Job {
  id: string;
  cluster: string;
  filename: string;
  status: JobStatus;
  startedAt: string;
  endedAt: string | null;
  lines: string[];
  diff: IngestDiff | null;
  /** What the post-ingest check found on disk. Null until the agent finishes. */
  lint: LintResult | null;
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
  rawPath: string;
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
    lint: null,
    error: null,
  };

  busy.set(opts.cluster, job.id);
  cache.set(job.id, job);
  await persist(job);

  // Deliberately not awaited. The HTTP response goes out now.
  void ingest(job, opts.rawPath);

  return job;
}

async function ingest(job: Job, rawPath: string): Promise<void> {
  const before = await snapshot(job.cluster);
  const baseline = await beforeIngest(job.cluster, before);

  const prompt = [
    `A new pre-formatted source document has been saved directly to: ${rawPath}`,
    ``,
    `Read SCHEMA.md first — it defines this cluster's scope, entity tracking goals, and naming rules.`,
    ``,
    `Do NOT parse or convert ${rawPath} — it is already clean Markdown with valid SHA256 frontmatter inside raw/.`,
    ``,
    `Perform file ingestion and graph synthesis:`,
    `1. Read ${rawPath} carefully.`,
    `2. Extract key entities (people, tools, systems, vendors) and concepts (ideas, workflows, procedures).`,
    `3. Check existing files in entities/ and concepts/ — prefer updating an existing page over creating a near-duplicate.`,
    `4. Maintain at least two [[wikilinks]] per page to cross-link pages in this cluster.`,
    `5. Update index.md catalog with a one-line summary for every new or modified page.`,
    `6. Append a single entry to log.md in the format: ## [YYYY-MM-DD] ingest | ${job.filename}`,
    ``,
    `Synthesize knowledge cleanly into the wiki structure.`,
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

    // The agent exited cleanly. That says nothing about whether it did the
    // job. Look at the disk before telling the user it is filed.
    job.lint = await lintAfterIngest(job.cluster, baseline);
    job.status = job.lint.ok ? 'done' : 'attention';
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
