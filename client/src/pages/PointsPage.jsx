import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'

export default function PointsPage() {
  const [monthly, setMonthly] = useState({ months: [], best: 0 })
  const [loading, setLoading] = useState(true)
  const [openMonth, setOpenMonth] = useState(null)
  const [monthTasks, setMonthTasks] = useState({})
  const [loadingMonth, setLoadingMonth] = useState(null)
  const [uncompleting, setUncompleting] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    api.get('/points/monthly')
      .then(setMonthly)
      .finally(() => setLoading(false))
  }, [])

  async function toggleMonth(month) {
    if (openMonth === month) {
      setOpenMonth(null)
      setConfirmId(null)
      return
    }
    setOpenMonth(month)
    setConfirmId(null)
    if (monthTasks[month]) return
    setLoadingMonth(month)
    try {
      const data = await api.get(`/points/monthly/${month}/tasks`)
      setMonthTasks((prev) => ({ ...prev, [month]: data.tasks }))
    } finally {
      setLoadingMonth(null)
    }
  }

  async function handleUncomplete(month, taskId) {
    setUncompleting(taskId)
    try {
      await api.post(`/tasks/${taskId}/uncomplete`)
      setMonthTasks((prev) => ({
        ...prev,
        [month]: prev[month].filter((t) => t.id !== taskId),
      }))
      const updated = await api.get('/points/monthly')
      setMonthly(updated)
    } catch (e) {
      alert(`Erreur : ${e.message}`)
    } finally {
      setUncompleting(null)
      setConfirmId(null)
    }
  }

  if (loading) return <Skeleton />

  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-3xl font-black text-navy-900 tracking-tight pt-1">Points</h1>

      <div className="card p-4 space-y-1">
        <h2 className="text-slate-500 font-extrabold text-xs uppercase tracking-widest mb-4">Performance mensuelle</h2>

        {monthly.months.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8 font-medium">
            Complète des tâches pour voir tes statistiques mensuelles !
          </p>
        ) : (
          <div className="space-y-1">
            {monthly.months.map((m) => {
              const isCurrent = m.month === currentMonth
              const isOpen = openMonth === m.month
              const tasks = monthTasks[m.month] || []
              const isLoadingThis = loadingMonth === m.month

              return (
                <div key={m.month}>
                  <button
                    onClick={() => toggleMonth(m.month)}
                    className="w-full space-y-2 py-2.5 text-left group"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-bold transition-colors group-hover:text-slate-700 ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>
                        {m.label}{isCurrent ? ' · ce mois' : ''}
                      </span>
                      <span className={`font-extrabold ${isCurrent ? 'text-amber-500' : 'text-slate-400'}`}>
                        {m.total} pts
                        <span className="ml-2 text-slate-300 font-normal">{isOpen ? '▲' : '▼'}</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isCurrent
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${m.percent}%` }}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mb-3 ml-1 space-y-1.5">
                      {isLoadingThis ? (
                        <p className="text-slate-400 text-xs py-2 animate-pulse font-medium">Chargement…</p>
                      ) : tasks.length === 0 ? (
                        <p className="text-slate-400 text-xs py-2 font-medium">Aucune tâche dans ce mois.</p>
                      ) : (
                        tasks.map((t) => (
                          <div key={t.id} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                            {confirmId === t.id ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 text-xs font-medium">Remettre en cours ?</span>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => setConfirmId(null)}
                                    className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded font-semibold"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={() => handleUncomplete(m.month, t.id)}
                                    disabled={uncompleting === t.id}
                                    className="text-blue-600 hover:text-blue-700 text-xs font-bold px-2 py-1 rounded disabled:opacity-50"
                                  >
                                    {uncompleting === t.id ? '…' : 'Confirmer'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => setConfirmId(t.id)}
                                  className="text-slate-600 hover:text-blue-600 text-xs truncate mr-2 text-left transition-colors font-semibold"
                                  title="Cliquer pour remettre en cours"
                                >
                                  {t.title}
                                </button>
                                <span className="text-emerald-600 text-xs font-extrabold flex-shrink-0">
                                  +{t.points_value} pts
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {monthly.best > 0 && (
          <p className="text-xs text-slate-400 text-right pt-2 font-medium">Meilleur mois : {monthly.best} pts</p>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-9 w-28 bg-slate-200 rounded-xl" />
      <div className="h-48 bg-slate-100 rounded-2xl" />
    </div>
  )
}
