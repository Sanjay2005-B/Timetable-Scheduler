import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Search, Trash2, Edit2, Loader2, X, Building2, Mail, Phone } from 'lucide-react'
import { facultyApi, FacultyRequest, FacultyResponse } from '@/api/facultyApi'
import { departmentApi } from '@/api/departmentApi'

export default function FacultyPage() {
  const queryClient = useQueryClient()
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
  const { data, isLoading } = useQuery({
    queryKey: ['faculty', search, deptFilter],
    queryFn: async () => {
      const res = await facultyApi.getFaculty({ search, departmentId: deptFilter, size: 50 })
      return res.data.data
    },
  })

  // ── Fetch Departments for Dropdown ───────────────────────────────
  const { data: deptData } = useQuery({
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
      departmentId: deptData && deptData.length > 0 ? deptData[0].id : undefined,
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

  const facultyList = data?.content || []

  return (
    <div className="space-y-6">
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, employee ID, email…"
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[200px]"
          value={deptFilter || ''}
          onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All Departments</option>
          {deptData?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Grid Cards */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : facultyList.length === 0 ? (
        <div className="card text-center py-20">
          <Users className="w-16 h-16 text-gray-500/30 mx-auto mb-4" />
          <h3 className="empty-state-title">No Faculty Members Found</h3>
          <p className="empty-state-desc">Create your first faculty member to assign subjects and schedules.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {facultyList.map((f) => (
            <div key={f.id} className="card p-5 hover:border-brand-500/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="badge badge-brand text-[10px]">{f.employeeId}</span>
                    <h3 className="text-base font-bold text-white mt-1">{f.fullName}</h3>
                    <p className="text-xs text-brand-400 font-medium">{f.designation}</p>
                  </div>
                  <span className={`badge ${f.status === 'AVAILABLE' ? 'badge-success' : f.status === 'LEAVE' ? 'badge-danger' : 'badge-warning'}`}>
                    {f.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-400 my-4 border-t border-b border-white/5 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-500" />
                    <span className="truncate">{f.departmentName || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    <span className="truncate">{f.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <span>{f.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-surface-100 p-2.5 rounded-xl">
                  <span className="text-gray-400">Max Workload:</span>
                  <span className="font-semibold text-white">{f.maxDailyHours}h/day · {f.maxWeeklyHours}h/week</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/5">
                <button onClick={() => openEditModal(f)} className="btn-ghost btn-sm">
                  <Edit2 className="w-3.5 h-3.5 text-brand-400" /> Edit
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
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                {editingFaculty ? 'Edit Faculty' : 'Add Faculty Member'}
              </h3>
              <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Employee ID *</label>
                  <input type="text" required className="input" value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Department</label>
                  <select className="input" value={formData.departmentId || ''} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Select Dept</option>
                    {deptData?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
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
                  <p className="text-[11px] text-gray-500 mb-2">
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
