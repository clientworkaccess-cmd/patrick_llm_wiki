#!/usr/bin/env node
/**
 * Drives one ingest through the real job pipeline against a throwaway wiki and
 * prints the job's final status and lint findings. Pass a skip list to make the
 * fake agent misbehave and exercise the failure paths:
 *
 *   node scripts/check-lint.mjs             -> done, no findings
 *   node scripts/check-lint.mjs index       -> attention (index-not-updated is an error)
 *   node scripts/check-lint.mjs log         -> done, with a log-not-updated warning
 *
 * Needs the lib compiled to plain JS first; see the PR description for the
 * one-liner. (The app's TS imports are extensionless, which Next resolves and
 * Node does not.)
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'brain-lint-'));
process.env.WIKI_ROOT = root;
const skip = process.argv[2] ?? '';
process.env.HERMES_CMD = 'node';
process.env.HERMES_ARGS = skip ? `scripts/fake-hermes.mjs --skip ${skip}` : 'scripts/fake-hermes.mjs';

const { createCluster } = await import('../src/lib/clusters.ts');
const { startIngest, getJob, subscribe } = await import('../src/lib/jobs.ts');

await createCluster({ name: 'ops', scope: 'Returns and refunds', entities: '', questions: '' });
await fs.mkdir(path.join(root, 'ops', 'raw'), { recursive: true });
await fs.writeFile(path.join(root, 'ops', 'raw', 'note.md'), '---\nsource_url: x\ningested: 2026-09-16\nsha256: 0\n---\nA note about the warehouse team and the returns portal.\n');

const job = await startIngest({ cluster: 'ops', filename: 'note.md', rawPath: 'raw/note.md' });
await new Promise((resolve) => subscribe(job.id, (j) => j.status !== 'running' && resolve()));
const final = await getJob(job.id);
console.log(JSON.stringify({ skip, status: final.status, diff: final.diff, findings: final.lint?.findings.map((f) => `${f.severity}:${f.code}`) }, null, 1));
await fs.rm(root, { recursive: true, force: true });
