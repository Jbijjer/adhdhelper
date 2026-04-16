import { useState } from 'react'
import { api } from '../hooks/useApi'
import TaskEditModal from './TaskEditModal'

function priorityStyle(priority) {
  if (priority >= 7) return 'border-l-rose-500 bg-rose-50/50'
  if (priority >= 4) return 'border-l-orange-400 bg-orange-50/50'
  return 'border-l-teal-500 bg-teal-50/30'
}

export default function TaskCard({ task, onComplete, onUncomplete, onUpdate, onDelete }) {
  const [completing, setCompleting] = useState(false)
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)

  async function handleComplete() {
    if (completing) return
    setCompleting(true)
    try {
      if (task.status === 'completed') {
        const result = await api.post(`/tasks/${task.id}/uncomplete`)
        setToast(`-${result.pointsRemoved} pts`)
        setTimeout(() => setToast(null), 2000)
        onUncomplete?.(task.id, result)
      } else {
        const result = await api.post(`/tasks/${task.id}/complete`)
        setToast(`+${result.pointsEarned} pts`)
        setTimeout(() => setToast(null), 2000)
        onComplete?.(task.id, result)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className={`relative flex items-start gap-3 bg-white border border-slate-100 border-l-4 ${priorityStyle(task.priority)} rounded-xl p-3 group shadow-sm`}>
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={completing}
        title={task.status === 'completed' ? 'Remettre en cours' : 'Marquer comme terminée'}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          task.status === 'completed'
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 hover:border-blue-500'
        }`}
      >
        {task.status === 'completed' && <span className="text-white text-xs leading-none">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <button
          onClick={() => task.status !== 'completed' && setEditing(true)}
          className={`text-left w-full text-sm font-semibold leading-snug ${
            task.status === 'completed'
              ? 'line-through text-slate-400 cursor-default'
              : 'text-slate-800 hover:text-blue-600 transition-colors'
          }`}
        >
          {task.title}
        </button>
        {task.description && task.status !== 'completed' && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 font-medium">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {task.priority != null && (
            <span className="text-xs text-slate-400 font-semibold">P{task.priority}</span>
          )}
          {task.recurrence === 'recurring' && (
            <span className="text-xs text-slate-400">🔁</span>
          )}
          <span className="text-xs text-amber-500 font-bold">{task.points_value} pts</span>
        </div>
      </div>

      {toast && (
        <span className="toast-rise absolute -top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow pointer-events-none">
          {toast}
        </span>
      )}

      {editing && (
        <TaskEditModal
          task={task}
          onSave={(updated) => { onUpdate?.(updated); setEditing(false) }}
          onDelete={(id) => { onDelete?.(id); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
