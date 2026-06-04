import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAccess } from '@/lib/auth/require-org'

// Evolution API was migrated to Meta Cloud API.
// Meta Cloud API doesn't use QR codes — always connected.
export async function GET(_req: NextRequest) {
  const auth = await requireOrgAccess(_req)
  if (!auth.authorized) return auth.response

  return NextResponse.json({ connected: true, provider: 'meta' })
}
