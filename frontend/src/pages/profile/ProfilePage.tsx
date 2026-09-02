import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  User, Mail, Building2, GraduationCap, MapPin,
  ShieldCheck, KeyRound, LogOut, Loader2, Save, Pencil, AlertCircle,
  CalendarDays, BadgeCheck, IdCard, UserRound, Lock, CheckCircle2,
} from 'lucide-react'
import { profileApi } from '@/api/profileApi'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/store/authStore'
import { ProfileResponse, UpdateProfileRequest } from '@/types/profile.types'

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

/** Letter avatar (the existing topbar/nav pattern). */
function Avatar({
  profile,
  size = 'large',
}: {
  profile?: ProfileResponse | null
  size?: 'large' | 'medium'
}) {
  const initial = profile?.fullName?.charAt(0) ?? 'A'
  const photo = profile?.profilePhotoUrl
  const cls =
    size === 'large'
      ? 'w-24 h-24 rounded-3xl text-3xl'
      : 'w-14 h-14 rounded-2xl text-lg'

  if (photo) {
    return (
      <img
        src={photo}
        alt={profile?.fullName ?? 'Profile'}
        className={`${cls} object-cover bg-surface-100 border border-white/10 shadow-glow flex-shrink-0`}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <div
      className={`${cls} bg-gradient-brand flex items-center justify-center font-bold text-white shadow-glow flex-shrink-0`}
    >
      {initial}
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
  const { logout } = useAuthStore()

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState<UpdateProfileRequest>({
    fullName: '',
    phone: '',
    profilePhotoUrl: '',
  })

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
      await authApi.logout()
    } catch {
      /* ignore */
    }
    logout()
    navigate('/login')
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
        <Avatar profile={profile} />
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
      {saveError && (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {saveError}
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
                Uses the existing profile-photo URL mechanism (no new upload system).
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
              <InfoRow label="Department" value={profile.departmentName || '—'} />
            </div>
          </div>
        )}
      </div>

      {/* ── College / Institution Information ── */}
      <div className="card p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
          <Building2 className="w-5 h-5 text-violet-400" /> College / Institution Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          <div>
            <InfoRow
              label="College Name"
              value={
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-gray-500" /> {profile.institutionName || '—'}
                </span>
              }
            />
          </div>
          <div>
            <InfoRow
              label="College Address"
              value={
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-500" /> {profile.institutionAddress || '—'}
                </span>
              }
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-600 mt-3">
          Institution information is maintained centrally and is read-only for your account.
        </p>
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
                  <IdCard className="w-4 h-4 text-gray-500" /> {profile.employeeId || 'N/A'}
                </span>
              }
            />
            <InfoRow
              label="Designation"
              value={
                profile.designation || <span className="text-gray-600">N/A</span>
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
          {/* Change Password — backend not implemented yet */}
          <button
            type="button"
            disabled
            title="Requires a separate backend task (not yet implemented)"
            className="btn-secondary w-full opacity-40 cursor-not-allowed flex flex-col sm:flex-row items-center gap-2 !h-auto py-4"
          >
            <KeyRound className="w-4 h-4" /> Change Password
          </button>

          {/* Forgot/Reset Password — backend not implemented yet */}
          <button
            type="button"
            disabled
            title="Requires a separate authentication/email implementation"
            className="btn-secondary w-full opacity-40 cursor-not-allowed flex flex-col sm:flex-row items-center gap-2 !h-auto py-4"
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

        <div className="mt-5 p-4 rounded-xl bg-surface-100 border border-white/5 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-400 flex items-center gap-1.5">
            <UserRound className="w-3.5 h-3.5" /> Notifications
          </p>
          <p>• Change Password requires a separate backend task — not yet implemented.</p>
          <p>• Forgot / Reset Password requires a separate authentication/email implementation — not yet implemented.</p>
        </div>
      </div>
    </div>
  )
}