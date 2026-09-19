import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import { authApi } from '@/api/authApi'

export default function RegisterCollegePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    collegeId: '',
    password: '',
    confirmPassword: '',
  })

  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [registered, setRegistered] = useState(false)
  const [registeredName, setRegisteredName] = useState('')
  const [registeredUsername, setRegisteredUsername] = useState('')

  useEffect(() => {
    if (registered) {
      const timer = setTimeout(() => navigate('/login'), 4000)
      return () => clearTimeout(timer)
    }
  }, [registered, navigate])

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const name = form.name.trim()
    const code = form.code.trim()
    const email = form.email.trim()
    const collegeId = form.collegeId.trim()

    if (!name) errors.name = 'College name is required.'
    if (!code) errors.code = 'College code is required.'
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(code)) {
      errors.code = 'College code can contain only letters, numbers, hyphen or underscore.'
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid college email address.'
    }
    if (!collegeId) {
      errors.collegeId = 'College Admin Login ID is required.'
    } else if (collegeId.length < 3 || collegeId.length > 50) {
      errors.collegeId = 'Login ID must be 3-50 characters.'
    } else if (!/^[A-Za-z0-9._-]+$/.test(collegeId)) {
      errors.collegeId = 'Login ID can contain only letters, numbers, dot, hyphen or underscore.'
    }
    if (!form.password) {
      errors.password = 'Password is required.'
    } else if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.'
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = 'Please confirm the password.'
    } else if (form.password && form.confirmPassword !== form.password) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setLoading(true)

    try {
      const response = await authApi.registerCollege({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        collegeId: form.collegeId.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      })

      const college = response.data?.data

      setRegisteredName(college?.name ?? form.name.trim())
      setRegisteredUsername(college?.adminUsername ?? form.collegeId.trim())
      setRegistered(true)
      setForm({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        collegeId: '',
        password: '',
        confirmPassword: '',
      })
    } catch (err: any) {
      console.error('College registration failed:', err)
      const status = err?.response?.status

      if (status === 422 || status === 400) {
        const serverErrors = err?.response?.data?.errors
        if (serverErrors && Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors as Record<string, string>)
        } else if (err?.response?.data?.message) {
          setError(err.response.data.message)
        }
      } else if (status === 409) {
        setError(err?.response?.data?.message ?? 'A college with these details already exists.')
      } else if (err?.response?.data?.message) {
        setError(err.response.data.message)
      } else if (err?.message) {
        setError(err.message)
      } else {
        setError('Unable to register. Please check that the backend is running.')
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
              Register your college and create its first College Admin account.
              No existing account is needed.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-10">
              {[
                'Self Registration',
                'Secure Login',
                'Per-College Data',
                'Dark Mode',
              ].map((feature) => (
                  <span
                      key={feature}
                      className="badge badge-brand text-xs py-1 px-3"
                  >
                {feature}
              </span>
              ))}
            </div>

          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex-1 flex items-center justify-center p-6 py-12">

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
              Create College Admin Account
            </h2>

            <p className="text-gray-400 mb-6">
              Register your college. The first College Admin account is created
              automatically.
            </p>

            {/* SUCCESS */}
            {registered && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm mb-5 animate-slide-up">

                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-success" />

                  <div>
                    <p className="font-semibold text-white">
                      College registered successfully!
                    </p>

                    <p className="text-gray-400 mt-1 text-xs">
                      {registeredName} has been created. Sign in with Login ID{' '}
                      <span className="font-mono text-white">{registeredUsername}</span>{' '}
                      and your chosen password. Redirecting to login...
                    </p>
                  </div>

                </div>
            )}

            {/* ERROR */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">

                  <AlertCircle className="w-4 h-4 flex-shrink-0" />

                  <span>{error}</span>

                </div>
            )}

            {/* BACK TO LOGIN */}
            <div className="mb-6 -mt-2">
              <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs text-brand-400 hover:text-brand-300"
              >
                ← Back to College Admin Login
              </button>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-5"
                id="register-college-form"
            >

              {/* COLLEGE INFORMATION */}
              <section className="rounded-xl bg-surface-100 border border-white/10 p-4 space-y-4">

                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  College Information
                </p>

                {/* NAME */}
                <div className="form-group">

                  <label htmlFor="name" className="label">
                    College Name <span className="text-danger">*</span>
                  </label>

                  <input
                      id="name"
                      type="text"
                      placeholder="e.g. ABC Institute of Technology"
                      className={clsx('input', fieldErrors.name && 'border-danger/50')}
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      required
                      disabled={loading || registered}
                  />

                  {fieldErrors.name && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.name}</p>
                  )}

                </div>

                {/* CODE */}
                <div className="form-group">

                  <label htmlFor="code" className="label">
                    College Code <span className="text-danger">*</span>
                  </label>

                  <input
                      id="code"
                      type="text"
                      placeholder="e.g. ABC"
                      className={clsx('input uppercase', fieldErrors.code && 'border-danger/50')}
                      value={form.code}
                      onChange={(e) => update('code', e.target.value.toUpperCase())}
                      required
                      disabled={loading || registered}
                  />

                  {fieldErrors.code && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.code}</p>
                  )}

                </div>

                {/* EMAIL */}
                <div className="form-group">

                  <label htmlFor="email" className="label">
                    College Email
                  </label>

                  <input
                      id="email"
                      type="email"
                      placeholder="e.g. info@college.edu"
                      className={clsx('input', fieldErrors.email && 'border-danger/50')}
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      disabled={loading || registered}
                  />

                  {fieldErrors.email && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.email}</p>
                  )}

                </div>

                {/* PHONE */}
                <div className="form-group">

                  <label htmlFor="phone" className="label">
                    Phone Number
                  </label>

                  <input
                      id="phone"
                      type="tel"
                      placeholder="e.g. +91 90000 00000"
                      className="input"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      disabled={loading || registered}
                  />

                </div>

                {/* ADDRESS */}
                <div className="form-group">

                  <label htmlFor="address" className="label">
                    Address
                  </label>

                  <textarea
                      id="address"
                      rows={2}
                      placeholder="e.g. Main Road, City, State"
                      className={clsx('input resize-none')}
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      disabled={loading || registered}
                  />

                </div>

              </section>

              {/* ADMIN LOGIN INFORMATION */}
              <section className="rounded-xl bg-surface-100 border border-white/10 p-4 space-y-4">

                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  College Admin Login Information
                </p>

                {/* LOGIN ID */}
                <div className="form-group">

                  <label htmlFor="collegeId" className="label">
                    Admin Login ID / Username <span className="text-danger">*</span>
                  </label>

                  <input
                      id="collegeId"
                      type="text"
                      placeholder="e.g. abc_admin"
                      className={clsx('input', fieldErrors.collegeId && 'border-danger/50')}
                      value={form.collegeId}
                      onChange={(e) => update('collegeId', e.target.value)}
                      required
                      autoComplete="username"
                      disabled={loading || registered}
                  />

                  {fieldErrors.collegeId && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.collegeId}</p>
                  )}

                </div>

                {/* PASSWORD */}
                <div className="form-group">

                  <label htmlFor="password" className="label">
                    Password <span className="text-danger">*</span>
                  </label>

                  <div className="relative">

                    <input
                        id="password"
                        type={showPass ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        className={clsx('input pr-12', fieldErrors.password && 'border-danger/50')}
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        required
                        autoComplete="new-password"
                        disabled={loading || registered}
                    />

                    <button
                        type="button"
                        onClick={() => setShowPass((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        disabled={loading || registered}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                  </div>

                  {fieldErrors.password && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.password}</p>
                  )}

                </div>

                {/* CONFIRM PASSWORD */}
                <div className="form-group">

                  <label htmlFor="confirmPassword" className="label">
                    Confirm Password <span className="text-danger">*</span>
                  </label>

                  <div className="relative">

                    <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        className={clsx('input pr-12', fieldErrors.confirmPassword && 'border-danger/50')}
                        value={form.confirmPassword}
                        onChange={(e) => update('confirmPassword', e.target.value)}
                        required
                        autoComplete="new-password"
                        disabled={loading || registered}
                    />

                    <button
                        type="button"
                        onClick={() => setShowConfirm((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                        disabled={loading || registered}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                  </div>

                  {fieldErrors.confirmPassword && (
                      <p className="text-xs text-danger mt-1.5">{fieldErrors.confirmPassword}</p>
                  )}

                </div>

              </section>

              {/* SUBMIT */}
              <button
                  type="submit"
                  id="register-college-submit-btn"
                  disabled={loading || registered}
                  className="btn-primary w-full btn-lg"
              >

                {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                ) : registered ? (
                    'Registered ✓'
                ) : (
                    'Create College Admin Account'
                )}

              </button>

            </form>

          </div>
        </div>
      </div>
  )
}