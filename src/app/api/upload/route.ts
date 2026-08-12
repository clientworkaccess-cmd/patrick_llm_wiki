import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError, STAGING_DIR, assertClusterName } from '@/lib/config';
import { ensureDashboardDirs, exists } from '@/lib/clusters';
import { clusterPath } from '@/lib/config';
import { startIngest } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Receives a file and returns a job id immediately. The ingest itself runs for
 * minutes after this response is sent — holding the request open would mean a
 * refresh or a proxy timeout kills a write halfway through.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const cluster = assertClusterName(String(form.get('cluster') ?? ''));
    const file = form.get('file');

    if (!(file instanceof File)) throw new HttpError(400, 'No file in the request');
    if (file.size === 0) throw new HttpError(400, 'That file is empty');
    if (!(await exists(clusterPath(cluster)))) throw new HttpError(404, `No cluster named "${cluster}"`);

    await ensureDashboardDirs();

    // Never trust the client's filename on disk. Keep the original for display,
    // write to a name we control.
    const safeName = path.basename(file.name).replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'upload';
    const staged = path.join(STAGING_DIR, `${randomUUID()}__${safeName}`);
    await fs.writeFile(staged, Buffer.from(await file.arrayBuffer()));

    const job = await startIngest({ cluster, filename: file.name, stagedPath: staged });

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
