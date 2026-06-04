// WhatsApp Cloud API client — wraps HTTP calls to Meta's Graph API
// Each store has its own token + phone_number_id (self-service model)

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0'

// ── Discovery: from a raw token, find the WABA and phone numbers ──────

export interface WabaInfo {
  wabaId: string
  wabaName: string
  phoneNumberId: string
  displayPhoneNumber: string
}

export interface DiscoveryResult {
  ok: boolean
  waba?: WabaInfo
  tokenUserId?: string
  error?: string
}

/**
 * Verify a System User token and auto-discover the WhatsApp Business Account
 * and phone numbers associated with it.
 *
 * The System User must have `whatsapp_business_management` permission
 * and be assigned to the WABA.
 */
export async function discoverFromToken(token: string): Promise<DiscoveryResult> {
  async function graphGet(path: string) {
    const res = await fetch(`${GRAPH_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, body, status: res.status }
  }

  // Step 1: Validate token
  const me = await graphGet('/me?fields=id,name')
  if (!me.ok) {
    const msg = me.body?.error?.message ?? 'Token inválido'
    return { ok: false, error: `Token inválido: ${msg}` }
  }
  const userId: string = me.body.id
  if (!userId) return { ok: false, error: 'No se pudo identificar el usuario del token' }

  // Step 2: Try to get WABA directly from /me with field expansion
  const edgeNames = [
    'whatsapp_business_accounts',
    'assigned_whatsapp_business_accounts',
    'client_whatsapp_business_accounts',
  ]

  for (const edge of edgeNames) {
    const r = await graphGet(
      `/me?fields=${edge}{id,name,phone_numbers{id,display_phone_number,verified_name}}`,
    )
    if (!r.ok) continue
    const accounts = r.body?.[edge]?.data ?? []
    for (const waba of accounts) {
      const phones = waba.phone_numbers?.data ?? []
      if (phones.length > 0) {
        const phone = phones[0]
        return {
          ok: true,
          waba: {
            wabaId: waba.id,
            wabaName: waba.name ?? '',
            phoneNumberId: phone.id,
            displayPhoneNumber: phone.display_phone_number ?? phone.verified_name ?? '',
          },
          tokenUserId: userId,
        }
      }
    }
  }

  // Step 3: Fallback — try /me/businesses → client_whatsapp_business_accounts
  const biz = await graphGet('/me/businesses?fields=name,client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}')
  if (biz.ok) {
    for (const business of biz.body?.data ?? []) {
      const accounts = business.client_whatsapp_business_accounts?.data ?? []
      for (const waba of accounts) {
        const phones = waba.phone_numbers?.data ?? []
        if (phones.length > 0) {
          const phone = phones[0]
          return {
            ok: true,
            waba: {
              wabaId: waba.id,
              wabaName: waba.name ?? business.name ?? '',
              phoneNumberId: phone.id,
              displayPhoneNumber: phone.display_phone_number ?? phone.verified_name ?? '',
            },
            tokenUserId: userId,
          }
        }
      }
    }
  }

  return {
    ok: false,
    error: 'No se encontró una cuenta de WhatsApp Business asociada a este token. ' +
      'Asegurate de que el System User tenga acceso al WABA con permisos de ' +
      '"WhatsApp Business Management". ' +
      'En Meta Business Platform: Usuarios del Sistema > [tu usuario] > Asignar activos > ' +
      'Seleccionar la cuenta de WhatsApp Business y dar permiso "Gestionar WhatsApp Business".',
  }
}
