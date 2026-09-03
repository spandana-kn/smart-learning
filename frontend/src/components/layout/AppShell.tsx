import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useEffect } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/stores/authStore'
import { useGamificationStore } from '@/stores/gamificationStore'
import GlobalCVMonitor from '@/components/cv/GlobalCVMonitor'

export default function AppShell() {
  const { connect, disconnect } = useWebSocket()
  const user = useAuthStore((s) => s.user)
  const syncFromUser = useGamificationStore((s) => s.syncFromUser)

  useEffect(() => {
    if (user) {
      syncFromUser(user.xp_current, user.xp_to_next, user.level, user.streak_days)
      connect()
    }
    return disconnect
  }, [user?.id])

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar />
      <GlobalCVMonitor />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
