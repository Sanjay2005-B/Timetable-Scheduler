import { useState, FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Zap, Loader2, AlertCircle, ArrowLeft, KeyRound, Lock, CheckCircle2 } from 'lucide-react'
import { authApi } from '@/api/authApi'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const password = newPassword

    if (!token.trim()) {
      setError('The reset token is required.')
      return
    }
    if (password.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword({ token: token.trim(), newPassword: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      const status = err?.response?.status
      setError(
        status === 422
          ? err?.response?.data?.message ??
              'The reset token is invalid or has expired. Please request a new one.'
          : (err?.response?.data?.message ?? 'Unable to reset your password. Please try again.'),
      )
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
            Choose a New
            <br />
            Password
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Your old password stops working the moment you reset it — every
            logged-in device must sign in again with the new one.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-white">Timetable ERP</p>
          </div>

          {done ? (
            <div className="space-y-5 animate-slide-up">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-white">Password Reset</h2>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your password has been changed successfully. Redirecting you to
                the login page…
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-white mb-2">
                Reset Password
              </h2>
              <p className="text-gray-400 mb-6">
                Enter the one-time token you received and choose a new password
                (min 8 characters).
              </p>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="form-group">
                  <label htmlFor="resetToken" className="label">
                    Reset Token
                  </label>
                  <input
                    id="resetToken"
                    type="text"
                    placeholder="Paste your one-time reset token"
                    className="input font-mono"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="label">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="label">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat your new password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full btn-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Set New Password
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center border-t border-white/10 pt-5">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Request a new token
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}