import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import PriorityBoard from '../components/PriorityBoard'
import TaskCard from '../components/TaskCard'

export default function TaskBoard() {
  const [tasks, setTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [dailyTask, setDailyTask] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [taskData, completedData, daily] = await Promise.all([
        api.get('/tasks?status=active'),
        api.get('/tasks?status=completed'),
        api.get('/tasks/daily'),
      ])
      setTasks(taskData)
      setCompletedTasks(completedData)
      setDailyTask(daily)
    } finally {
      setLoading(false)
    }
  }

  function handleComplete(taskId) {
    const task = tasks.find((t) => t.id === taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    if (task) setCompletedTasks((prev) => [{ ...task, status: 'completed' }, ...prev])
    if (dailyTask?.id === taskId) setDailyTask(null)
  }

  function handleUpdate(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))
    if (dailyTask?.id === updated.id) setDailyTask(updated)
  }

  function handleDelete(taskId) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    if (dailyTask?.id === taskId) setDailyTask(null)
  }

  function handleUncomplete(taskId) {
    const task = completedTasks.find((t) => t.id === taskId)
    setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId))
    if (task) setTasks((prev) => [{ ...task, status: 'active' }, ...prev])
  }

  if (loading) return <Skeleton />

  return (
    <div>
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <h1 className="text-3xl font-black text-navy-900 tracking-tight">Tâches</h1>
        <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{tasks.length} actives</span>
      </div>

      {dailyTask && (
        <div className="mx-3 mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-base">⭐</span>
            <span className="text-xs font-extrabold text-amber-600 uppercase tracking-widest">Tâche du jour</span>
          </div>
          <TaskCard
            task={dailyTask}
            onComplete={handleComplete}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-slate-700 font-bold text-lg">Toutes les tâches sont terminées !</p>
          <p className="text-slate-400 text-sm mt-1 font-medium">Fais un brain dump pour en ajouter.</p>
        </div>
      ) : (
        <PriorityBoard tasks={tasks} onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
      )}

      {completedTasks.length > 0 && (
        <div className="px-3 pb-6">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors font-semibold"
          >
            <span>Terminées ({completedTasks.length})</span>
            <span>{showCompleted ? '▲' : '▼'}</span>
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {completedTasks.map((t) => (
                <TaskCard key={t.id} task={t} onUncomplete={handleUncomplete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-9 w-32 bg-slate-200 rounded-xl" />
      <div className="space-y-2.5">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-2xl" />)}
      </div>
    </div>
  )
}
