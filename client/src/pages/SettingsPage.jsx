import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'

const FIELDS = [
  { key: 'litellm_url',     label: 'URL LiteLLM',                    type: 'text' },
  { key: 'litellm_api_key', label: 'Clé API LiteLLM',                type: 'password' },
  { key: 'litellm_model',   label: 'Modèle IA',                      type: 'model' },
  { key: 'whisper_url',     label: 'URL Faster-Whisper',             type: 'text' },
  { key: 'reminder_hour',   label: 'Heure du rappel quotidien',      type: 'time' },
  { key: 'points_per_task', label: 'Points par tâche (priorité max)', type: 'number' },
]

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium placeholder-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all'
const labelClass = 'block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5'

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [models, setModels] = useState([])
  const [modelsError, setModelsError] = useState(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pingStatus, setPingStatus] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/settings').then(setSettings).finally(() => setLoading(false))
    loadModels()
  }, [])

  async function loadModels(url) {
    setModelsLoading(true)
    setModelsError(null)
    const qs = url ? `?url=${encodeURIComponent(url)}` : ''
    try {
      const data = await api.get(`/settings/models${qs}`)
      setModels(data.data?.map((m) => m.id) || [])
    } catch (e) {
      setModelsError(e.message)
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }

  async function save() {
    await api.patch('/settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadModels(settings.litellm_url)
  }

  async function ping() {
    setPingStatus({ loading: true })
    try {
      await api.get(`/settings/models?url=${encodeURIComponent(settings.litellm_url || '')}`)
      setPingStatus({ litellm: '✅ LiteLLM OK' })
    } catch (e) {
      setPingStatus({ litellm: `❌ LiteLLM: ${e.message}` })
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 pb-8">
      <h1 className="text-3xl font-black text-navy-900 tracking-tight pt-2">Réglages</h1>

      <div className="card p-4 space-y-4">
        {FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            {type === 'model' ? (
              <div>
                <div className="flex gap-2">
                  <select
                    className={`${inputClass} flex-1`}
                    value={settings[key] || ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    disabled={modelsLoading}
                  >
                    {models.length === 0 && (
                      <option value={settings[key] || ''}>{settings[key] || '—'}</option>
                    )}
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button
                    onClick={() => loadModels(settings.litellm_url)}
                    disabled={modelsLoading}
                    className="px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-xl transition-colors text-base font-bold border border-slate-200"
                    title="Recharger la liste des modèles"
                  >
                    {modelsLoading ? '…' : '↻'}
                  </button>
                </div>
                {modelsError && (
                  <p className="text-xs mt-1.5 text-rose-500 font-medium">
                    Impossible de charger les modèles : {modelsError}
                  </p>
                )}
              </div>
            ) : key === 'litellm_url' ? (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    value={settings[key] || ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                  <button
                    onClick={ping}
                    className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors whitespace-nowrap text-sm"
                  >
                    {pingStatus.loading ? '…' : 'Tester'}
                  </button>
                </div>
                {pingStatus.litellm && (
                  <p className="text-sm mt-1.5 font-semibold text-slate-600">{pingStatus.litellm}</p>
                )}
              </div>
            ) : (
              <input
                type={type === 'number' ? 'number' : type}
                className={inputClass}
                value={settings[key] || ''}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            )}
          </div>
        ))}

        <ReminderDaysPicker
          value={settings.reminder_days || '1,2,3,4,5'}
          onChange={(val) => setSettings({ ...settings, reminder_days: val })}
        />
      </div>

      <button
        onClick={save}
        className={`btn-primary w-full py-3.5 text-base ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
      >
        {saved ? '✓ Enregistré !' : 'Enregistrer'}
      </button>

      <PushNotificationSection />
    </div>
  )
}

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
]

function ReminderDaysPicker({ value, onChange }) {
  const selected = (value || '').split(',').map(Number).filter((n) => !isNaN(n))

  function toggle(day) {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day]
    onChange(next.join(','))
  }

  return (
    <div>
      <label className={labelClass}>Jours de rappel</label>
      <div className="flex gap-2 flex-wrap">
        {DAYS.map(({ value: day, label }) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all border ${
              selected.includes(day)
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PushNotificationSection() {
  const [status, setStatus] = useState('idle')
  const [testStatus, setTestStatus] = useState(null)
  const [testLoading, setTestLoading] = useState(null)

  async function subscribe() {
    setStatus('loading')
    try {
      const { publicKey } = await api.get('/push/vapid-key')
      if (!publicKey) throw new Error('Clé VAPID non configurée sur le serveur')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
      setStatus('subscribed')
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
  }

  async function sendTest(mode) {
    setTestLoading(mode)
    setTestStatus(null)
    try {
      const result = await api.post('/push/test', { mode })
      setTestStatus(`✓ Envoyé à ${result.sent} appareil${result.sent > 1 ? 's' : ''}`)
    } catch (e) {
      setTestStatus(`❌ ${e.message}`)
    } finally {
      setTestLoading(null)
      setTimeout(() => setTestStatus(null), 5000)
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-extrabold text-slate-800 text-base">Notifications push</h2>
      <p className="text-sm text-slate-500 font-medium">
        Recevez des rappels même quand l'app est fermée.
      </p>
      <button
        onClick={subscribe}
        disabled={status === 'subscribed' || status === 'loading'}
        className="btn-primary w-full py-3"
      >
        {status === 'subscribed' ? '✓ Notifications activées'
          : status === 'loading' ? 'Activation...'
          : status === 'error' ? '❌ Erreur — réessayer'
          : 'Activer les notifications'}
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => sendTest('static')}
          disabled={testLoading !== null}
          className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-sm border border-slate-200"
        >
          {testLoading === 'static' ? 'Envoi…' : 'Tester la notif'}
        </button>
        <button
          onClick={() => sendTest('ai')}
          disabled={testLoading !== null}
          className="flex-1 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 font-bold py-2.5 rounded-xl transition-colors text-sm border border-blue-200"
        >
          {testLoading === 'ai' ? 'Génération…' : '✨ Tester avec IA'}
        </button>
      </div>
      {testStatus && (
        <p className="text-sm text-slate-500 font-medium">{testStatus}</p>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function PageSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-9 w-28 bg-slate-200 rounded-xl" />
      <div className="card p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-32 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
