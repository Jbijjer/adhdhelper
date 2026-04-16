import { useState } from 'react'
import TaskCard from './TaskCard'

const GROUPS = [
  {
    label: 'Haute priorité',
    min: 7, max: 10,
    dot:    'bg-rose-500',
    text:   'text-rose-600',
    badge:  'bg-rose-100 text-rose-600',
    border: 'border-rose-200',
    header: 'bg-rose-50',
  },
  {
    label: 'Priorité moyenne',
    min: 4, max: 6,
    dot:    'bg-orange-400',
    text:   'text-orange-600',
    badge:  'bg-orange-100 text-orange-600',
    border: 'border-orange-200',
    header: 'bg-orange-50',
  },
  {
    label: 'Basse priorité',
    min: 1, max: 3,
    dot:    'bg-teal-500',
    text:   'text-teal-600',
    badge:  'bg-teal-100 text-teal-600',
    border: 'border-teal-200',
    header: 'bg-teal-50',
  },
]

export default function PriorityBoard({ tasks, onComplete, onUpdate, onDelete }) {
  const [open, setOpen] = useState({})

  function toggle(label) {
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {GROUPS.map((g) => {
        const group = tasks.filter((t) => t.priority >= g.min && t.priority <= g.max)
        const isOpen = !!open[g.label]

        return (
          <div key={g.label} className={`rounded-2xl border ${g.border} overflow-hidden bg-white shadow-sm`}>
            <button
              onClick={() => toggle(g.label)}
              className={`w-full px-4 py-3 flex items-center gap-2.5 ${g.header} hover:brightness-[0.97] transition-all`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${g.dot}`} />
              <p className={`text-sm font-bold ${g.text}`}>{g.label}</p>
              <span className="text-xs text-slate-400 font-medium ml-1">({g.min}–{g.max})</span>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${g.badge}`}>{group.length}</span>
              <span className="text-slate-400 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="p-2 space-y-2 border-t border-slate-100">
                {group.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-3 font-medium">Aucune tâche</p>
                ) : (
                  group.map((t) => (
                    <TaskCard key={t.id} task={t} onComplete={onComplete} onUpdate={onUpdate} onDelete={onDelete} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
