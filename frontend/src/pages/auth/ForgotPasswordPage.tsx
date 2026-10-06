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
      // Never surface raw axios text (e.g. "timeout of 30000ms exceeded"):
      // a timeout/network failure carries no response at all, so it is
      // reported with plain user-facing copy instead.
      const serverMessage = err?.response?.data?.message
      if (serverMessage) {
        setError(serverMessage)
      } else if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT'
          || /timeout/i.test(err?.message ?? '')) {
        setError('The request took too long to complete. Please try again.')
      } else if (!err?.response) {
        setError('Unable to reach the server. Please try again.')
      } else {
        setError('Unable to send the password reset request. Please try again.')
      }
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
      /* clipboard may be unavailable â€” the token stays selectable */
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
            Reset Your
            <br />
            Password
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Request a one-time reset token for your account, then set a brand new
            password in minutes.
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

          {!result ? (
            <>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Forgot Password?
              </h2>
              <p className="text-slate-600 mb-4">
                Enter your username or email and we will issue a one-time reset
                token for your account.
              </p>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-sm bg-danger/10 border border-danger/30 text-danger text-sm mb-5 animate-slide-up">
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
                      Requesting...
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
                <div className="w-6 h-6 rounded-sm bg-success/10 border border-success/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {hasToken ? 'Reset Token Ready' : 'Request Received'}
                </h2>
              </div>

              {hasToken ? (
                <>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    A one-time reset token has been generated for your account.
                    Use it on the next screen to set a new password.
                  </p>
                  <div className="rounded-sm bg-slate-50 border border-line p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Your reset token
                      </p>
                      <button
                        type="button"
                        onClick={copyToken}
                        className="text-xs font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="block text-accent-700 font-mono text-sm break-all bg-white border border-line rounded-sm p-3 select-all">
                      {hasToken}
                    </code>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    This token is valid for 15 minutes and can be used only once.
                    For your security, do not share it.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/reset-password?token=${encodeURIComponent(hasToken)}`)}
                    className="btn-primary w-full btn-lg"
                  >
                    Continue to Reset Password â†’
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-600 text-sm leading-relaxed">
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

          <div className="mt-4 text-center border-t border-line pt-5">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}