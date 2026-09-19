import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Loader2, AlertCircle, ArrowLeft, KeyRound, CheckCircle2, Copy } from 'lucide-react'
import { authApi } from '@/api/authApi'
import type { ForgotPasswordResponse } from '@/types/auth.types'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setResult(null)

    const usernameOrEmail = identifier.trim()
    if (!usernameOrEmail) {
      setError('Please enter your username or email.')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.forgotPassword({ usernameOrEmail })
      setResult(response.data?.data ?? null)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasToken = result?.resetToken

  const copyToken = async () => {
    if (!hasToken) return
    try {
      await navigator.clipboard.writeText(hasToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be unavailable — the token stays selectable */
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
            Reset Your
            <br />
            Password
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Request a one-time reset token for your account, then set a brand new
            password in minutes.
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

          {!result ? (
            <>
              <h2 className="text-3xl font-bold text-white mb-2">
                Forgot Password?
              </h2>
              <p className="text-gray-400 mb-6">
                Enter your username or email and we will issue a one-time reset
                token for your account.
              </p>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="form-group">
                  <label htmlFor="usernameOrEmail" className="label">
                    Username / Login ID
                  </label>
                  <input
                    id="usernameOrEmail"
                    type="text"
                    placeholder="Enter your Login ID or email"
                    className="input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
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
                      Requesting…
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Request Reset Token
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-5 animate-slide-up">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {hasToken ? 'Reset Token Ready' : 'Request Received'}
                </h2>
              </div>

              {hasToken ? (
                <>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    A one-time reset token has been generated for your account.
                    Use it on the next screen to set a new password.
                  </p>
                  <div className="rounded-xl bg-surface-100 border border-white/10 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                        Your reset token
                      </p>
                      <button
                        type="button"
                        onClick={copyToken}
                        className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="block text-brand-300 font-mono text-sm break-all bg-black/30 rounded-lg p-3 select-all">
                      {hasToken}
                    </code>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    This token is valid for 15 minutes and can be used only once.
                    For your security, do not share it.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/reset-password?token=${encodeURIComponent(hasToken)}`)}
                    className="btn-primary w-full btn-lg"
                  >
                    Continue to Reset Password →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    If an account exists for that identifier, a password reset has
                    been initiated on it. Follow the instructions associated with
                    your account to continue.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="btn-primary w-full btn-lg"
                  >
                    Back to Login
                  </button>
                </>
              )}
            </div>
          )}

          <div className="mt-6 text-center border-t border-white/10 pt-5">
            <Link
              to="/login"
              className="text-xs font-semibold text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}