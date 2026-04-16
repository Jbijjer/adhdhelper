import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AudioRecorder from '../components/AudioRecorder'
import { api } from '../hooks/useApi'

const STATUS_MESSAGES = {
  processing:   'En attente…',
  transcribing: 'Transcription en cours…',
  structuring:  'Structuration par l\'IA…',
  ready:        '✓ Prêt !',
  error:        '❌ Une erreur est survenue.',
}

export default function DumpPage() {
  const [mode, setMode] = useState('audio')
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isQuickDump = searchParams.get('quick-dump') === '1'

  useEffect(() => {
    return () => clearInterval(pollRef.current)
  }, [])

  // Demander la permission micro dès le chargement en mode quick-dump
  useEffect(() => {
    if (isQuickDump) {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => {})
    }
  }, [isQuickDump])

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        const session = await api.get(`/dump/sessions/${id}`)
        setSessionStatus(session.status)
        if (session.status === 'ready') {
          clearInterval(pollRef.current)
          navigate(`/validate/${id}`)
        } else if (session.status === 'error') {
          clearInterval(pollRef.current)
        }
      } catch {}
    }, 3_000)
  }

  async function handleBlob(blob) {
    setError(null)
    setUploading(true)
    setSessionStatus('processing')
    try {
      const form = new FormData()
      form.append('audio', blob, 'dump.webm')
      const data = await api.post('/dump/audio', form)
      startPolling(data.sessionId)
    } catch (e) {
      setError(e.message)
      setSessionStatus(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleTextSubmit() {
    if (!text.trim()) return
    setError(null)
    setUploading(true)
    setSessionStatus('processing')
    try {
      const data = await api.post('/dump/text', { text })
      startPolling(data.sessionId)
    } catch (e) {
      setError(e.message)
      setSessionStatus(null)
    } finally {
      setUploading(false)
    }
  }

  const isProcessing = uploading || (sessionStatus && !['ready', 'error'].includes(sessionStatus))

  // ── Mode Quick Dump ──────────────────────────────────────────────────────────
  if (isQuickDump) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] px-5 pt-8 pb-4">
        <div className="text-center space-y-1 mb-6">
          <h1 className="text-3xl font-black text-navy-900 tracking-tight">Brain Dump</h1>
          <p className="text-slate-400 text-sm font-medium">Parle. L'IA s'occupe du reste.</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
          <AudioRecorder onBlob={handleBlob} disabled={isProcessing} autoStart />

          {sessionStatus && (
            <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border font-semibold text-sm ${
              sessionStatus === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-blue-50 border-blue-100 text-blue-700'
            }`}>
              {isProcessing && (
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              <span>{STATUS_MESSAGES[sessionStatus] || sessionStatus}</span>
            </div>
          )}

          {error && (
            <p className="w-full text-rose-600 text-center bg-rose-50 border border-rose-200 rounded-2xl p-4 font-medium text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Mode normal ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] px-5 pt-8 pb-4 gap-5">

      <div className="text-center space-y-1">
        <h1 className="text-4xl font-black text-navy-900 tracking-tight">Brain Dump</h1>
        <p className="text-slate-500 font-medium">Vide ta tête. L'IA s'occupe du reste.</p>
      </div>

      <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1.5">
        {['audio', 'text'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={isProcessing}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === m
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {m === 'audio' ? '🎤 Audio' : '✍️ Texte'}
          </button>
        ))}
      </div>

      <div className={`flex-1 flex flex-col min-h-0 gap-5 ${mode === 'audio' ? 'items-center justify-center' : ''}`}>
        {mode === 'audio' ? (
          <>
            <AudioRecorder onBlob={handleBlob} disabled={isProcessing} />

            {sessionStatus && (
              <div className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border font-semibold text-sm ${
                sessionStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-blue-50 border-blue-100 text-blue-700'
              }`}>
                {isProcessing && (
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <span>{STATUS_MESSAGES[sessionStatus] || sessionStatus}</span>
              </div>
            )}

            {error && (
              <p className="w-full text-rose-600 text-center bg-rose-50 border border-rose-200 rounded-2xl p-4 font-medium text-sm">
                {error}
              </p>
            )}
          </>
        ) : (
          <div className="w-full space-y-3">
            <textarea
              className="w-full h-52 bg-white border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 text-base font-medium placeholder-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
              placeholder="Tape tout ce qui te passe par la tête…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessing}
            />
            <button
              onClick={handleTextSubmit}
              disabled={isProcessing || !text.trim()}
              className="btn-primary w-full py-4 text-base"
            >
              Envoyer
            </button>

            {sessionStatus && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border font-semibold text-sm ${
                sessionStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-blue-50 border-blue-100 text-blue-700'
              }`}>
                {isProcessing && (
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <span>{STATUS_MESSAGES[sessionStatus] || sessionStatus}</span>
              </div>
            )}

            {error && (
              <p className="text-rose-600 text-center bg-rose-50 border border-rose-200 rounded-2xl p-4 font-medium text-sm">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
