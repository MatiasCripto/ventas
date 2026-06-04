-- Meta Cloud API (WhatsApp Cloud API) — replaces Evolution API
-- Each store has its own token + phone_number_id (multi-tenant)

ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_access_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_waba_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT DEFAULT 'meta';

CREATE INDEX IF NOT EXISTS idx_stores_meta_phone_number_id ON stores(meta_phone_number_id) WHERE meta_phone_number_id IS NOT NULL;
