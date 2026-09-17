import { NextRequest, NextResponse } from 'next/server';
import { HttpError, assertClusterName, clusterPath } from '@/lib/config';
import { exists } from '@/lib/clusters';
import { readSettings, writeSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The cluster's switches. Today there is one: review before filing. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ cluster: string }> }) {
  try {
    const cluster = await resolve(ctx);
    return NextResponse.json({ settings: await readSettings(cluster) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ cluster: string }> }) {
  try {
    const cluster = await resolve(ctx);
    const body = await req.json();
    if (typeof body.reviewBeforeFiling !== 'boolean') {
      throw new HttpError(400, 'reviewBeforeFiling must be true or false');
    }
    const settings = await writeSettings(cluster, { reviewBeforeFiling: body.reviewBeforeFiling });
    return NextResponse.json({ settings });
  } catch (err) {
    return fail(err);
  }
}

async function resolve(ctx: { params: Promise<{ cluster: string }> }): Promise<string> {
  const { cluster: raw } = await ctx.params;
  const cluster = assertClusterName(raw);
  if (!(await exists(clusterPath(cluster)))) throw new HttpError(404, `No cluster named "${cluster}"`);
  return cluster;
}

function fail(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[api/clusters/settings]', err);
  return NextResponse.json({ error: 'Could not update the cluster settings' }, { status: 500 });
}
