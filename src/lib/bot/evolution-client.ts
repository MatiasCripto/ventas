// ── Evolution API → Meta Cloud API adapter ─────────────────────────
// This file re-exports all functions from meta-cloud-client so that
// existing imports (sendText, sendImage, etc.) continue to work unchanged.
//
// Migration: Evolution API → Meta Cloud API
// - QR codes → permanent tokens (no QR needed)
// - Multi-tenant: each store has its own token + phone_number_id
// - getQrCode/getInstanceStatus return stub responses

export {
  sendText,
  sendMultiple,
  sendImage,
  markAsRead,
  downloadMedia,
  getQrCode,
  getInstanceStatus,
  createInstance,
  deleteInstance,
} from './meta-cloud-client'
