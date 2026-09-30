import { AlertTriangle, Lock } from 'lucide-react'

type ErrorInfo = {
  status: number | null
  isPermission: boolean
  title: string
  detail: string
}

export function describeQueryError(error: unknown, subject: string): ErrorInfo {
  const status: number | null = (error as any)?.response?.status ?? null
  const serverMessage: string | undefined = (error as any)?.response?.data?.message

  if (status === 403) {
    return {
      status,
      isPermission: true,
      title: `You do not have permission to view these ${subject}`,
      detail: serverMessage
        ? `${serverMessage} This list is limited by your role, so it is hidden rather than empty.`
        : 'This list is limited by your role, so it is hidden rather than empty.',
    }
  }

  if (status === 401) {
    return {
      status,
      isPermission: true,
      title: `Your session expired while loading these ${subject}`,
      detail: 'Please sign in again to continue.',
    }
  }

  if (status !== null && status >= 500) {
    return {
      status,
      isPermission: false,
      title: `The server failed while loading these ${subject}`,
      detail: serverMessage
        ? `${serverMessage} This is a server-side error, not empty data.`
        : 'This is a server-side error, not empty data. Please refresh the page or verify the backend is running.',
    }
  }

  if (status !== null) {
    return {
      status,
      isPermission: false,
      title: `Could not load these ${subject}`,
      detail: serverMessage
        ? `${serverMessage} (HTTP ${status})`
        : `The server responded with HTTP ${status}.`,
    }
  }

  return {
    status: null,
    isPermission: false,
    title: `Could not reach the server while loading these ${subject}`,
    detail: 'No response was received. Please check your connection and refresh the page.',
  }
}

type Props = {
  error: unknown
  subject: string
  variant?: 'block' | 'inline'
}

export function QueryErrorMessage({ error, subject, variant = 'inline' }: Props) {
  const info = describeQueryError(error, subject)

  if (variant === 'inline') {
    return (
      <p className="error-text">
        {info.title}. {info.detail}
      </p>
    )
  }

  const Icon = info.isPermission ? Lock : AlertTriangle

  return (
    <div className="card">
      <div className="empty-state py-24">
        <Icon className="w-16 h-16 text-danger/40" />
        <h3 className="empty-state-title">{info.title}</h3>
        <p className="empty-state-desc">{info.detail}</p>
      </div>
    </div>
  )
}
