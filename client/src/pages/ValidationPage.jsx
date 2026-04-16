import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../hooks/useApi'

function priorityColor(p) {
  if (p >= 8) return 'text-rose-600'
  if (p >= 5) return 'text-amber-500'
  return 'text-slate-500'
}
function priorityLabel(p) {
  if (p >= 8) return 'Haute'
  if (p >= 5) return 'Moyenne'
  return 'Basse'
}

export default function ValidationPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openReasoning, setOpenReasoning] = useState(null)

  useEffect(() => {
    api.get(`/dump/sessions/${sessionId}`)
      .then((s) => setTasks(s.tasks.map((t) => ({ ...t, priority: t.priority ?? 5, _delete: false }))))
      .finally(() => setLoading(false))
  }, [sessionId])

  function update(id, changes) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t))
  }

  async function validate() {
    setSaving(true)
    try {
      await api.post(`/dump/sessions/${sessionId}/validate`, { tasks })
      navigate('/tasks')
    } catch (e) {
      alert(`Erreur : ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton />

  const active = tasks.filter((t) => !t._delete)

  return (
    <div className="p-4 pb-6 max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between pt-2 pb-1">
        <h1 className="text-2xl font-black text-navy-900 tracking-tight">Valider les tâches</h1>
        <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {active.length} tâche{active.length !== 1 ? 's' : ''}
        </span>
      </div>

      {tasks.map((task) => (
        <div
          key={task.id}
          className={`card p-4 space-y-3 transition-all ${
            task._delete ? 'opacity-40 border-rose-200 bg-rose-50' : ''
          }`}
        >
          {/* Title */}
          <input
            className="w-full bg-transparent text-slate-800 font-bold text-base focus:outline-none border-b-2 border-slate-100 focus:border-blue-400 pb-1 transition-colors"
            value={task.title}
            onChange={(e) => update(task.id, { title: e.target.value })}
            disabled={task._delete}
          />

          {/* Description */}
          {task.description && (
            <p className="text-slate-500 text-sm font-medium">{task.description}</p>
          )}

          {/* Reasoning toggle */}
          {task.ai_reasoning && (
            <button
              className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
              onClick={() => setOpenReasoning(openReasoning === task.id ? null : task.id)}
            >
              {openReasoning === task.id ? '▲ Masquer le raisonnement IA' : '▼ Pourquoi ce classement ?'}
            </button>
          )}
          {openReasoning === task.id && (
            <p className="text-slate-500 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium">{task.ai_reasoning}</p>
          )}

          {/* Priority slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priorité</span>
              <span className={`text-sm font-extrabold ${priorityColor(task.priority)}`}>
                {task.priority} — {priorityLabel(task.priority)}
              </span>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              value={task.priority}
              onChange={(e) => update(task.id, { priority: Number(e.target.value) })}
              disabled={task._delete}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-300 mt-0.5 font-medium">
              <span>1 — Basse</span>
              <span>10 — Haute</span>
            </div>
          </div>

          {/* Toggles row */}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600 w-4 h-4"
                checked={task.recurrence === 'recurring'}
                onChange={(e) => update(task.id, { recurrence: e.target.checked ? 'recurring' : 'one_time' })}
                disabled={task._delete}
              />
              <span className="text-slate-600 font-semibold text-sm">Récurrent 🔁</span>
            </label>

            <button
              className="ml-auto text-rose-400 hover:text-rose-600 text-xs font-bold transition-colors"
              onClick={() => update(task.id, { _delete: !task._delete })}
            >
              {task._delete ? '↩ Annuler' : '🗑 Supprimer'}
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={validate}
        disabled={saving}
        className="btn-primary w-full py-4 text-base"
      >
        {saving ? 'Enregistrement…'
          : active.length === 0 ? 'Tout supprimer'
          : `Valider ${active.length} tâche${active.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-9 w-48 bg-slate-200 rounded-xl" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-40 bg-slate-100 rounded-2xl" />
      ))}
    </div>
  )
}
