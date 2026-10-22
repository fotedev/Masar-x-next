import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidRequestBody, requireAuthenticatedUser } from '@/lib/api-auth';
import { pingActiveUser, recordFileDownload } from '@/lib/metrics';

/**
 * Lean-metrics ingestion (owner directive 2026-10-21): authenticated
 * clients ping meaningful product events only — file downloads and the
 * active-user presence heartbeat. Everything lands in Redis counters
 * (server-side only; the REST token never reaches the client) and
 * Postgres receives zero analytics rows. Unauthenticated calls are
 * rejected; unknown event types are rejected; Redis being unconfigured
 * makes every write a silent no-op.
 */

const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('download'),
    id: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    fileUrl: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('active_ping'),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!('user' in auth)) return auth.response;

  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return invalidRequestBody(parsed.error.issues[0]?.message ?? 'Invalid event');
  }

  if (parsed.data.type === 'download') {
    recordFileDownload(auth.user.id, parsed.data);
  } else {
    pingActiveUser(auth.user.id);
  }

  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
