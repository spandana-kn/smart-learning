import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/student/DashboardPage'
import QuestBoardPage from '@/pages/student/QuestBoardPage'
import SkillTreePage from '@/pages/student/SkillTreePage'
import EmotionOraclePage from '@/pages/student/EmotionOraclePage'
import BossBattlePage from '@/pages/student/BossBattlePage'
import TeacherDashboardPage from '@/pages/teacher/TeacherDashboardPage'
import LevelUpModal from '@/components/gamification/LevelUpModal'
import BadgeToast from '@/components/gamification/BadgeToast'
import AdaptationToast from '@/components/ui/AdaptationToast'
import FocusAnalyticsPage from '@/pages/student/FocusAnalyticsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== role) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user?.role === 'teacher' ? '/teacher' : '/dashboard'} replace />
}

function StudentOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Global overlays */}
      <LevelUpModal />
      <BadgeToast />
      <AdaptationToast />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Student routes */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<StudentOnly><DashboardPage /></StudentOnly>} />
          <Route path="/quests" element={<StudentOnly><QuestBoardPage /></StudentOnly>} />
          <Route path="/skills" element={<StudentOnly><SkillTreePage /></StudentOnly>} />
          <Route path="/oracle"     element={<StudentOnly><EmotionOraclePage /></StudentOnly>} />
          <Route path="/analytics"  element={<StudentOnly><FocusAnalyticsPage /></StudentOnly>} />
          <Route path="/boss" element={<StudentOnly><BossBattlePage /></StudentOnly>} />

          {/* Teacher routes */}
          <Route
            path="/teacher"
            element={
              <RequireRole role="teacher">
                <TeacherDashboardPage />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
