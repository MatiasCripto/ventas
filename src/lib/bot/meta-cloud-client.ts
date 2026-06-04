// Meta Cloud API client — wraps HTTP calls to Meta's Graph API
// Replaces Evolution API client. Each store has its own token + phone_number_id.
// Maintains the same exported interface as the old evolution-client.ts

import { createServiceClient } from '@/lib/supabase/service'

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0'

// ── Store credential helpers (multi-tenant) ──────────────────────────

interface StoreMetaCreds {
  meta_access_token: string
  meta_phone_number_id: string
}

async function getStoreCreds(instanceName?: string): Promise<StoreMetaCreds> {
  if (instanceName) {
    // instanceName maps to meta_phone_number_id
    const sb = createServiceClient()
    const { data: store } = await sb.from('stores')
      .select('meta_access_token, meta_phone_number_id')
      .eq('meta_phone_number_id', instanceName)
      .maybeSingle()
    if (store?.meta_access_token && store?.meta_phone_number_id) {
      return { meta_access_token: store.meta_access_token, meta_phone_number_id: store.meta_phone_number_id }
    }
  }
  // Fallback: try first store's creds or env vars
  const token = process.env.META_ACCESS_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  if (token && phoneId) {
    return { meta_access_token: token, meta_phone_number_id: phoneId }
  }
  throw new Error('Meta Cloud API: no credentials found for instance ' + (instanceName ?? 'default'))
}

async function graphPost(creds: StoreMetaCreds, payload: Record<string, any>) {
  const res = await fetch(`${GRAPH_API_BASE}/${creds.meta_phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.meta_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta Cloud API error: ${err}`)
  }
  return res.json()
}

// ── Exported functions (same interface as evolution-client.ts) ─────

export async function sendText(phone: string, text: string, _delay?: number, instanceName?: string) {
  const creds = await getStoreCreds(instanceName)
  return graphPost(creds, {
    recipient_type: 'individual',
    to: phone.replace(/@s\.whatsapp\.net$/, ''),
    type: 'text',
    text: { preview_url: false, body: text },
  })
}

export async function sendMultiple(phone: string, messages: string[], delayBetween?: number, instanceName?: string) {
  for (const msg of messages) {
    await sendText(phone, msg, delayBetween, instanceName)
    if (delayBetween) await new Promise(r => setTimeout(r, delayBetween))
  }
}

export async function sendImage(phone: string, imageUrl: string, caption?: string, _delay?: number, instanceName?: string) {
  const creds = await getStoreCreds(instanceName)
  return graphPost(creds, {
    recipient_type: 'individual',
    to: phone.replace(/@s\.whatsapp\.net$/, ''),
    type: 'image',
    image: { link: imageUrl, caption: caption ?? '' },
  })
}

export async function markAsRead(_jid: string, messageId: string, instanceName?: string) {
  const creds = await getStoreCreds(instanceName)
  return graphPost(creds, {
    status: 'read',
    message_id: messageId,
  })
}

export async function downloadMedia(_remoteJid: string, mediaId: string, instanceName?: string): Promise<ArrayBuffer | null> {
  try {
    const creds = await getStoreCreds(instanceName)
    // Step 1: Get media URL from Meta
    const mediaRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${creds.meta_access_token}` },
    })
    if (!mediaRes.ok) {
      console.error('[MetaCloud] downloadMedia: failed to get media info', mediaRes.status)
      return null
    }
    const mediaData = await mediaRes.json()
    const url = mediaData.url
    if (!url) {
      console.error('[MetaCloud] downloadMedia: no URL in media response')
      return null
    }
    // Step 2: Download the binary
    const dlRes = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.meta_access_token}` },
    })
    if (!dlRes.ok) {
      console.error('[MetaCloud] downloadMedia: failed to download binary', dlRes.status)
      return null
    }
    return dlRes.arrayBuffer()
  } catch (err) {
    console.error('[MetaCloud] downloadMedia exception:', err)
    return null
  }
}

// ── Stub functions (Meta has no QR / instance management) ───────────

export async function getQrCode(_instanceName?: string) {
  // Meta Cloud API doesn't use QR codes — return connected
  return { connected: true, provider: 'meta' }
}

export async function getInstanceStatus(instanceName?: string) {
  // Meta Cloud is always "connected" as long as token is saved
  // If instanceName is provided, check that credentials exist
  if (instanceName) {
    try {
      await getStoreCreds(instanceName)
      return { instance: { state: 'open' }, provider: 'meta' }
    } catch {
      return { instance: { state: 'close' }, provider: 'meta' }
    }
  }
  return { instance: { state: 'open' }, provider: 'meta' }
}

export async function createInstance(_instanceName: string): Promise<boolean> {
  // Meta Cloud API instances are self-managed in the dashboard
  return true
}

export async function deleteInstance(_instanceName: string): Promise<boolean> {
  // Meta Cloud API instances are self-managed in the dashboard
  return true
}
