import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { HttpError, ORIGINALS_DIR, assertClusterName, clusterPath } from '@/lib/config';
import { ensureDashboardDirs, exists } from '@/lib/clusters';
import { startIngest } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Receives pre-parsed Markdown content (or pasted text) along with optional
 * original binary files, formats SHA256 frontmatter, saves the source file directly
 * into $WIKI_PATH/raw/<filename>.md, and launches Hermes for agent delegation & curation.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const cluster = assertClusterName(String(form.get('cluster') ?? ''));

    const parsedText = String(form.get('parsedText') ?? '').trim();
    const rawFilename = String(form.get('filename') ?? 'document.md').trim();
    const file = form.get('file');

    if (!parsedText && !(file instanceof File)) {
      throw new HttpError(400, 'No content or file in request');
    }

    if (file instanceof File && file.size === 0) {
      throw new HttpError(400, 'Uploaded file is empty');
    }

    if (!(await exists(clusterPath(cluster)))) {
      throw new HttpError(404, `No cluster named "${cluster}"`);
    }

    await ensureDashboardDirs();

    const baseName = rawFilename || (file instanceof File ? file.name : 'pasted_text.md');
    const safeName = path.basename(baseName).replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'source.md';
    const mdFileName = safeName.endsWith('.md') ? safeName : `${path.parse(safeName).name}.md`;

    // 1. If original binary is provided, archive it in .dashboard/originals/
    if (file instanceof File) {
      const originalStaged = path.join(ORIGINALS_DIR, `${randomUUID()}__${safeName}`);
      await fs.writeFile(originalStaged, Buffer.from(await file.arrayBuffer()));
    }

    // 2. Prepare raw directory inside cluster: $WIKI_PATH/raw/
    const rawDir = clusterPath(cluster, 'raw');
    await fs.mkdir(rawDir, { recursive: true });

    const rawFilePath = path.join(rawDir, mdFileName);
    const relativeRawPath = `raw/${mdFileName}`;

    // 3. Format SHA256 frontmatter over parsed content if not present
    let contentToWrite = parsedText;
    if (!contentToWrite.startsWith('---')) {
      const sha256 = createHash('sha256').update(parsedText).digest('hex');
      const today = new Date().toISOString().slice(0, 10);
      const frontmatter = [
        '---',
        `source_url: dashboard_upload://${safeName}`,
        `ingested: ${today}`,
        `sha256: ${sha256}`,
        '---',
        '',
      ].join('\n');

      contentToWrite = frontmatter + parsedText;
    }

    await fs.writeFile(rawFilePath, contentToWrite, 'utf8');

    // 4. Launch Hermes ingest job with clean relative path in raw/
    const job = await startIngest({
      cluster,
      filename: baseName,
      rawPath: relativeRawPath,
    });

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
