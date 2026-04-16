import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../hooks/useApi'

const STATUS_LABELS = {
  processing: { label: 'En cours…',    color: 'text-slate-400' },
  transcribing: { label: 'Transcription…', color: 'text-amber-400' },
  structuring:  { label: 'Structuration…', color: 'text-amber-400' },
  ready:        { label: 'À valider',   color: 'text-indigo-400 font-semibold' },
  validated:    { label: 'Validé',      color: 'text-green-400' },
  error:        { label: 'Erreur',      color: 'text-red-400' },
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dump/sessions')
      .then((d) => setSessions(d.sessions))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold text-slate-100">Sessions</h1>

      {sessions.length === 0 && (
        <p className="text-center text-slate-500 py-12">
          Aucune session pour l'instant.<br />
          Faites un brain dump !
        </p>
      )}

      {sessions.map((s) => {
        const { label, color } = STATUS_LABELS[s.status] || { label: s.status, color: 'text-slate-400' }
        const date = new Date(s.created_at).toLocaleString('fr-CA', {
          dateStyle: 'medium', timeStyle: 'short',
        })
        return (
          <button
            key={s.id}
            onClick={() => s.status === 'ready' ? navigate(`/validate/${s.id}`) : null}
            className={`w-full text-left bg-slate-800 rounded-xl p-4 space-y-1 border transition-colors ${
              s.status === 'ready'
                ? 'border-indigo-500 hover:border-indigo-400 cursor-pointer'
                : 'border-transparent cursor-default'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-slate-200 text-sm font-medium">{date}</span>
              <span className={`text-xs ${color}`}>{label}</span>
            </div>
            <p className="text-slate-400 text-xs">
              {s.task_count} tâche{s.task_count !== 1 ? 's' : ''}
            </p>
            {s.raw_text && (
              <p className="text-slate-500 text-xs line-clamp-2">{s.raw_text}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-8 w-32 bg-slate-800 rounded" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-slate-800 rounded-xl" />
      ))}
    </div>
  )
}
