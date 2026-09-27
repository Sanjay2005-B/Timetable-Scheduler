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
    <div className="min-h-screen bg-canvas flex">
      {/* LEFT SIDE */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink relative overflow-hidden flex-col items-center justify-center p-12">

        <div className="relative z-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-sm bg-ink mx-auto mb-6 flex items-center justify-center border border-white/15 ">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose a New
            <br />
            Password
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Your old password stops working the moment you reset it â€” every
            logged-in device must sign in again with the new one.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-sm bg-ink flex items-center justify-center border border-white/15 ">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <p className="font-bold text-slate-900">Timetable Scheduler</p>
          </div>

          {done ? (
            <div className="space-y-5 animate-slide-up">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-sm bg-success/10 border border-success/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Password Reset</h2>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                Your password has been changed successfully. Redirecting you to
                the login pageâ€¦
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Reset Password
              </h2>
              <p className="text-slate-600 mb-4">
                Enter the one-time token you received and choose a new password
                (min 8 characters).
              </p>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-sm bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">
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
                      Resettingâ€¦
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

          <div className="mt-4 text-center border-t border-line pt-5">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Request a new token
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}