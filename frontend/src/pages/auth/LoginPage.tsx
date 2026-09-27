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
      <div className="min-h-screen bg-canvas p-4 lg:p-6 flex gap-4 lg:gap-6">

        {/* LEFT SIDE — near-black ink cover panel, ruled, on the cream canvas.
            The ink fill (not bg-nav) is deliberate: the whole panel is set in
            light type, so it must stay dark in this palette. */}
        <div className="hidden lg:flex flex-1 bg-ink border border-line relative overflow-hidden flex-col items-center justify-center p-12 rounded-sm">

          {/* No decorative bloom: this design language is ruled and flat. */}

          <div className="relative z-10 max-w-md text-center">

            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-sm bg-accent-500 border border-header flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white leading-tight">
                  Timetable Scheduler
                </p>
                <p className="text-[10px] text-white/40 tracking-wide">
                  College Schedule ERP
                </p>
              </div>
            </div>

            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight leading-[1.1]">
              Timetable
              <br />
              Scheduler
            </h1>

            <p className="text-white/60 text-base leading-relaxed">
              Intelligently generate conflict-free academic timetables for your
              entire college in seconds.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-9">
              {[
                'CSP Algorithm',
                'No Conflicts',
                'PDF & Excel Export',
                'Real-time',
              ].map((feature) => (
                  <span
                      key={feature}
                      className="text-[11px] font-medium text-white/70 bg-white/[0.05] border border-white/20 rounded-sm px-3 py-1"
                  >
                {feature}
                  </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-9">
              {[
                { value: '1000+', label: 'Faculty' },
                { value: '50+', label: 'Departments' },
                { value: '100%', label: 'Conflict-Free' },
              ].map(({ value, label }) => (
                  <div
                      key={label}
                      className="bg-white/[0.05] border border-white/20 rounded-sm px-3 py-4"
                  >
                    <p className="text-2xl font-extrabold text-white tabular-nums">
                      {value}
                    </p>

                    <p className="label-caps text-white/40 mt-1">
                      {label}
                    </p>
                  </div>
              ))}
            </div>

          </div>
        </div>

        {/* RIGHT SIDE — near-white form card, ruled, on the cream canvas */}
        <div className="flex-1 max-w-[480px] bg-surface border border-line rounded-sm flex items-center overflow-y-auto">

          <div className="w-full px-8 py-10 animate-slide-up">


            {/* MOBILE LOGO */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">

              <div className="w-9 h-9 rounded-sm bg-accent-500 border border-line flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>

              <div>
                <p className="font-bold text-slate-900">
                  Timetable Scheduler
                </p>

                <p className="text-xs text-slate-500">
                  College Schedule ERP
                </p>
              </div>

            </div>

            <h2 className="page-title text-3xl mb-2">
              {selectedLoginType.label} Login
            </h2>

            <p className="text-slate-600 mb-6 text-sm">
              {selectedLoginType.tagline}
            </p>

            {/* ── Login Type Selector ── */}
            <div className="mb-5">
              <p className="label-caps mb-2">
                Select Login Type
              </p>

              <div className="grid grid-cols-2 gap-2">
                {LOGIN_TYPES.map(({ role, label }, i) => (
                    <button
                        key={role}
                        type="button"
                        onClick={() => setLoginType(role)}
                        aria-pressed={loginType === role}
                        /* The third option spans the full row so the 2-column
                           grid does not leave a lopsided gap. */
                        className={clsx(
                            'rounded-sm border px-3 py-2.5 text-xs font-semibold transition-all',
                            i === 2 && 'col-span-2',
                            loginType === role
                                ? 'bg-accent-50 border-accent-300 text-accent-700'
                                : 'bg-white border-line text-slate-600 hover:border-slate-300 hover:text-slate-700'
                        )}
                    >
                      {label}
                    </button>
                ))}
              </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="flex items-center gap-3 p-3.5 rounded-sm bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">

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
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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

                <div className="flex justify-end mt-2">

                  <Link
                    to="/forgot-password"
                    className="text-xs text-slate-500 hover:text-slate-900 hover:underline transition-colors"
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
                <div className="mt-6 text-center border-t border-line pt-5">

                  <p className="text-xs text-slate-500 mb-2">
                    First-time college?
                  </p>

                  <button
                      type="button"
                      onClick={() => navigate('/register-college')}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline transition-colors"
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