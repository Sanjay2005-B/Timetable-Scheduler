import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, Loader2, AlertCircle } from 'lucide-react'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const navigate      = useNavigate()
  const { setAuth }   = useAuthStore()

  const [form, setForm]     = useState({ usernameOrEmail: '', password: '' })
  const [showPass, setShow] = useState(false)
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoad(true)
    try {
      const res = await authApi.login(form)
      if (res.data.data) {
        setAuth(res.data.data)
        navigate('/dashboard', { replace: true })
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ??
        'Invalid credentials. Please try again.'
      )
    } finally {
      setLoad(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Left — Branding Panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-surface relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-brand-500/20 rounded-full -translate-x-1/3 -translate-y-1/3 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

        <div className="relative z-10 max-w-md text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-brand mx-auto mb-8 flex items-center justify-center shadow-glow-lg">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            AI Timetable<br />Scheduler ERP
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Intelligently generate conflict-free academic timetables for your
            entire college in seconds.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['CSP Algorithm', 'No Conflicts', 'PDF & Excel Export', 'Dark Mode', 'Real-time'].map((f) => (
              <span key={f} className="badge badge-brand text-xs py-1 px-3">{f}</span>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-10">
            {[
              { v: '1000+', l: 'Faculty' },
              { v: '50+',   l: 'Departments' },
              { v: '100%',  l: 'Conflict-Free' },
            ].map(({ v, l }) => (
              <div key={l} className="glass-card p-4">
                <p className="text-2xl font-bold text-gradient">{v}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right — Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">Timetable ERP</p>
              <p className="text-xs text-gray-500">AI Scheduler</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-8">Sign in to your account to continue</p>

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* Username / Email */}
            <div className="form-group">
              <label htmlFor="usernameOrEmail" className="label">
                Username or Email
              </label>
              <input
                id="usernameOrEmail"
                type="text"
                placeholder="admin or admin@college.edu"
                className="input"
                value={form.usernameOrEmail}
                onChange={(e) => setForm({ ...form, usernameOrEmail: e.target.value })}
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="input pr-12"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <a href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="btn-primary w-full btn-lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-8 p-4 rounded-xl bg-surface-100 border border-white/5 text-xs text-gray-500">
            <p className="font-semibold text-gray-400 mb-1">Default Credentials</p>
            <p>Username: <code className="text-brand-300">admin</code></p>
            <p>Password: <code className="text-brand-300">Admin@1234</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
