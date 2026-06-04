import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const sb = createServiceClient()
    const { data: store } = await sb.from('stores')
      .select('id')
      .eq('organization_id', auth.orgId)
      .limit(1)
      .maybeSingle()

    if (!store) {
      return NextResponse.json({ error: 'No store found' }, { status: 404 })
    }

    await sb.from('stores').update({
      meta_access_token: null,
      meta_phone_number_id: null,
      meta_waba_id: null,
      whatsapp_provider: 'meta',
      whatsapp_number: null,
    }).eq('id', store.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp Disconnect]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
