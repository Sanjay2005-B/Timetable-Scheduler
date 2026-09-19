import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  User, Mail,
  ShieldCheck, KeyRound, LogOut, Loader2, Save, Pencil, AlertCircle,
  CalendarDays, BadgeCheck, IdCard, UserRound, Lock, CheckCircle2, X, Camera,
  Monitor, Trash2,
} from 'lucide-react'
import { profileApi } from '@/api/profileApi'
import { authApi } from '@/api/authApi'
import { API_BASE_URL } from '@/api/axiosClient'
import { useAuthStore } from '@/store/authStore'
import {
  ChangePasswordRequest,
  ProfileResponse,
  SessionInfo,
  UpdateProfileRequest,
} from '@/types/profile.types'

/** Readable label for a ROLE_* authority. */
function roleLabel(role: string): string {
  return role.replace('ROLE_', '').replace(/_/g, ' ')
}

/** Format ISO instant as "12 Aug 2025". */
function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'dd MMM yyyy')
}

/** Letter avatar (the existing topbar/nav pattern). Clickable to upload a photo. */
function Avatar({
  profile,
  size = 'large',
  uploading,
  onUploadClick,
}: {
  profile?: ProfileResponse | null
  size?: 'large' | 'medium'
  uploading?: boolean
  onUploadClick?: () => void
}) {
  const initial = profile?.fullName?.charAt(0) ?? 'A'
  const photo = profile?.profilePhotoUrl
  const cls =
    size === 'large'
      ? 'w-24 h-24 rounded-3xl text-3xl'
      : 'w-14 h-14 rounded-2xl text-lg'

  if (photo) {
    return (
      <div className="relative flex-shrink-0">
        <img
          src={photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`}
          alt={profile?.fullName ?? 'Profile'}
          className={`${cls} object-cover bg-surface-100 border border-white/10 shadow-glow`}
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            title="Upload photo"
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${cls} bg-gradient-brand flex items-center justify-center font-bold text-white shadow-glow`}
      >
        {initial}
      </div>
      {onUploadClick && (
        <button
          type="button"
          onClick={onUploadClick}
          title="Upload photo"
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </button>
      )}
    </div>
  )
}

/** Small "key → value" row for read-only cards. */
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-100 font-medium text-right ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout, hasRole } = useAuthStore()
  const isFaculty = hasRole('ROLE_FACULTY')

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState<UpdateProfileRequest>({
    fullName: '',
    phone: '',
    profilePhotoUrl: '',
  })

  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState('')
  const [sessionsError, setSessionsError] = useState('')

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => profileApi.uploadPhoto(file),
    onSuccess: async () => {
      setPhotoError('')
      await queryClient.invalidateQueries({ queryKey: ['myProfile'] })
    },
    onError: (err: any) => {
      setPhotoError(err.response?.data?.message ?? 'Photo upload failed. Please try again.')
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadPhoto.mutate(file)
    }
    e.target.value = ''
  }

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const res = await profileApi.getMyProfile()
      return res.data.data
    },
  })

  const updateProfile = useMutation({
    mutationFn: (data: UpdateProfileRequest) => profileApi.updateMyProfile(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      setEditing(false)
      setSaved(true)
      setSaveError('')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.message ?? 'Failed to update profile. Please try again.')
    },
  })

  const handleLogout = async () => {
    try {
      await authApi.logout(useAuthStore.getState().refreshToken ?? undefined)
    } catch {
      /* ignore */
    }
    logout()
    navigate('/login')
  }

  // ── Active sessions (Phase 5 multi-device + Phase 7 frontend UI) ─────
  const {
    data: sessions,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ['mySessions'],
    // Device Activity is a staff/management feature — the Faculty role does
    // not manage devices on the Profile page.
    enabled: !isFaculty,
    queryFn: async () => {
      const res = await profileApi.getMySessions()
      return res.data.data
    },
  })

  const revokeSession = useMutation({
    mutationFn: (sessionId: number) => profileApi.revokeSession(sessionId),
    onSuccess: async () => {
      setSessionsError('')
      await queryClient.invalidateQueries({ queryKey: ['mySessions'] })
    },
    onError: (err: any) => {
      setSessionsError(err.response?.data?.message ?? 'Failed to revoke session. Please try again.')
    },
  })

  const revokeAllOthers = useMutation({
    // The backend keeps the session holding THIS device's refresh token.
    mutationFn: () =>
      profileApi.revokeAllOtherSessions(useAuthStore.getState().refreshToken ?? ''),
    onSuccess: async () => {
      setSessionsError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mySessions'] }),
        queryClient.invalidateQueries({ queryKey: ['myProfile'] }),
      ])
    },
    onError: (err: any) => {
      setSessionsError(
        err.response?.data?.message ?? 'Failed to revoke other sessions. Please try again.',
      )
    },
  })

  const handleRevokeSession = (session: SessionInfo) => {
    if (
      window.confirm(
        `Sign out the device "${session.device || 'Unknown device'}" (session #${session.sessionId})?`,
      )
    ) {
      revokeSession.mutate(session.sessionId)
    }
  }

  const handleRevokeAllOthers = () => {
    if (window.confirm('Sign out every other device? You will stay signed in on this one.')) {
      revokeAllOthers.mutate()
    }
  }

  const startEdit = (p: ProfileResponse) => {
    setForm({ fullName: p.fullName, phone: p.phone ?? '', profilePhotoUrl: p.profilePhotoUrl ?? '' })
    setSaveError('')
    setEditing(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) {
      setSaveError('Full name is required.')
      return
    }
    updateProfile.mutate(form)
  }

  const changePassword = useMutation({
    mutationFn: (data: ChangePasswordRequest) => profileApi.changeMyPassword(data),
    onSuccess: async () => {
      setPwModalOpen(false)
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwError('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 3000)
    },
    onError: (err: any) => {
      setPwError(err.response?.data?.message ?? 'Failed to change password. Please try again.')
    },
  })

  const openPwModal = () => {
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPwError('')
    setPwModalOpen(true)
  }

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwError('Current and new password are required.')
      return
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (pwForm.newPassword === pwForm.currentPassword) {
      setPwError('New password must be different from the current password.')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New password and confirmation do not match.')
      return
    }
    changePassword.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading your profile…</p>
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="empty-state">
        <AlertCircle className="w-10 h-10 text-danger mb-3" />
        <p className="empty-state-title">Unable to load profile</p>
        <p className="empty-state-desc">
          Something went wrong while fetching your profile. Please try again.
        </p>
      </div>
    )
  }

  const primaryRole = profile.roles?.length ? profile.roles[0] : 'ROLE_FACULTY'
  const secondaryInfo = profile.designation || profile.institutionName
  const instAddress = profile.institutionAddress

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal and account information</p>
        </div>
        {!editing && (
          <button className="btn-primary" onClick={() => startEdit(profile)}>
            <Pencil className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* ── Hero / identity card ── */}
      <div className="card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Avatar
          profile={profile}
          uploading={uploadPhoto.isPending}
          onUploadClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
            {profile.fullName}
            {profile.isActive && <BadgeCheck className="w-5 h-5 text-brand-400" />}
          </h2>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
            <span className="badge badge-brand">{roleLabel(primaryRole)}</span>
            {secondaryInfo && <span className="text-sm text-gray-400">{secondaryInfo}</span>}
          </div>
          <p className="text-sm text-gray-500 mt-3 flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="w-4 h-4" /> {profile.email}
          </p>
        </div>
        <button
          className="btn-danger sm:ml-auto"
          onClick={handleLogout}
          title="Sign out of this account"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Saved / error notices */}
      {saved && (
        <div className="p-4 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Profile updated successfully!
        </div>
      )}
      {pwSaved && (
        <div className="p-4 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Password changed successfully!
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {saveError}
        </div>
      )}
      {photoError && (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {photoError}
        </div>
      )}

      {/* ── Personal Information ── */}
      <div className="card p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
          <User className="w-5 h-5 text-brand-400" /> Personal Information
        </h3>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="fullName" className="label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone" className="label">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="profilePhotoUrl" className="label">Profile Photo URL</label>
              <input
                id="profilePhotoUrl"
                type="url"
                className="input"
                value={form.profilePhotoUrl}
                onChange={(e) => setForm({ ...form, profilePhotoUrl: e.target.value })}
                placeholder="/uploads/photos/avatar.png"
              />
              <p className="text-[11px] text-gray-600 mt-1.5">
                Click your avatar above to upload a photo (JPG / PNG / WebP, max 5 MB), or paste a direct file URL.
              </p>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={updateProfile.isPending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
            <div>
              <InfoRow label="Full Name" value={profile.fullName} />
              <InfoRow label="Email Address" value={profile.email} mono />
            </div>
            <div>
              <InfoRow label="Phone Number" value={profile.phone || '—'} />
              <InfoRow label="Address" value={instAddress || '—'} />
            </div>
          </div>
        )}
      </div>

      {/* ── Account Information ── */}
      <div className="card p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
          <IdCard className="w-5 h-5 text-cyan-400" /> Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          <div>
            <InfoRow label="User ID" value={profile.userId} mono />
            <InfoRow label="Role" value={<span className="badge badge-brand">{roleLabel(primaryRole)}</span>} />
            {profile.roles && profile.roles.length > 1 && (
              <InfoRow
                label="Secondary Roles"
                value={profile.roles.slice(1).map(roleLabel).join(', ')}
              />
            )}
          </div>
          <div>
            <InfoRow label="Username" value={profile.username} mono />
            <InfoRow
              label="Employee ID"
              value={
                <span className="flex items-center gap-1.5">
                  <IdCard className="w-4 h-4 text-gray-500" />
                  {profile.employeeId || <span className="italic text-gray-500">N/A</span>}
                </span>
              }
            />
            <InfoRow
              label="Designation"
              value={
                profile.designation || <span className="italic text-gray-500">N/A</span>
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 mt-2 border-t border-white/5 pt-2">
          <InfoRow
            label="Account Status"
            value={
              profile.isActive ? (
                <span className="badge badge-success">Active</span>
              ) : (
                <span className="badge badge-danger">Inactive</span>
              )
            }
          />
          <InfoRow
            label="Joined Date"
            value={
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-gray-500" /> {formatDate(profile.joinedDate)}
              </span>
            }
          />
        </div>
      </div>

      {/* ── Security ── */}
      <div className="card p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 mb-5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" /> Security
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Change Password — live since Phase 4 (POST /me/change-password) */}
          <button
            type="button"
            onClick={openPwModal}
            className="btn-secondary w-full flex flex-col sm:flex-row items-center justify-center gap-2 !h-auto py-4"
          >
            <KeyRound className="w-4 h-4" /> Change Password
          </button>

          {/* Forgot/Reset Password — live since the password-reset flow */}
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="btn-secondary w-full flex flex-col sm:flex-row items-center justify-center gap-2 !h-auto py-4"
          >
            <Lock className="w-4 h-4" /> Forgot / Reset Password
          </button>

          {/* Sign Out — works today */}
          <button
            type="button"
            onClick={handleLogout}
            className="btn-danger w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {!isFaculty && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              Active Sessions{!sessionsLoading && sessions ? ` (${sessions.length})` : ''}
            </p>
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 text-xs"
              onClick={handleRevokeAllOthers}
              disabled={revokeAllOthers.isPending || (sessions?.length ?? 0) <= 1}
              title={
                (sessions?.length ?? 0) <= 1
                  ? 'No other active sessions to revoke'
                  : 'Sign out every other device'
              }
            >
              {revokeAllOthers.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Revoking…</>
              ) : (
                <><LogOut className="w-3.5 h-3.5" /> Logout from Other Devices</>
              )}
            </button>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                    <th className="py-2 pr-3 font-semibold">Device</th>
                    <th className="py-2 pr-3 font-semibold">IP Address</th>
                    <th className="py-2 pr-3 font-semibold">Signed In</th>
                    <th className="py-2 pr-3 font-semibold">Expires</th>
                    <th className="py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.sessionId} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-3 text-gray-200">{s.device || 'Unknown device'}</td>
                      <td className="py-2.5 pr-3 text-gray-400 font-mono">{s.ipAddress || '—'}</td>
                      <td className="py-2.5 pr-3 text-gray-400">{formatDate(s.createdAt)}</td>
                      <td className="py-2.5 pr-3 text-gray-400">{formatDate(s.expiresAt)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          className="btn-danger !py-1 !px-2.5 text-xs"
                          disabled={revokeSession.isPending}
                          onClick={() => handleRevokeSession(s)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-3 text-sm text-gray-500">You have no active sessions.</p>
          )}

          {sessionsError && (
            <div className="mt-3 p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {sessionsError}
            </div>
          )}

          <p className="text-[11px] text-gray-600 mt-2">
            Revoking a session signs that device out immediately — its refresh token stops working.
            "Logout from Other Devices" keeps this one signed in.
          </p>
        </div>
        )}

        <div className="mt-5 p-4 rounded-xl bg-surface-100 border border-white/5 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-400 flex items-center gap-1.5">
            <UserRound className="w-3.5 h-3.5" /> Notifications
          </p>
          <p>• Change Password verifies your current password server-side — a wrong current password is rejected.</p>
          <p>• Forgot / Reset Password issues a one-time token (15-minute validity) that lets you set a new password.</p>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {pwModalOpen && (
        <div className="modal-backdrop" onClick={() => setPwModalOpen(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" /> Change Password
              </h3>
              <button onClick={() => setPwModalOpen(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePwSubmit} className="p-6 space-y-4">
              <div className="form-group">
                <label htmlFor="currentPassword" className="label">Current Password *</label>
                <input
                  id="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword" className="label">New Password *</label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                  placeholder="At least 8 characters"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword" className="label">Confirm New Password *</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="input"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                />
              </div>

              {pwError && (
                <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {pwError}
                </div>
              )}

              <div className="form-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={changePassword.isPending}
                  onClick={() => setPwModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={changePassword.isPending}
                >
                  {changePassword.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</>
                  ) : (
                    <><KeyRound className="w-4 h-4" /> Change Password</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}