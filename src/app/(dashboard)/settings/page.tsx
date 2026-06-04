'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Store, Palette, Cpu, Save, Upload, X, CheckCircle2, AlertCircle, Smartphone, Link2Off, MessageSquare } from 'lucide-react'

export default function SettingsPage() {
  const { authUser, currentStore, updateOrgName, updateCurrentStore } = useAuthContext()
  const [orgName, setOrgName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const [whatsappNumberDisplay, setWhatsappNumberDisplay] = useState('')
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Meta Cloud API state
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('')
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [metaWabaId, setMetaWabaId] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (authUser?.organization?.name) setOrgName(authUser.organization.name)
    if (currentStore?.name) setStoreName(currentStore.name)
    if (currentStore?.logo_url) setStoreLogo(currentStore.logo_url)
    if (currentStore?.whatsapp_number) { setWhatsappNumberDisplay(currentStore.whatsapp_number); setWhatsappPhone(currentStore.whatsapp_number) }
    if (currentStore?.meta_phone_number_id) setMetaPhoneNumberId(currentStore.meta_phone_number_id)
    if (currentStore?.meta_access_token) setMetaAccessToken(currentStore.meta_access_token)
    if (currentStore?.meta_waba_id) setMetaWabaId(currentStore.meta_waba_id)
    if (currentStore?.meta_access_token) setIsConnected(true)
    // Load AI config — API first, localStorage fallback on any error (network + non-2xx)
    fetch('/api/settings/ai-config').then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    }).then(data => {
      if (data.provider) setAiProvider(data.provider)
      if (data.apiKey) setAiApiKey(data.apiKey)
      if (data.model) setAiModel(data.model)
    }).catch(() => {
      // Fallback: load from localStorage (works even when API returns 403/500)
      const lsProvider = localStorage.getItem('ca-dev-ai-provider')
      const lsKey = localStorage.getItem('ca-dev-ai-key')
      const lsModel = localStorage.getItem('ca-dev-ai-model')
      if (lsProvider) setAiProvider(lsProvider)
      if (lsKey) setAiApiKey(lsKey)
      if (lsModel) setAiModel(lsModel)
    })
  }, [authUser, currentStore])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentStore) return
    setUploadingLogo(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${currentStore.organization_id}/${currentStore.id}/logo.${ext}`
      const { error: uploadError } = await sb.storage.from('store-logos').upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (uploadError) { alert('Error al subir logo: ' + uploadError.message); return }
      const { data: urlData } = sb.storage.from('store-logos').getPublicUrl(path)
      const logoUrl = urlData.publicUrl
      setStoreLogo(logoUrl)
      await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl }),
      })
      updateCurrentStore({ logo_url: logoUrl })
    } catch (err: any) {
      alert('Error al subir logo: ' + (err?.message ?? 'desconocido'))
    }
    setUploadingLogo(false)
  }

  async function handleMetaSave() {
    try {
      await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaPhoneNumberId: metaPhoneNumberId,
          metaAccessToken: metaAccessToken,
          metaWabaId: metaWabaId,
          whatsappNumber: whatsappPhone || undefined,
        }),
      })
      updateCurrentStore({
        meta_phone_number_id: metaPhoneNumberId,
        meta_access_token: metaAccessToken,
        meta_waba_id: metaWabaId,
        whatsapp_number: whatsappPhone || null,
      } as any)
      setWhatsappNumberDisplay(whatsappPhone)
      setIsConnected(!!metaAccessToken && !!metaPhoneNumberId)
      localStorage.setItem('ca-dev-meta-phone-number-id', metaPhoneNumberId)
      localStorage.setItem('ca-dev-meta-access-token', metaAccessToken)
      localStorage.setItem('ca-dev-meta-waba-id', metaWabaId)
      if (whatsappPhone) localStorage.setItem('ca-dev-whatsapp', whatsappPhone)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // dev mode — Supabase not available
    }
  }

  async function handleMetaDisconnect() {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' })
      setMetaPhoneNumberId('')
      setMetaAccessToken('')
      setMetaWabaId('')
      setWhatsappPhone('')
      setWhatsappNumberDisplay('')
      setIsConnected(false)
      updateCurrentStore({
        meta_phone_number_id: null,
        meta_access_token: null,
        meta_waba_id: null,
        whatsapp_number: null,
      } as any)
    } catch {
      // ignore
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName !== authUser?.organization?.name ? orgName : undefined,
          storeName: storeName !== currentStore?.name ? storeName : undefined,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Settings] API error:', errData)
      }

      if (orgName !== authUser?.organization?.name) updateOrgName(orgName)
      if (currentStore) {
        const updates: Record<string, string | null> = {}
        if (storeName !== currentStore.name) updates.name = storeName
        if (Object.keys(updates).length > 0) updateCurrentStore(updates)
      }

      const isApiKeyDirty = aiApiKey && !aiApiKey.includes('••••')
      if (isApiKeyDirty) {
        await fetch('/api/settings/ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey, model: aiModel }),
        })
      }
    } catch {
      // dev mode — Supabase not available
    }

    localStorage.setItem('ca-dev-org-name', orgName)
    localStorage.setItem('ca-dev-store-name', storeName)
    if (storeLogo) localStorage.setItem('ca-dev-logo', storeLogo)
    localStorage.setItem('ca-dev-ai-provider', aiProvider)
    localStorage.setItem('ca-dev-ai-key', aiApiKey)
    localStorage.setItem('ca-dev-ai-model', aiModel)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
          style={{ background: 'var(--brand)' }}>
          General
        </span>
        <a href="/settings/payments"
          className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          Pagos
        </a>
      </div>
      <h1 className="text-xl font-semibold">Configuración</h1>

      {/* Organization */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Organización</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre</label>
          <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* Store */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Store size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Mi Tienda</h2>
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Foto de perfil</label>
          <div className="mt-2 flex items-center gap-4">
            {storeLogo ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
                <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                <button type="button" onClick={async () => {
                  setStoreLogo(null)
                  if (currentStore) {
                    await fetch('/api/settings/store', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logoUrl: null }),
                    })
                    updateCurrentStore({ logo_url: null })
                  }
                }}
                  className="absolute top-0 right-0 p-0.5 rounded-full bg-black/50 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl" style={{ color: 'var(--subtle)' }}>
                {currentStore?.name?.charAt(0)?.toUpperCase() ?? 'T'}
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border text-sm cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)' }}>
              {uploadingLogo ? (
                <span style={{ color: 'var(--muted)' }}>Subiendo...</span>
              ) : (
                <>
                  <Upload size={16} style={{ color: 'var(--muted)' }} />
                  <span>{storeLogo ? 'Cambiar foto' : 'Subir foto'}</span>
                </>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
            </label>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
            Formatos: PNG, JPG, WebP. Se verá en la barra lateral.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre de la tienda</label>
          <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* WhatsApp Cloud API */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">WhatsApp Cloud API (Meta)</h2>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium"
              style={{ background: '#f0fdf4', color: '#065f46' }}>
              <CheckCircle2 size={14} />
              Conectado
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium"
              style={{ background: '#fef2f2', color: '#991b1b' }}>
              <AlertCircle size={14} />
              No configurado
            </div>
          )}
        </div>

        {isConnected && whatsappNumberDisplay && (
          <div className="flex items-center gap-2 text-sm">
            <Smartphone size={16} style={{ color: 'var(--muted)' }} />
            <span>{whatsappNumberDisplay}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Phone Number ID
          </label>
          <input type="text" value={metaPhoneNumberId} onChange={e => setMetaPhoneNumberId(e.target.value)}
            placeholder="123456789012345"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Access Token
          </label>
          <input type="password" value={metaAccessToken} onChange={e => setMetaAccessToken(e.target.value)}
            placeholder="EAA..."
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none font-mono"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Número de teléfono <span className="text-[var(--subtle)]">(opcional)</span>
          </label>
          <input type="text" value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)}
            placeholder="+5491123456789"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleMetaSave} disabled={!metaPhoneNumberId || !metaAccessToken}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}>
            <Save size={16} />
            {saved ? 'Configuración guardada' : 'Guardar configuración'}
          </button>

          {isConnected && (
            <button onClick={handleMetaDisconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <Link2Off size={16} />
              Desconectar
            </button>
          )}
        </div>

        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          No se verifica contra Meta al guardar. La conexión se valida al recibir el primer mensaje.
          También podés configurarlo desde la página{' '}
          <a href="/whatsapp" className="underline">WhatsApp</a>.
        </p>
      </div>

      {/* AI Agent */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Agente de IA</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Proveedor</label>
          <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="groq">Groq</option>
            <option value="google">Google Gemini</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>API Key</label>
          <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Modelo</label>
          <input type="text" value={aiModel} onChange={e => setAiModel(e.target.value)}
            placeholder="gpt-4o"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Ej: gpt-4o, claude-sonnet-4-20250514, deepseek-chat, gemini-2.0-flash
          </p>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--brand)' }}
      >
        <Save size={16} />
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
      </button>
    </div>
  )
}
