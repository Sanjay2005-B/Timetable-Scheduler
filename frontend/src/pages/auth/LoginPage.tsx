import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Zap, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/store/authStore'
import type { RoleName } from '@/types/common.types'

const LOGIN_TYPES: { role: RoleName; label: string; tagline: string }[] = [
  { role: 'ROLE_COLLEGE_ADMIN', label: 'College Admin', tagline: 'Sign in to manage your college' },
  { role: 'ROLE_HOD', label: 'HOD / Department', tagline: 'Sign in to manage your department' },
  { role: 'ROLE_FACULTY', label: 'Faculty', tagline: 'Sign in to view your teaching schedule' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [form, setForm] = useState({
    usernameOrEmail: '',
    password: '',
  })

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginType, setLoginType] = useState<RoleName>('ROLE_COLLEGE_ADMIN')

  const selectedLoginType =
    LOGIN_TYPES.find((t) => t.role === loginType) ?? LOGIN_TYPES[0]

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setError('')

    const usernameOrEmail = form.usernameOrEmail.trim()
    const password = form.password

    if (!usernameOrEmail || !password) {
      setError('Please enter username/email and password.')
      return
    }

    setLoading(true)

    try {
      const payload: {
        usernameOrEmail: string
        password: string
      } = { usernameOrEmail, password }

      const response = await authApi.login(payload)

      const authData = response.data?.data

      if (!authData) {
        throw new Error('Login response did not contain authentication data.')
      }

      // The selected login type is only a login-context UI hint — the backend
      // remains the authority for the user's real role. When the type does not
      // match the authenticated account, reject the context WITHOUT persisting
      // a session or navigating.
      const expectedRole = LOGIN_TYPES.find((t) => t.role === loginType)?.role
      if (!expectedRole || !authData.roles?.includes(expectedRole)) {
        setError('Selected login type does not match your account role.')
        return
      }

      // Store REAL backend authentication data
      setAuth(authData)

      // Clear the login form
      setForm({
        usernameOrEmail: '',
        password: '',
      })

      // Faculty land on their own timetable; College Admins and HODs on the dashboard
      const destination = authData.roles?.includes('ROLE_FACULTY')
        ? '/my-timetable'
        : '/dashboard'

      navigate(destination, {
        replace: true,
      })
    } catch (err: any) {
      console.error('Login failed:', err)

      const status = err?.response?.status

      if (status === 401) {
        setError('Invalid username/email or password.')
      } else if (status === 403) {
        setError('You do not have permission to sign in.')
      } else if (status === 404) {
        setError('Login service was not found. Check the backend server.')
      } else if (err?.response?.data?.message) {
        setError(err.response.data.message)
      } else if (err?.message) {
        setError(err.message)
      } else {
        setError('Unable to sign in. Please check that the backend is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
      <div className="min-h-screen bg-surface flex">

        {/* LEFT SIDE */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-surface relative overflow-hidden flex-col items-center justify-center p-12">

          <div className="absolute top-0 left-0 w-72 h-72 bg-brand-500/20 rounded-full -translate-x-1/3 -translate-y-1/3 blur-3xl" />

          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

          <div className="relative z-10 max-w-md text-center">

            <div className="w-20 h-20 rounded-3xl bg-gradient-brand mx-auto mb-8 flex items-center justify-center shadow-glow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-4xl font-bold text-white mb-4">
              AI Timetable
              <br />
              Scheduler ERP
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed">
              Intelligently generate conflict-free academic timetables for your
              entire college in seconds.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-10">
              {[
                'CSP Algorithm',
                'No Conflicts',
                'PDF & Excel Export',
                'Dark Mode',
                'Real-time',
              ].map((feature) => (
                  <span
                      key={feature}
                      className="badge badge-brand text-xs py-1 px-3"
                  >
                {feature}
              </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-10">
              {[
                { value: '1000+', label: 'Faculty' },
                { value: '50+', label: 'Departments' },
                { value: '100%', label: 'Conflict-Free' },
              ].map(({ value, label }) => (
                  <div key={label} className="glass-card p-4">
                    <p className="text-2xl font-bold text-gradient">
                      {value}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {label}
                    </p>
                  </div>
              ))}
            </div>

          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex-1 flex items-center justify-center p-6">

          <div className="w-full max-w-md animate-slide-up">

            {/* MOBILE LOGO */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">

              <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
                <Zap className="w-5 h-5 text-white" />
              </div>

              <div>
                <p className="font-bold text-white">
                  Timetable ERP
                </p>

                <p className="text-xs text-gray-500">
                  AI Scheduler
                </p>
              </div>

            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              {selectedLoginType.label} Login
            </h2>

            <p className="text-gray-400 mb-4">
              {selectedLoginType.tagline}
            </p>

            {/* ── Login Type Selector ── */}
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Select Login Type
              </p>

              <div className="grid grid-cols-2 gap-2">
                {LOGIN_TYPES.map(({ role, label }) => (
                    <button
                        key={role}
                        type="button"
                        onClick={() => setLoginType(role)}
                        aria-pressed={loginType === role}
                        className={clsx(
                            'rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
                            loginType === role
                                ? 'bg-brand-500/20 border-brand-500/50 text-white'
                                : 'bg-surface-100 border-white/10 text-gray-400 hover:border-white/25 hover:text-gray-200'
                        )}
                    >
                      {label}
                    </button>
                ))}
              </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">

                  <AlertCircle className="w-4 h-4 flex-shrink-0" />

                  <span>{error}</span>

                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-5"
                id="login-form"
            >

              {/* USERNAME */}
              <div className="form-group">

                <label
                    htmlFor="usernameOrEmail"
                    className="label"
                >
                  Username / Login ID
                </label>

                <input
                    id="usernameOrEmail"
                    type="text"
                    placeholder="Enter your Login ID or email"
                    className="input"
                    value={form.usernameOrEmail}
                    onChange={(e) =>
                        setForm({
                          ...form,
                          usernameOrEmail: e.target.value,
                        })
                    }
                    required
                    autoComplete="username"
                    disabled={loading}
                />

              </div>

              {/* PASSWORD */}
              <div className="form-group">

                <label
                    htmlFor="password"
                    className="label"
                >
                  Password
                </label>

                <div className="relative">

                  <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="input pr-12"
                      value={form.password}
                      onChange={(e) =>
                          setForm({
                            ...form,
                            password: e.target.value,
                          })
                      }
                      required
                      autoComplete="current-password"
                      disabled={loading}
                  />

                  <button
                      type="button"
                      onClick={() => setShowPass((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      aria-label={
                        showPass
                            ? 'Hide password'
                            : 'Show password'
                      }
                      disabled={loading}
                  >
                    {showPass ? (
                        <EyeOff className="w-4 h-4" />
                    ) : (
                        <Eye className="w-4 h-4" />
                    )}
                  </button>

                </div>

                <div className="flex justify-end mt-1.5">

                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-400 hover:text-brand-300"
                  >
                    Forgot password?
                  </Link>

                </div>

              </div>

              {/* SUBMIT */}
              <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={loading}
                  className="btn-primary w-full btn-lg"
              >

                {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                ) : (
                    'Sign In'
                )}

              </button>

            </form>

            {/* NEW COLLEGE REGISTRATION (College Admin section only) */}
            {loginType === 'ROLE_COLLEGE_ADMIN' && (
                <div className="mt-6 text-center border-t border-white/10 pt-5">

                  <p className="text-xs text-gray-500 mb-2">
                    First-time college?
                  </p>

                  <button
                      type="button"
                      onClick={() => navigate('/register-college')}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300"
                  >
                    Create College Admin Account →
                  </button>

                </div>
            )}

          </div>
        </div>
      </div>
  )
}