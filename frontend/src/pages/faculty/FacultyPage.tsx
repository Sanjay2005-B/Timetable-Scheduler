import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Trash2, Edit2, Loader2, X, Building2, Mail, Phone } from 'lucide-react'
import { facultyApi, FacultyRequest, FacultyResponse } from '@/api/facultyApi'
import { departmentApi } from '@/api/departmentApi'
import SearchInput from '@/components/ui/SearchInput'
import { QueryErrorMessage } from '@/components/ui/QueryErrorMessage'
import { useHodScope } from '@/hooks/useHodScope'

export default function FacultyPage() {
  const queryClient = useQueryClient()
  // Faculty are confined to the HOD's own department: the backend scopes the
  // list and rejects any other departmentId, so the form is pinned to match.
  const { isHod, departmentId } = useHodScope()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<number | undefined>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFaculty, setEditingFaculty] = useState<FacultyResponse | null>(null)

  const [formData, setFormData] = useState<FacultyRequest>({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: undefined,
    designation: 'Professor',
    qualification: 'Ph.D.',
    specialization: '',
    maxDailyHours: 6,
    maxWeeklyHours: 24,
    status: 'AVAILABLE',
    username: '',
    password: '',
  })

  // ── Fetch Faculty ───────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['faculty', search, deptFilter],
    queryFn: async () => {
      const res = await facultyApi.getFaculty({ search, departmentId: deptFilter, size: 50 })
      return res.data.data
    },
  })

  // ── Fetch Departments for Dropdown ───────────────────────────────
  const { data: deptData, isError: deptError, error: deptLoadError } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await departmentApi.getDepartments({ size: 100 })
      return res.data.data?.content || []
    },
  })

  // ── Save Mutation ────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingFaculty) {
        await facultyApi.updateFaculty(editingFaculty.id, formData)
      } else {
        await facultyApi.createFaculty(formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty'] })
      closeModal()
    },
  })

  // ── Delete Mutation ──────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => facultyApi.deleteFaculty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faculty'] }),
    onError: (err: any) => {
      window.alert(err?.response?.data?.message || 'Failed to delete faculty member.')
    },
  })

  const openCreateModal = () => {
    saveMutation.reset()
    setEditingFaculty(null)
    setFormData({
      employeeId: `FAC00${Math.floor(Math.random() * 90) + 10}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: isHod ? departmentId ?? undefined : deptData && deptData.length > 0 ? deptData[0].id : undefined,
      designation: 'Professor',
      qualification: 'Ph.D.',
      specialization: '',
      maxDailyHours: 6,
      maxWeeklyHours: 24,
      status: 'AVAILABLE',
      username: '',
      password: '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (f: FacultyResponse) => {
    saveMutation.reset()
    setEditingFaculty(f)
    setFormData({
      employeeId: f.employeeId,
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone || '',
      departmentId: f.departmentId,
      designation: f.designation || 'Professor',
      qualification: f.qualification || '',
      specialization: f.specialization || '',
      maxDailyHours: f.maxDailyHours,
      maxWeeklyHours: f.maxWeeklyHours,
      status: f.status,
      username: '',
      password: '',
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingFaculty(null)
  }

  const getSaveError = () => {
    const d = (saveMutation.error as any)?.response?.data
    if (d?.errors && Object.keys(d.errors).length) {
      return `${d.message || 'Validation failed'}: ${Object.values(d.errors).join('; ')}`
    }
    return d?.message || 'Failed to save faculty member.'
  }

  // Displayed in ascending A–Z order by faculty name (case-insensitive).
  // A copied array is sorted so the react-query response cache is never
  // mutated; because the list is derived on every render the order stays
  // correct for every search / department-filter result and re-sorts itself
  // after a create or edit.
  const facultyNameKey = (f: FacultyResponse) =>
    (f.fullName || `${f.firstName || ''} ${f.lastName || ''}`.trim() || f.employeeId || '')
      .trim()
      .toLowerCase()

  const facultyList = [...(data?.content || [])].sort((a, b) =>
    facultyNameKey(a).localeCompare(facultyNameKey(b), undefined, { sensitivity: 'base' }),
  )

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Management</h1>
          <p className="page-subtitle">Manage faculty profiles, designations, and workload constraints</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Faculty Member
        </button>
      </div>

      {/* Search & Dept Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SearchInput
          className="flex-1 max-w-md"
          value={search}
          onChange={setSearch}
          placeholder="Search by name, employee ID, email…"
        />

        <select
          className="input w-auto min-w-[200px] h-10"
          value={deptFilter || ''}
          onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All Departments</option>
          {deptData?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {deptError && <QueryErrorMessage error={deptLoadError} subject="departments" />}

      {/* Grid Cards */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        </div>
      ) : isError ? (
        <QueryErrorMessage error={error} subject="faculty members" variant="block" />
      ) : facultyList.length === 0 ? (
        <div className="card">
          <div className="empty-state py-24">
            <Users className="w-16 h-16 text-accent-500/25 mb-4" />
            <h3 className="empty-state-title">No Faculty Members Found</h3>
            <p className="empty-state-desc">Create your first faculty member to assign subjects and schedules.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {facultyList.map((f) => (
            <div
              key={f.id}
              className="card p-4 h-full flex flex-col gap-3 hover:border-slate-300 hover:shadow-card transition-all"
            >
              {/* 1 — Faculty ID + availability status */}
              <div className="flex items-center justify-between gap-2">
                {/* Neutral badge: an identifier is metadata, not a brand moment —
                    a magenta badge on every card drowned the accent. */}
                <span className="badge badge-gray font-mono text-[10px]">{f.employeeId}</span>
                <span className={`badge ${f.status === 'AVAILABLE' ? 'badge-success' : f.status === 'LEAVE' ? 'badge-danger' : 'badge-warning'}`}>
                  {f.status}
                </span>
              </div>

              {/* 2 — Name · 3 — Designation */}
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight truncate" title={f.fullName}>{f.fullName}</h3>
                <p className="text-[11px] text-accent-600 font-medium truncate">{f.designation || '—'}</p>
              </div>

              {/* 4 — Department · 5 — Email & phone */}
              <div className="space-y-0.5 text-[11px] text-slate-600 border-t border-line pt-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  <span className="truncate" title={f.departmentName || undefined}>{f.departmentName || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  <span className="truncate" title={f.email}>{f.email}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{f.phone || 'N/A'}</span>
                </div>
              </div>

              {/* 6 — Maximum workload */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] bg-slate-50 border border-line px-2.5 py-1.5 rounded-sm">
                <span className="text-slate-600">Max Workload</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">{f.maxDailyHours}h/day · {f.maxWeeklyHours}h/week</span>
              </div>

              {/* 7 — Actions */}
              <div className="mt-auto flex items-center justify-end gap-1 border-t border-line pt-2">
                <button onClick={() => openEditModal(f)} className="btn-ghost btn-sm">
                  <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Edit
                </button>
                <button onClick={() => deleteMutation.mutate(f.id)} className="btn-ghost btn-sm text-danger">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-500" />
                {editingFaculty ? 'Edit Faculty' : 'Add Faculty Member'}
              </h3>
              <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Employee ID *</label>
                  <input type="text" required className="input" value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Department</label>
                  <select
                    className="input"
                    value={formData.departmentId || ''}
                    disabled={isHod}
                    title={isHod ? 'You can only manage faculty in your own department' : undefined}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">Select Dept</option>
                    {deptData?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {isHod && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Fixed to your own department.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">First Name *</label>
                  <input type="text" required className="input" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Last Name *</label>
                  <input type="text" required className="input" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Email *</label>
                  <input type="email" required className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Phone</label>
                  <input type="text" className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Designation</label>
                  <input type="text" className="input" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="input" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="BUSY">BUSY</option>
                    <option value="LEAVE">LEAVE</option>
                  </select>
                </div>
              </div>

              {!editingFaculty && (
                <div className="form-group">
                  <label className="label">Faculty Login Credentials</label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    A login account (ROLE_FACULTY) will be created and linked to this faculty record.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Faculty Login ID / Username</label>
                      <input type="text" className="input" placeholder="e.g. rajesh" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label">Faculty Password</label>
                      <input type="password" className="input" placeholder="Minimum 6 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-footer">
                {saveMutation.isError && (
                  <p className="error-text">{getSaveError()}</p>
                )}
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingFaculty ? 'Update Faculty' : 'Save Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
