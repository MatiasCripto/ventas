import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAccess } from '@/lib/auth/require-org'

// Evolution API was migrated to Meta Cloud API.
// Disconnect is handled via the /api/whatsapp/disconnect endpoint.
export async function GET(_req: NextRequest) {
  const auth = await requireOrgAccess(_req)
  if (!auth.authorized) return auth.response

  return NextResponse.json({ ok: true, provider: 'meta' })
}
