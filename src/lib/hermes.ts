import { spawn } from 'node:child_process';
import { HERMES_ARGS, HERMES_CMD, WIKI_ROOT } from './config';

/**
 * The process boundary between the dashboard and the agent.
 *
 * There is no network protocol here. Node launches Hermes as a child process,
 * hands it a WIKI_PATH it cannot reach outside of, and reads stdout. That env
 * var is the isolation boundary — structural, not a rule the agent is asked to
 * follow.
 *
 * `spawn` with an args array, never `exec`: exec goes through a shell, which
 * makes any document title or user question a shell-injection vector.
 */

export interface HermesRun {
  /** Yields whatever the agent writes, line by line, as it arrives. */
  lines: AsyncGenerator<string>;
  /** Resolves with the exit code once the process ends. */
  done: Promise<number>;
  kill: () => void;
}

/**
 * The agent's entire environment.
 *
 * Deliberately NOT a copy of process.env. Hermes runs unattended with shell
 * access over documents we did not write, so every variable it can see is
 * something an injected PDF could read and exfiltrate. It gets what it needs to
 * run, the wiki path, and the model key — nothing else.
 *
 * Do not widen this to `...process.env`.
 */
function narrowEnv(clusterPath: string): NodeJS.ProcessEnv {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    WIKI_PATH: clusterPath,
    WIKI_ROOT,
    NODE_ENV: process.env.NODE_ENV ?? 'production',
  };
  if (process.env.HERMES_API_KEY) env.HERMES_API_KEY = process.env.HERMES_API_KEY;
  return env as NodeJS.ProcessEnv;
}

export function runHermes(opts: {
  prompt: string;
  clusterPath: string;
  usageFile?: string;
  timeoutMs?: number;
}): HermesRun {
  const args = [...HERMES_ARGS, '-z', opts.prompt, '--yolo'];
  if (opts.usageFile) args.push('--usage-file', opts.usageFile);

  const child = spawn(HERMES_CMD, args, {
    env: narrowEnv(opts.clusterPath),
    // No shell. See above.
    shell: false,
  });

  let settle: (code: number) => void;
  let fail: (err: Error) => void;
  const done = new Promise<number>((res, rej) => {
    settle = res;
    fail = rej;
  });

  const timer = opts.timeoutMs
    ? setTimeout(() => {
        child.kill('SIGKILL');
        fail(new Error(`Hermes exceeded ${opts.timeoutMs}ms and was killed`));
      }, opts.timeoutMs)
    : null;

  child.on('error', (err) => {
    if (timer) clearTimeout(timer);
    fail(new Error(`Could not start "${HERMES_CMD}": ${err.message}`));
  });
  child.on('close', (code) => {
    if (timer) clearTimeout(timer);
    settle(code ?? 0);
  });

  async function* lines(): AsyncGenerator<string> {
    let buffer = '';
    child.stdout.setEncoding('utf8');
    for await (const chunk of child.stdout) {
      buffer += chunk;
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) yield line;
    }
    if (buffer.length) yield buffer;
  }

  // stderr is diagnostics, not product output. Surface it in the server log so a
  // failing ingest isn't a silent mystery, but never stream it to the client.
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => console.error('[hermes]', d.trimEnd()));

  return { lines: lines(), done, kill: () => child.kill('SIGTERM') };
}

/** Collect a full run into one string. Used for short, non-streaming calls. */
export async function runHermesToString(opts: Parameters<typeof runHermes>[0]): Promise<string> {
  const run = runHermes(opts);
  const out: string[] = [];
  for await (const line of run.lines) out.push(line);
  await run.done;
  return out.join('\n').trim();
}
