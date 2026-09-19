import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Search, Trash2, Edit2, Archive, RefreshCw,
  Loader2, X, ChevronDown, ChevronRight, Layers, Check, Square
} from 'lucide-react'
import { departmentApi, DepartmentRequest, DepartmentResponse, DepartmentDependencies, YearSections } from '@/api/departmentApi'

const ALL_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E']
const DEFAULT_SECTIONS = ['A', 'B']

const defaultYearSections = (): YearSections[] =>
  ALL_YEARS.map((yearLabel) => ({ yearLabel, enabled: true, sections: [...DEFAULT_SECTIONS] }))

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isArchived, setIsArchived] = useState<boolean | undefined>(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentResponse | null>(null)
  const [expandedDeptId, setExpandedDeptId] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [deleteConfirmDept, setDeleteConfirmDept] = useState<DepartmentResponse | null>(null)
  const [deleteDependencies, setDeleteDependencies] = useState<DepartmentDependencies | null>(null)
  const [deleteDepsLoading, setDeleteDepsLoading] = useState(false)

  const [formData, setFormData] = useState<DepartmentRequest>({
    name: '',
    hodName: '',
    contactEmail: '',
    contactPhone: '',
    building: '',
    description: '',
    years: defaultYearSections(),
    hodUsername: '',
    hodPassword: '',
  })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // ── Fetch Departments ───────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['departments', search, isArchived],
    queryFn: async () => {
      const res = await departmentApi.getDepartments({ search, isArchived, size: 50 })
      return res.data.data
    },
  })

  // ── Create / Update Mutation ─────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingDept) {
        await departmentApi.updateDepartment(editingDept.id, formData)
      } else {
        await departmentApi.createDepartment(formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      showToast(editingDept ? '✅ Department updated successfully!' : '✅ Department created successfully with selected sections!')
      closeModal()
    },
  })

  // ── Archive / Restore / Delete Mutations ──────────────────────────
  const archiveMutation = useMutation({
    mutationFn: (id: number) => departmentApi.archiveDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      showToast('📦 Department archived successfully')
    },
    onError: (err: any) => {
      showToast('❌ ' + (err?.response?.data?.message || 'Failed to archive department'), 'error')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => departmentApi.restoreDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      showToast('♻️ Department restored successfully')
    },
    onError: (err: any) => {
      showToast('❌ ' + (err?.response?.data?.message || 'Failed to restore department'), 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentApi.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      showToast('🗑️ Department deleted permanently')
      setDeleteConfirmDept(null)
      setDeleteDependencies(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete department'
      showToast('❌ ' + msg, 'error')
    },
  })

  const openDeleteConfirm = async (dept: DepartmentResponse) => {
    setDeleteConfirmDept(dept)
    setDeleteDependencies(null)
    setDeleteDepsLoading(true)
    try {
      const res = await departmentApi.getDependencies(dept.id)
      setDeleteDependencies(res.data.data ?? { timetables: 0, subjects: 0, faculty: 0, classrooms: 0, users: 0 })
    } catch {
      setDeleteDependencies({ timetables: 0, subjects: 0, faculty: 0, classrooms: 0, users: 0 })
    } finally {
      setDeleteDepsLoading(false)
    }
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirmDept(null)
    setDeleteDependencies(null)
  }

  const hasAnyDependencies = deleteDependencies
    ? (deleteDependencies.timetables + deleteDependencies.subjects + deleteDependencies.faculty + deleteDependencies.classrooms + deleteDependencies.users) > 0
    : false

  const openCreateModal = () => {
    saveMutation.reset()
    setEditingDept(null)
    setFormData({
      name: '',
      hodName: '',
      contactEmail: '',
      contactPhone: '',
      building: '',
      description: '',
      years: defaultYearSections(),
      hodUsername: '',
      hodPassword: '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (dept: DepartmentResponse) => {
    saveMutation.reset()
    setEditingDept(dept)
    const years = ALL_YEARS.map((yearLabel) => {
      const y = dept.academicYears?.find((ay) => ay.yearLabel === yearLabel)
      const enabled = y?.isEnabled ?? true
      return {
        yearLabel,
        enabled,
        sections: enabled ? (y?.sections || []).map((s) => s.name) : [],
      }
    })

    setFormData({
      name: dept.name,
      hodName: dept.hodName || '',
      contactEmail: dept.contactEmail || '',
      contactPhone: dept.contactPhone || '',
      building: dept.building || '',
      description: dept.description || '',
      years,
      hodUsername: '',
      hodPassword: '',
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingDept(null)
    saveMutation.reset()
  }

  const toggleSectionInYear = (yearLabel: string, section: string) => {
    setFormData((prev) => ({
      ...prev,
      years: (prev.years || []).map((y) => {
        if (y.yearLabel !== yearLabel) return y
        const current = y.sections || []
        const sections = current.includes(section)
          ? current.filter((s) => s !== section)
          : [...current, section]
        return { ...y, sections }
      }),
    }))
  }

  const toggleYear = (yearLabel: string) => {
    setFormData((prev) => ({
      ...prev,
      years: (prev.years || []).map((y) =>
        y.yearLabel === yearLabel
          ? { ...y, enabled: !y.enabled, sections: y.enabled ? [] : y.sections }
          : y,
      ),
    }))
  }

  const departments = data?.content || []

  return (
    <div className="space-y-6">
      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div className={`p-4 rounded-xl font-semibold text-xs animate-fade-in flex items-center justify-between ${
          toastType === 'error'
            ? 'bg-danger/20 border border-danger/40 text-red-300'
            : 'bg-success/20 border border-success/40 text-green-300'
        }`}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Management</h1>
          <p className="page-subtitle">Configure college departments, HODs, academic years, and customizable sections (A–E)</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by department name, HOD, building…"
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsArchived(false)}
            className={`btn-sm ${!isArchived ? 'btn-primary' : 'btn-secondary'}`}
          >
            Active ({departments.filter((d) => !d.isArchived).length})
          </button>
          <button
            onClick={() => setIsArchived(true)}
            className={`btn-sm ${isArchived ? 'btn-primary' : 'btn-secondary'}`}
          >
            Archived ({departments.filter((d) => d.isArchived).length})
          </button>
        </div>
      </div>

      {/* ── Departments List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : departments.length === 0 ? (
        <div className="card">
          <div className="empty-state py-24">
            <Building2 className="w-16 h-16 text-brand-500/30 mb-4" />
            <h3 className="empty-state-title">No Departments Found</h3>
            <p className="empty-state-desc">Get started by creating your college's first department.</p>
            <button onClick={openCreateModal} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Create Department
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => {
            const isExpanded = expandedDeptId === dept.id
            return (
              <div key={dept.id} className="card p-5 transition-all hover:border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                      className="p-2 rounded-lg bg-surface-100 text-gray-400 hover:text-white mt-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-white">{dept.name}</h3>
                        {dept.isArchived ? (
                          <span className="badge badge-warning">Archived</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                        <span>HOD: <strong className="text-gray-200">{dept.hodName || 'Not assigned'}</strong></span>
                        <span>Building: <strong className="text-gray-200">{dept.building || 'N/A'}</strong></span>
                        <span>Contact: <strong className="text-gray-200">{dept.contactEmail || 'N/A'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button onClick={() => openEditModal(dept)} className="btn-ghost btn-sm">
                      <Edit2 className="w-4 h-4 text-brand-400" /> Edit
                    </button>
                    {dept.isArchived ? (
                      <button onClick={() => restoreMutation.mutate(dept.id)} className="btn-ghost btn-sm text-success">
                        <RefreshCw className="w-4 h-4" /> Restore
                      </button>
                    ) : (
                      <button onClick={() => archiveMutation.mutate(dept.id)} className="btn-ghost btn-sm text-warning">
                        <Archive className="w-4 h-4" /> Archive
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteConfirm(dept)}
                      className="btn-ghost btn-sm text-danger"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>

                {/* ── Expanded Academic Years & Sections Hierarchy ── */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-white/5 space-y-4 animate-fade-in">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-400" /> Academic Years & Configured Sections
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {dept.academicYears?.map((year) => (
                        <div key={year.id} className={`p-3 rounded-xl border ${year.isEnabled === false ? 'bg-surface-200/40 border-white/5' : 'bg-surface-100 border-white/5'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold text-sm ${year.isEnabled === false ? 'text-gray-500' : 'text-white'}`}>{year.yearLabel}</span>
                            {year.isEnabled === false ? (
                              <span className="badge badge-warning">Disabled</span>
                            ) : (
                              <span className="badge badge-brand">{year.sections?.length || 0} Sections</span>
                            )}
                          </div>
                          {year.isEnabled !== false && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {year.sections?.map((sec) => (
                                <span key={sec.id} className="px-2.5 py-1 rounded-lg bg-surface-200 text-xs font-semibold text-gray-200 flex items-center gap-1 border border-white/5">
                                  Sec {sec.name} <span className="text-[10px] text-gray-400">({sec.studentStrength} std)</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {year.isEnabled === false && (
                            <p className="text-[11px] text-gray-500 mt-2">Year disabled — no sections available.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirmDept && (
        <div className="modal-backdrop" onClick={closeDeleteConfirm}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-danger" />
                Confirm Permanent Delete
              </h3>
              <button onClick={closeDeleteConfirm} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-300">
                Are you sure you want to permanently delete <strong className="text-white">{deleteConfirmDept.name}</strong>?
              </p>

              {deleteDepsLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking dependencies…
                </div>
              ) : deleteDependencies && (
                <div className="rounded-xl border border-white/10 bg-surface-200/50 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">What will happen:</p>
                  {deleteDependencies.timetables > 0 && (
                    <p className="text-sm text-red-300">
                      🗑️ <strong>{deleteDependencies.timetables}</strong> timetable{deleteDependencies.timetables !== 1 ? 's' : ''} and all their entries will be <strong>deleted</strong>
                    </p>
                  )}
                  {deleteDependencies.subjects > 0 && (
                    <p className="text-sm text-red-300">
                      🗑️ <strong>{deleteDependencies.subjects}</strong> subject{deleteDependencies.subjects !== 1 ? 's' : ''} will be <strong>deleted</strong>
                    </p>
                  )}
                  {deleteDependencies.faculty > 0 && (
                    <p className="text-sm text-yellow-300">
                      🔗 <strong>{deleteDependencies.faculty}</strong> faculty member{deleteDependencies.faculty !== 1 ? 's' : ''} will be <strong>unlinked</strong> (department removed, records kept)
                    </p>
                  )}
                  {deleteDependencies.classrooms > 0 && (
                    <p className="text-sm text-yellow-300">
                      🔗 <strong>{deleteDependencies.classrooms}</strong> classroom{deleteDependencies.classrooms !== 1 ? 's' : ''} will be <strong>unlinked</strong> (department removed, records kept)
                    </p>
                  )}
                  {deleteDependencies.users > 0 && (
                    <p className="text-sm text-yellow-300">
                      🔗 <strong>{deleteDependencies.users}</strong> user account{deleteDependencies.users !== 1 ? 's' : ''} will be <strong>unlinked</strong> (department removed, accounts kept)
                    </p>
                  )}
                  {!hasAnyDependencies && (
                    <p className="text-sm text-green-300">
                      ✅ No dependent records — department will be deleted cleanly.
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-white/5">
                    Academic years and sections within this department will also be deleted.
                  </p>
                </div>
              )}

              <p className="text-xs text-danger font-semibold">⚠️ This action cannot be undone.</p>

              <div className="form-footer">
                <button type="button" onClick={closeDeleteConfirm} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending || deleteDepsLoading}
                  onClick={() => deleteConfirmDept && deleteMutation.mutate(deleteConfirmDept.id)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal with Checkboxes for Years & Sections (A–E) ── */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                {editingDept ? 'Edit Department' : 'Create Department'}
              </h3>
              <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-6 space-y-4">
              <div className="form-group">
                <label className="label">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">HOD Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Sharma"
                    className="input"
                    value={formData.hodName}
                    onChange={(e) => setFormData({ ...formData, hodName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Building / Block</label>
                  <input
                    type="text"
                    placeholder="e.g. Block A"
                    className="input"
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Contact Email</label>
                  <input
                    type="email"
                    placeholder="cse@college.edu"
                    className="input"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    className="input"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief department overview…"
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* ── HOD Login Credentials (create only) ── */}
              {!editingDept && (
                <div className="form-group border-t border-white/10 pt-3">
                  <label className="label">HOD Login Credentials</label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    A login account (ROLE_HOD) will be created for this department with the credentials below.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">HOD Login ID / Username</label>
                      <input
                        type="text"
                        placeholder="e.g. Tamil123"
                        className="input"
                        value={formData.hodUsername}
                        onChange={(e) => setFormData({ ...formData, hodUsername: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">HOD Password</label>
                      <input
                        type="password"
                        placeholder="e.g. 12345678"
                        className="input"
                        value={formData.hodPassword}
                        onChange={(e) => setFormData({ ...formData, hodPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Per-Year Section Selection (A–E) ── */}
              <div className="form-group border-t border-white/10 pt-3">
                <label className="label">Academic Years & Sections</label>
                <p className="text-[11px] text-gray-500 mb-2">Check the years that are active; disabled years are excluded from subjects, timetables and reports.</p>
                <div className="space-y-3">
                  {(formData.years || []).map((year) => {
                    const isChecked = (sec: string) => year.sections?.includes(sec)
                    return (
                      <div key={year.yearLabel} className={`p-3 rounded-xl border ${year.enabled ? 'bg-surface-100 border-white/5' : 'bg-surface-200/40 border-white/5'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            onClick={() => toggleYear(year.yearLabel)}
                            className="flex items-center gap-2.5 text-sm font-semibold text-white hover:text-brand-300 transition-colors"
                          >
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${year.enabled ? 'bg-brand-500 border-brand-500' : 'bg-surface-200 border-white/20'}`}>
                              {year.enabled ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                            </span>
                            {year.yearLabel}
                          </button>
                          {year.enabled ? (
                            <span className="badge badge-brand">{year.sections?.length || 0} Sections</span>
                          ) : (
                            <span className="badge badge-warning">Disabled</span>
                          )}
                        </div>
                        {year.enabled ? (
                          <div className="grid grid-cols-5 gap-2">
                            {ALL_SECTIONS.map((sec) => (
                              <button
                                type="button"
                                key={sec}
                                onClick={() => toggleSectionInYear(year.yearLabel, sec)}
                                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                  isChecked(sec)
                                    ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-glow'
                                    : 'bg-surface-200 border-white/10 text-gray-400 hover:text-white'
                                }`}
                              >
                                {isChecked(sec) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-gray-500" />}
                                Sec {sec}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-500">No sections displayed because the year is disabled.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {saveMutation.isError && (
                <p className="error-text">
                  {(() => {
                    const d = (saveMutation.error as any)?.response?.data
                    if (d?.errors && Object.keys(d.errors).length) {
                      return `${d.message || 'Validation failed'}: ${Object.values(d.errors).join('; ')}`
                    }
                    return d?.message || 'Failed to save department.'
                  })()}
                </p>
              )}

              <div className="form-footer">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingDept ? 'Update Department' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
