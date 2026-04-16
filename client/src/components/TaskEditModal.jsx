import { useState } from 'react'
import { api } from '../hooks/useApi'

function priorityLabel(p) {
  if (p >= 8) return 'Haute'
  if (p >= 5) return 'Moyenne'
  return 'Basse'
}
function priorityColor(p) {
  if (p >= 8) return 'text-rose-600'
  if (p >= 5) return 'text-amber-500'
  return 'text-slate-500'
}

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium placeholder-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all'
const labelClass = 'block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5'

export default function TaskEditModal({ task, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority ?? 5)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.patch(`/tasks/${task.id}`, { title: title.trim(), description: description.trim(), priority })
      onSave(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.del(`/tasks/${task.id}`)
      onDelete(task.id)
    } catch (e) {
      setError(e.message)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto border border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-slate-900 font-black text-lg">Modifier la tâche</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none transition-colors">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Titre</label>
            <input
              autoFocus
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div>
            <label className={labelClass}>Détails</label>
            <textarea
              className={`${inputClass} h-24 resize-none text-sm`}
              placeholder="Ajoute des précisions…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass.replace('mb-1.5', '')}>Priorité</label>
              <span className={`text-sm font-extrabold ${priorityColor(priority)}`}>
                {priority} — {priorityLabel(priority)}
              </span>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-300 mt-0.5 font-medium">
              <span>1 — Basse</span>
              <span>10 — Haute</span>
            </div>
          </div>
        </div>

        {error && <p className="text-rose-500 text-sm font-semibold">{error}</p>}

        {confirmDelete ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
            <p className="text-rose-700 text-sm font-bold">Supprimer cette tâche définitivement ?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition-colors text-sm"
              >
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-rose-400 hover:text-rose-600 text-sm py-1 font-semibold transition-colors"
            >
              Supprimer la tâche
            </button>
          </>
        )}
      </div>
    </div>
  )
}
