import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authService.login({ email, password })
      setAuth(res.user, res.access_token)
      navigate(res.user.role === 'teacher' ? '/teacher' : '/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  // Demo quick-login
  const demoLogin = async (role: 'student' | 'teacher') => {
    setEmail(role === 'student' ? 'demo@student.com' : 'demo@teacher.com')
    setPassword('demo1234')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1A1828 0%, #0F0E17 70%)' }}
    >
      {/* Floating particles (decorative) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-brand/30"
            animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
            style={{ left: `${8 + i * 8}%`, top: `${20 + (i % 4) * 20}%` }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand shadow-glow mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="font-lore text-3xl text-accent-gold">SMARTFOCUS</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">Begin your learning quest</p>
        </div>

        {/* Card */}
        <div className="card-elevated p-8">
          <h2 className="font-display text-xl font-bold text-white mb-6">Sign In</h2>

          {/* Demo buttons */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button onClick={() => demoLogin('student')}
              className="btn-secondary text-xs py-2 border-brand/30 hover:border-brand">
              🎮 Demo Student
            </button>
            <button onClick={() => demoLogin('teacher')}
              className="btn-secondary text-xs py-2 border-brand/30 hover:border-brand">
              📚 Demo Teacher
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-xs font-mono text-gray-500">or enter credentials</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="stat-label block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scholar@example.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="stat-label block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-accent-crimson font-mono bg-accent-crimson/10 px-3 py-2 rounded-lg border border-accent-crimson/20"
              >
                {error}
              </motion.p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
              {loading ? 'Entering realm...' : 'Enter the Realm'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 font-mono mt-6">
            New scholar?{' '}
            <Link to="/register" className="text-brand hover:text-brand-light transition-colors">
              Create account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
