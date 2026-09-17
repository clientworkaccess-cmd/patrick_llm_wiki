import fs from 'node:fs/promises';
import path from 'node:path';
import { SETTINGS_DIR, assertClusterName } from './config';
import { ensureDashboardDirs, readIfPresent } from './clusters';

/**
 * Per-cluster switches the dashboard owns.
 *
 * Kept in .dashboard/settings/<cluster>.json rather than in SCHEMA.md. The
 * schema is the agent's brief and gets copied into the planning sandbox; a
 * dashboard switch belongs in neither place. A missing file means defaults, so
 * a cluster created before this existed behaves exactly like a new one.
 */
export interface ClusterSettings {
  /**
   * Stop each upload at a review screen before anything is filed.
   *
   * Off by default: the product's premise is that filing needs nobody, so the
   * record grows by itself instead of piling up behind a person. On is for a
   * pilot's first weeks, when seeing what the agent understood, with the
   * quotes, is how a team learns to trust it. It costs a second agent run and
   * a click per document, which is why it is a switch and not the rule.
   */
  reviewBeforeFiling: boolean;
}

export const DEFAULT_SETTINGS: ClusterSettings = { reviewBeforeFiling: false };

function fileFor(cluster: string): string {
  return path.join(SETTINGS_DIR, `${assertClusterName(cluster)}.json`);
}

export async function readSettings(cluster: string): Promise<ClusterSettings> {
  const raw = await readIfPresent(fileFor(cluster));
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<ClusterSettings>;
    // Strict about the value: anything but `true` is off. A settings file is
    // small enough that a bad edit should fall back, not throw.
    return { reviewBeforeFiling: parsed.reviewBeforeFiling === true };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(
  cluster: string,
  patch: Partial<ClusterSettings>,
): Promise<ClusterSettings> {
  const next: ClusterSettings = { ...(await readSettings(cluster)), ...patch };
  await ensureDashboardDirs();
  await fs.writeFile(fileFor(cluster), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
