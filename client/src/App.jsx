import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import DumpPage from './pages/DumpPage'
import ValidationPage from './pages/ValidationPage'
import TaskBoard from './pages/TaskBoard'
import PointsPage from './pages/PointsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-slate-50">
        <main className="flex-1 overflow-y-auto pb-16">
          <Routes>
            <Route path="/"                      element={<DumpPage />} />
            <Route path="/validate/:sessionId"   element={<ValidationPage />} />
            <Route path="/tasks"                 element={<TaskBoard />} />
            <Route path="/points"                element={<PointsPage />} />
            <Route path="/settings"              element={<SettingsPage />} />
          </Routes>
        </main>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
