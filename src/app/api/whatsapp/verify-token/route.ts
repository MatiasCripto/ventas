import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireOrgAccess } from '@/lib/auth/require-org'
import { discoverFromToken } from '@/lib/bot/whatsapp-cloud-client'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOrgAccess(req)
    if (!auth.authorized) return auth.response

    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    // Discover WABA + phone numbers from the token
    const result = await discoverFromToken(token)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Save to the store's record
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
      meta_access_token: token,
      meta_phone_number_id: result.waba!.phoneNumberId,
      meta_waba_id: result.waba!.wabaId,
      whatsapp_provider: 'meta',
      whatsapp_number: result.waba!.displayPhoneNumber,
    }).eq('id', store.id)

    return NextResponse.json({
      ok: true,
      phone: result.waba!.displayPhoneNumber,
      wabaName: result.waba!.wabaName,
    })
  } catch (err) {
    console.error('[WhatsApp Verify Token]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
