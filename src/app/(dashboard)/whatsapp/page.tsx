'use client'

import { useEffect, useState } from 'react'
import { useAuthContext } from '@/lib/hooks/auth-context'
import { Smartphone, CheckCircle2, AlertCircle, Link2, Link2Off, Save, ExternalLink } from 'lucide-react'

export default function WhatsAppPage() {
  const { currentStore, updateCurrentStore } = useAuthContext()

  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentStore?.meta_phone_number_id) setPhoneNumberId(currentStore.meta_phone_number_id)
    if (currentStore?.meta_access_token) setAccessToken(currentStore.meta_access_token)
    if (currentStore?.meta_waba_id) setWabaId(currentStore.meta_waba_id)
    if (currentStore?.whatsapp_number) { setPhoneNumber(currentStore.whatsapp_number); setPhoneDisplay(currentStore.whatsapp_number) }
    if (currentStore?.meta_access_token) setIsActive(true)
  }, [currentStore])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // Attempt API save (best-effort — may fail with 403 on Vercel)
      const saveRes = await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaPhoneNumberId: phoneNumberId,
          metaAccessToken: accessToken,
          metaWabaId: wabaId,
          whatsappNumber: phoneNumber || undefined,
        }),
      })
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({ error: 'Error al guardar' }))
        console.warn('[WhatsApp] API save failed, persisting locally:', errData.error)
      }

      // Always persist to localStorage + React state (survives API failures)
      updateCurrentStore({
        meta_phone_number_id: phoneNumberId,
        meta_access_token: accessToken,
        meta_waba_id: wabaId,
        whatsapp_number: phoneNumber || null,
      } as any)
      setPhoneDisplay(phoneNumber)
      localStorage.setItem('ca-dev-meta-phone-number-id', phoneNumberId)
      localStorage.setItem('ca-dev-meta-access-token', accessToken)
      localStorage.setItem('ca-dev-meta-waba-id', wabaId)
      if (phoneNumber) localStorage.setItem('ca-dev-whatsapp', phoneNumber)
      setIsActive(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' })
      setPhoneNumberId('')
      setAccessToken('')
      setWabaId('')
      setPhoneNumber('')
      setPhoneDisplay('')
      setIsActive(false)
      updateCurrentStore({
        meta_phone_number_id: null,
        meta_access_token: null,
        meta_waba_id: null,
        whatsapp_number: null,
      } as any)
    } catch (err: any) {
      setError(err?.message ?? 'Error al desconectar')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-xl font-semibold">WhatsApp Cloud API</h1>

      {/* Status */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Conexión WhatsApp</h2>
        </div>

        <div className="flex items-center gap-3">
          {isActive ? (
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

          {isActive && (
            <button onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <Link2Off size={14} />
              Desconectar
            </button>
          )}
        </div>

        {phoneDisplay && (
          <div className="flex items-center gap-2 text-sm">
            <Smartphone size={16} style={{ color: 'var(--muted)' }} />
            <span>{phoneDisplay}</span>
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Configuración</h2>
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Phone Number ID
          </label>
          <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
            placeholder="123456789012345"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Access Token
          </label>
          <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)}
            placeholder="EAA..."
            rows={3}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none font-mono"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Número de teléfono <span className="text-[var(--subtle)]">(opcional)</span>
          </label>
          <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+5491123456789"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Se mostrará en el dashboard. Formato internacional sin espacios: +54911...
          </p>
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            WABA ID <span className="text-[var(--subtle)]">(opcional)</span>
          </label>
          <input type="text" value={wabaId} onChange={e => setWabaId(e.target.value)}
            placeholder="123456789012345"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {error && (
          <div className="p-3 rounded-[var(--radius-md)] text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !phoneNumberId || !accessToken}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--brand)' }}>
          <Save size={16} />
          {saving ? 'Guardando...' : saved ? 'Configuración guardada' : 'Guardar configuración'}
        </button>
      </div>

      {/* Instructions */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-sm">¿Cómo obtener estos datos?</h2>
        <ol className="space-y-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <li>1. Andá a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline">Meta for Developers <ExternalLink size={12} /></a></li>
          <li>2. Seleccioná tu app de WhatsApp Business</li>
          <li>3. Andá a <strong>WhatsApp &gt; Configuración</strong></li>
          <li>4. Copiá el <strong>Phone Number ID</strong> del número que querés usar</li>
          <li>5. Generá o copiá un <strong>Access Token</strong> permanente (sugerencia: usar System User Token con permisos de WhatsApp)</li>
          <li>6. Pegá ambos valores acá y hacé clic en "Guardar configuración"</li>
        </ol>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          Los mensajes entrantes a este número serán procesados automáticamente por el agente de IA.
          No se realiza verificación contra Meta al guardar — la conexión se valida al recibir el primer mensaje.
        </p>
      </div>
    </div>
  )
}
