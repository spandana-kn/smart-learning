import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Loader2 } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'student' as 'student' | 'teacher' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authService.register(form)
      setAuth(res.user, res.access_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4"
      style={{ background: 'radial-gradient(ellipse at 70% 80%, #1A1828 0%, #0F0E17 70%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand shadow-glow mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="font-lore text-3xl text-accent-gold">SMARTFOCUS</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">Create your scholar profile</p>
        </div>

        <div className="card-elevated p-8">
          <h2 className="font-display text-xl font-bold text-white mb-6">Join the Academy</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="stat-label block mb-1.5">Full Name</label>
              <input type="text" value={form.full_name} onChange={set('full_name')}
                placeholder="Your name" className="input-field" required />
            </div>

            <div>
              <label className="stat-label block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="scholar@example.com" className="input-field" required />
            </div>

            <div>
              <label className="stat-label block mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={set('password')}
                placeholder="Min 8 characters" className="input-field" required minLength={8} />
            </div>

            <div>
              <label className="stat-label block mb-1.5">Role</label>
              <select value={form.role} onChange={set('role')}
                className="input-field bg-surface-elevated">
                <option value="student">🎮 Student (Adventurer)</option>
                <option value="teacher">📚 Teacher (Sage)</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-accent-crimson font-mono bg-accent-crimson/10 px-3 py-2 rounded-lg border border-accent-crimson/20">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
              {loading ? 'Creating profile...' : 'Begin Adventure'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 font-mono mt-6">
            Already a scholar?{' '}
            <Link to="/login" className="text-brand hover:text-brand-light transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
