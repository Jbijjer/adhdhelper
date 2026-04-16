import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'

const tabs = [
  { to: '/',         label: 'Dump',     icon: '🎤', badge: true },
  { to: '/tasks',    label: 'Tâches',   icon: '📋' },
  { to: '/points',   label: 'Points',   icon: '⭐' },
  { to: '/settings', label: 'Réglages', icon: '⚙️' },
]

export default function NavBar() {
  const [readyCount, setReadyCount] = useState(0)

  useEffect(() => {
    async function checkReady() {
      try {
        const data = await api.get('/dump/sessions?status=ready&limit=1')
        setReadyCount(data.total || 0)
      } catch {}
    }
    checkReady()
    const id = setInterval(checkReady, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 transition-colors relative ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-blue-600" />
              )}
              <span className="text-xl leading-none relative">
                {tab.icon}
                {tab.badge && readyCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {readyCount}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
