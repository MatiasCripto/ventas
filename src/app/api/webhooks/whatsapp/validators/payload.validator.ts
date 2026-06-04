// ── WhatsApp webhook payload validators ──────────────────────
// Supports both Evolution API and Meta Cloud API payloads.
//
// Evolution payload:
//   { event: 'messages.upsert', instance: 'name', data: { key: { remoteJid: '...@s.whatsapp.net' }, message: { conversation: '...' } } }
//
// Meta Cloud API payload:
//   { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '...' }, messages: [{ from: '...', text: { body: '...' } }] } }] }] }

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import type { EvolutionWebhookPayload, EvolutionMessageData } from '@/lib/types/whatsapp.types'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export interface ValidatedPayload {
  payload: EvolutionWebhookPayload | MetaWebhookPayload
  rawBody: string
  phone: string
  text: string
  pushName?: string
  msgId?: string
  phoneNumberId?: string   // Meta Cloud API: the recipient phone_number_id
}

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: { phone_number_id: string; display_phone_number?: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: Array<{
          id: string
          from: string
          type: string
          timestamp: string
          text?: { body: string }
          image?: { id: string; caption?: string }
          audio?: { id: string }
        }>
      }
      field: string
    }>
  }>
}

/**
 * Detect if a parsed payload is a Meta Cloud API webhook
 */
function isMetaPayload(payload: any): payload is MetaWebhookPayload {
  return payload?.object === 'whatsapp_business_account'
}

/**
 * Optional HMAC-SHA256 verification of payload signature.
 * Used by Evolution API. Meta Cloud API uses its own verification.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'placeholder') return true
  if (!signatureHeader) {
    console.warn('[WEBHOOK] WEBHOOK_SECRET set but no x-evolution-signature header — allowing')
    return true
  }
  try {
    const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
    return expected === signatureHeader
  } catch (err) {
    console.error('[WEBHOOK] HMAC verification error:', err)
    return false
  }
}

export async function validateWebhookPayload(req: NextRequest): Promise<
  { ok: true; data: ValidatedPayload } | { ok: false; response: NextResponse }
> {
  // 1. Read raw body for HMAC
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Cannot read body' }, { status: 400 }) }
  }

  // 2. Parse JSON payload
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }

  // 3. Detect payload type and extract data
  if (isMetaPayload(payload)) {
    // ── Meta Cloud API format ────────────────────────────────
    const change = payload.entry?.[0]?.changes?.[0]
    const value = change?.value
    if (!value || !value.messages?.length) {
      return { ok: false, response: NextResponse.json({ ok: true }) }
    }

    const msg = value.messages[0]
    const phoneNumberId = value.metadata?.phone_number_id
    const phone = msg.from
    const text = msg.text?.body ?? msg.image?.caption ?? ''
    const msgId = msg.id
    const pushName = value.contacts?.[0]?.profile?.name

    if (!phone || !text) {
      console.log('[WEBHOOK] Meta: skip — no phone or text')
      return { ok: false, response: NextResponse.json({ ok: true }) }
    }

    // Rate limit
    const rateCheck = checkRateLimit(`webhook:${phone}`, { windowMs: 60_000, maxHits: 30 })
    if (!rateCheck.allowed) {
      console.warn('[WEBHOOK] Meta: rate limit exceeded for', phone)
      return { ok: false, response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }
    }

    return {
      ok: true,
      data: {
        payload,
        rawBody,
        phone,              // Meta sends clean international format (no @s.whatsapp.net)
        text,
        pushName,
        msgId,
        phoneNumberId,      // Used to find the store
      },
    }
  }

  // ── Evolution API format (legacy) ──────────────────────────
  // 2.1 Verify HMAC signature (only for Evolution)
  if (!verifySignature(rawBody, req.headers.get('x-evolution-signature'))) {
    console.warn('[WEBHOOK] HMAC verification failed — rejecting')
    return { ok: false, response: NextResponse.json({ error: 'Invalid signature' }, { status: 401 }) }
  }

  // 2.2 Filter events
  if (payload.event !== 'messages.upsert') {
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  const data = payload.data as EvolutionMessageData
  if (data.key?.fromMe) {
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  // 2.3 Extract phone and text
  const jid = data.key?.remoteJid ?? ''
  const phone = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '')
  const text = data.message?.conversation || data.message?.extendedTextMessage?.text || ''
  const pushName = data.pushName
  const msgId = data.key?.id

  if (!phone || !text) {
    console.log('[WEBHOOK] Evolution: skip — no phone or text', { phone, hasText: !!text })
    return { ok: false, response: NextResponse.json({ ok: true }) }
  }

  // 2.4 Rate limit
  const rateCheck = checkRateLimit(`webhook:${phone}`, { windowMs: 60_000, maxHits: 30 })
  if (!rateCheck.allowed) {
    console.warn('[WEBHOOK] Evolution: rate limit exceeded for', phone)
    return { ok: false, response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }
  }

  return {
    ok: true,
    data: { payload: payload as EvolutionWebhookPayload, rawBody, phone, text, pushName, msgId },
  }
}
