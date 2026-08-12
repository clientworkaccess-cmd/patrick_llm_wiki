#!/usr/bin/env node
/**
 * A stand-in for the real Hermes binary.
 *
 * The dashboard talks to the agent across a process boundary — spawn, argv,
 * stdout — so anything that honours that contract is a valid agent. This one
 * writes plausible pages and streams plausible progress, which means the entire
 * UI can be built and iterated on a dev machine with no API key, no spend, and
 * no client documents ever leaving the VPS.
 *
 * Selected via HERMES_CMD / HERMES_ARGS. On the VPS those point at the real
 * binary instead and nothing else changes.
 *
 * It also streams line by line, which is the OPTIMISTIC assumption about
 * `hermes -z`. Whether the real binary does that is unverified (T1a). If it
 * turns out not to, this fake will look better than production — so judge the
 * chat feel against the real thing, not against this.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const WIKI_PATH = process.env.WIKI_PATH;
const prompt = process.argv[process.argv.indexOf('-z') + 1] ?? '';
const usageFile = process.argv.includes('--usage-file')
  ? process.argv[process.argv.indexOf('--usage-file') + 1]
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = async (line, pause = 700) => {
  process.stdout.write(line + '\n');
  await sleep(pause);
};

if (!WIKI_PATH) {
  console.error('WIKI_PATH is not set — the dashboard must pass it on every invocation');
  process.exit(1);
}

const isIngest = /source document has been placed/i.test(prompt);

if (isIngest) {
  await ingest();
} else {
  await answer();
}

async function ingest() {
  const source = prompt.match(/placed at:\s*(.+)/)?.[1]?.trim() ?? 'the uploaded file';
  const label = path.basename(source).replace(/^[0-9a-f-]{36}__/, '');

  await say('Reading SCHEMA.md to understand this cluster.');
  await say(`Converting ${label} with markitdown.`);
  await say('Extracted 11 sections. No OCR needed — the document has a text layer.');
  await say('Looking for pages this overlaps with.');

  await fs.mkdir(path.join(WIKI_PATH, 'raw', 'articles'), { recursive: true });
  await fs.mkdir(path.join(WIKI_PATH, 'entities'), { recursive: true });
  await fs.mkdir(path.join(WIKI_PATH, 'concepts'), { recursive: true });

  try {
    await fs.copyFile(source, path.join(WIKI_PATH, 'raw', 'articles', label));
  } catch {
    /* the fake does not care if the staged file moved */
  }

  const stamp = new Date().toISOString().slice(0, 10);

  await say('Writing entities/warehouse-team.md');
  await write('entities/warehouse-team.md', `# Warehouse Team

The team responsible for picking, packing and dispatching customer orders, and for
receiving returned items back into stock.

They are the approval step for any return that arrives without a reference — see
[[Refund Policy]] for when that happens and [[Returns Portal]] for how it is logged.

## Responsibilities
- Pick and pack outbound orders
- Inspect returned items before restocking
- Flag damaged returns to [[Refund Policy]] for a manual decision

_Source: ${label}_
`);

  await say('Writing entities/returns-portal.md');
  await write('entities/returns-portal.md', `# Returns Portal

The internal tool used to log and track a return from request through to refund.

It will not process a request past the window defined in [[Refund Policy]] — those
route to manager approval instead. Items logged here are inspected by the
[[Warehouse Team]] before any refund is released.

_Source: ${label}_
`);

  await say('Updating concepts/refund-policy.md — this overlaps an existing page.');
  // Deliberately varies per run. A real second ingest of a related document
  // changes an existing page; if the fake wrote byte-identical content the diff
  // screen would always report "0 updated" and the compounding story — the
  // thing the product is actually selling — would never be visible locally.
  await write('concepts/refund-policy.md', `# Refund Policy

How refunds are assessed, approved and paid.

Standard requests inside the return window are handled automatically by the
[[Returns Portal]]. Anything outside it needs manager approval — the portal will not
process it. In every case the [[Warehouse Team]] must confirm the item came back and
is in resalable condition before the refund is released.

## Edge cases
- **Past the window** — manager approval, not automatic
- **Damaged on arrival** — [[Warehouse Team]] decision, logged in the [[Returns Portal]]
- **No reference number** — treated as a manual return

## Sources filed into this page
${label} (filed ${new Date().toISOString()})
`);

  await say('Updating index.md');
  await write('index.md', `# Index

Every page in this cluster.

## Entities
- [[Warehouse Team]] — picks, packs, and inspects returns
- [[Returns Portal]] — the tool returns are logged and tracked in

## Concepts
- [[Refund Policy]] — how refunds are assessed, approved and paid
`);

  await say('Appending to log.md');
  const logPath = path.join(WIKI_PATH, 'log.md');
  const existing = await fs.readFile(logPath, 'utf8').catch(() => '# Log\n');
  await fs.writeFile(
    logPath,
    `${existing.trimEnd()}\n\n- ${stamp} — Ingested \`${label}\`. 2 new pages, 1 updated, 5 new connections.\n`,
    'utf8',
  );

  if (usageFile) {
    await fs.writeFile(
      usageFile,
      JSON.stringify({ estimated_cost_usd: 0, tokens: 0, model: 'fake-hermes', note: 'local stand-in, no API call made' }, null, 2),
      'utf8',
    );
  }

  await say('Done.', 0);
}

async function answer() {
  const question = prompt.match(/"([^"]+)"/)?.[1] ?? 'your question';

  for (const chunk of [
    `Past the standard window, a refund does not go through automatically —`,
    `the Returns Portal will not process it. It routes to manager approval instead.`,
    ``,
    `The Warehouse Team still has to confirm the item came back and is resalable`,
    `before anything is paid out, the same as any other return.`,
    ``,
    `(Asked: ${question})`,
    ``,
    `SOURCES: [[Refund Policy]], [[Returns Portal]]`,
  ]) {
    await say(chunk, 220);
  }
}

async function write(relative, body) {
  const file = path.join(WIKI_PATH, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, 'utf8');
}
