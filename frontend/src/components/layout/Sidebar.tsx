import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Swords,
  GitBranch,
  Eye,
  Skull,
  Users,
  LogOut,
  Zap,
  BarChart2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useGamificationStore } from '@/stores/gamificationStore'
import clsx from 'clsx'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', roles: ['student'] },
  { to: '/quests',    icon: <Swords size={18} />,          label: 'Quest Board', roles: ['student'] },
  { to: '/skills',   icon: <GitBranch size={18} />,        label: 'Skill Tree', roles: ['student'] },
  { to: '/oracle',     icon: <Eye       size={18} />, label: 'Focus Oracle', roles: ['student'] },
  { to: '/analytics', icon: <BarChart2 size={18} />, label: 'Analytics', roles: ['student'] },
  { to: '/boss',       icon: <Skull     size={18} />, label: 'Boss Battle', roles: ['student'] },
  { to: '/teacher',  icon: <Users size={18} />,            label: 'Class View', roles: ['teacher'] },
]

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { level, xp, xpToNext } = useGamificationStore()
  const navigate = useNavigate()

  const xpPct = Math.min(100, (xp / xpToNext) * 100)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 flex flex-col bg-surface-card border-r border-surface-border shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="font-lore text-sm text-accent-gold leading-none">SMART</p>
            <p className="font-display text-base font-bold text-white leading-none">FOCUS</p>
          </div>
        </div>
      </div>

      {/* Avatar + level */}
      <div className="px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center font-display font-bold text-white text-sm shadow-glow">
            {user?.full_name?.charAt(0).toUpperCase() ?? 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-white truncate">
              {user?.full_name ?? 'Adventurer'}
            </p>
            <p className="text-xs text-brand font-mono">
              {user?.role === 'teacher' ? 'Teacher Console' : `LVL ${level} Scholar`}
            </p>
          </div>
        </div>

        {user?.role !== 'teacher' && <div className="mt-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-400 font-mono">XP</span>
            <span className="text-xs text-accent-gold font-mono">{xp} / {xpToNext}</span>
          </div>
          <div className="progress-bar-track h-1.5">
            <motion.div
              className="h-full bg-gradient-brand rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.filter((item) =>
          !item.roles || item.roles.includes(user?.role ?? '')
        ).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand/20 text-brand border border-brand/30 shadow-glow'
                  : 'text-gray-400 hover:text-white hover:bg-surface-elevated'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-surface-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-display font-medium text-gray-400 hover:text-accent-crimson hover:bg-surface-elevated transition-all duration-200 w-full"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  )
}
