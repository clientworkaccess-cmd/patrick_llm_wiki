#!/usr/bin/env node
/**
 * Proves the review switch, through the real lib against a throwaway wiki.
 *
 *   npm run check:auto
 *
 *  1. A new cluster has review off.
 *  2. With review off, an upload files in one run: pages written, source in
 *     raw/, staging emptied, a commit made, no plan ever created.
 *  3. The switch persists, and reads back.
 *  4. With review on, the same upload stops at awaiting_approval and writes
 *     nothing into the cluster.
 *  5. Off again, a second upload files automatically and updates an existing
 *     page, so the compounding story holds without a human in the loop.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileLib, OUT_DIR } from './compile-lib.mjs';

await compileLib();
const lib = (name) => pathToFileURL(path.join(OUT_DIR, `${name}.js`)).href;

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-'));
process.env.WIKI_ROOT = root;
process.env.HERMES_CMD = 'node';
process.env.HERMES_ARGS = 'scripts/fake-hermes.mjs';

const { createCluster } = await import(lib('clusters'));
const jobs = await import(lib('jobs'));
const { readSettings, writeSettings } = await import(lib('settings'));
const { STAGING_DIR, PLANS_DIR } = await import(lib('config'));

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const settle = (job) =>
  new Promise((resolve) => {
    const stop = jobs.subscribe(job.id, (j) => {
      if (!jobs.isActive(j.status)) {
        stop();
        resolve(j);
      }
    });
  });
const ls = async (dir) => fs.readdir(dir).catch(() => []);
const pageCount = async (cluster) => {
  let n = 0;
  for (const d of ['entities', 'concepts', 'comparisons', 'queries']) {
    n += (await ls(path.join(root, cluster, d))).filter((f) => f.endsWith('.md')).length;
  }
  return n;
};
async function stage(name, body) {
  await fs.mkdir(STAGING_DIR, { recursive: true });
  const staged = path.join(STAGING_DIR, `${crypto.randomUUID()}__${name}`);
  await fs.writeFile(staged, body);
  return staged;
}
const SOURCE = `---\nsource_url: x\ningested: 2026-09-18\nsha256: 0\n---\nThe warehouse team checks every returned item before we release the refund.\n`;

// Mirrors what the upload route does with the switch, without the HTTP layer.
async function upload(cluster, name) {
  const staged = await stage(name, SOURCE);
  const { reviewBeforeFiling } = await readSettings(cluster);
  const start = reviewBeforeFiling ? jobs.startPlanning : jobs.startIngest;
  const job = await start({ cluster, filename: name, stagedPath: staged, originalPath: null });
  return settle(job);
}

await createCluster({ name: 'ops', scope: 'Returns and refunds', entities: '', questions: '' });

// 1
check('a new cluster has review off', (await readSettings('ops')).reviewBeforeFiling === false);

// 2
let job = await upload('ops', 'note.md');
check('review off: one run ends done', job.status === 'done', job.status);
check('review off: pages written', (await pageCount('ops')) === 3, `${await pageCount('ops')} pages`);
check('review off: source moved into raw/', (await ls(path.join(root, 'ops', 'raw'))).includes('note.md'));
check('review off: staging emptied', (await ls(STAGING_DIR)).length === 0);
check('review off: a commit was made', typeof job.commit === 'string' && job.commit.length > 0, job.commit ?? 'none');
check('review off: no plan was ever created', (await ls(PLANS_DIR)).length === 0);
check('review off: the check ran', job.lint !== null && job.lint.ok === true);

// 3
await writeSettings('ops', { reviewBeforeFiling: true });
check('switch persists and reads back', (await readSettings('ops')).reviewBeforeFiling === true);

// 4
const pagesBefore = await pageCount('ops');
job = await upload('ops', 'second.md');
check('review on: upload stops at awaiting_approval', job.status === 'awaiting_approval', job.status);
check('review on: nothing written yet', (await pageCount('ops')) === pagesBefore);
check('review on: source still in staging', (await ls(STAGING_DIR)).length === 1);
await jobs.rejectPlan(job.id);

// 5
await writeSettings('ops', { reviewBeforeFiling: false });
job = await upload('ops', 'third.md');
check('off again: files automatically', job.status === 'done', job.status);
check('off again: an existing page was updated', job.diff !== null && job.diff.updatedPages >= 1, JSON.stringify(job.diff));

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await fs.rm(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
