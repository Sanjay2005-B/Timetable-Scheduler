import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Search, Trash2, Edit2, Loader2, X, Clock, UserCheck } from 'lucide-react'
import { subjectApi, SubjectRequest, SubjectResponse } from '@/api/subjectApi'
import { departmentApi } from '@/api/departmentApi'
import { facultyApi } from '@/api/facultyApi'

export default function SubjectsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<number | undefined>(undefined)
  const [yearFilter, setYearFilter] = useState<number | undefined>(undefined)
  const [sectionFilter, setSectionFilter] = useState<number | undefined>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectResponse | null>(null)

  const [formData, setFormData] = useState<SubjectRequest>({
    subjectCode: '',
    subjectName: '',
    departmentId: undefined,
    academicYearId: undefined,
    sectionId: undefined,
    facultyId: undefined,
    semester: 3,
    credits: 4,
    theoryHours: 3,
    practicalHours: 0,
    subjectType: 'THEORY',
    sessionBlockSize: 1,
    isActive: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['subjects', search, deptFilter, yearFilter, sectionFilter],
    queryFn: async () => {
      const res = await subjectApi.getSubjects({ search, departmentId: deptFilter, academicYearId: yearFilter, sectionId: sectionFilter, size: 50 })
      return res.data.data
    },
  })

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await departmentApi.getDepartments({ size: 100 })
      return res.data.data?.content || []
    },
  })

  const { data: facultyData } = useQuery({
    queryKey: ['facultyListForSubjects'],
    queryFn: async () => {
      const res = await facultyApi.getFaculty({ size: 100 })
      return res.data.data?.content || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingSubject) {
        await subjectApi.updateSubject(editingSubject.id, formData)
      } else {
        await subjectApi.createSubject(formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subjectApi.deleteSubject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (err: any) => {
      window.alert(err?.response?.data?.message || 'Failed to delete subject.')
    },
  })

  const openCreateModal = () => {
    saveMutation.reset()
    setEditingSubject(null)
    setFormData({
      subjectCode: `CS${Math.floor(Math.random() * 900) + 100}`,
      subjectName: '',
      departmentId: deptData && deptData.length > 0 ? deptData[0].id : undefined,
      academicYearId: undefined,
      sectionId: undefined,
      facultyId: undefined,
      semester: 3,
      credits: 4,
      theoryHours: 3,
      practicalHours: 0,
      subjectType: 'THEORY',
      sessionBlockSize: 1,
      isActive: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (s: SubjectResponse) => {
    saveMutation.reset()
    setEditingSubject(s)
    setFormData({
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      departmentId: s.departmentId,
      academicYearId: s.academicYearId,
      sectionId: s.sectionId,
      facultyId: s.facultyId,
      semester: s.semester,
      credits: s.credits,
      theoryHours: s.theoryHours,
      practicalHours: s.practicalHours,
      subjectType: s.subjectType,
      sessionBlockSize: s.sessionBlockSize ?? 1,
      isActive: s.isActive,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingSubject(null)
  }

  const getSaveError = () => {
    const d = (saveMutation.error as any)?.response?.data
    if (d?.errors && Object.keys(d.errors).length) {
      return `${d.message || 'Validation failed'}: ${Object.values(d.errors).join('; ')}`
    }
    return d?.message || 'Failed to save subject.'
  }

  const subjects = data?.content || []

  const selectedFormDept = deptData?.find((d) => d.id === formData.departmentId)
  const formYears = selectedFormDept?.academicYears || []
  const selectedFormYear = formYears.find((y) => y.id === formData.academicYearId)
  const formSections = selectedFormYear?.sections || []

  const selectedFilterDept = deptData?.find((d) => d.id === deptFilter)
  const filterYears = selectedFilterDept?.academicYears || []
  const selectedFilterYear = filterYears.find((y) => y.id === yearFilter)
  const filterSections = selectedFilterYear?.sections || []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subject Management</h1>
          <p className="page-subtitle">Configure curriculum subjects, credits, theory & practical hours, and assigned faculty</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by code or subject name…"
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[200px]"
          value={deptFilter || ''}
          onChange={(e) => {
            const d = e.target.value ? Number(e.target.value) : undefined
            setDeptFilter(d)
            setYearFilter(undefined)
            setSectionFilter(undefined)
          }}
        >
          <option value="">All Departments</option>
          {deptData?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {deptFilter !== undefined && (
          <select
            className="input w-auto min-w-[160px]"
            value={yearFilter || ''}
            onChange={(e) => {
              const y = e.target.value ? Number(e.target.value) : undefined
              setYearFilter(y)
              setSectionFilter(undefined)
            }}
          >
            <option value="">All Years</option>
            {filterYears.map((y) => (
              <option key={y.id} value={y.id}>{y.yearLabel}</option>
            ))}
          </select>
        )}

        {yearFilter !== undefined && (
          <select
            className="input w-auto min-w-[140px]"
            value={sectionFilter || ''}
            onChange={(e) => setSectionFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Sections</option>
            {filterSections.map((s) => (
              <option key={s.id} value={s.id}>Section {s.name}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-20">
          <BookOpen className="w-16 h-16 text-cyan-500/30 mx-auto mb-4" />
          <h3 className="empty-state-title">No Subjects Found</h3>
          <p className="empty-state-desc">Create your subjects to set up course workloads.</p>
        </div>
      ) : (
        <div className="table-container card">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Department</th>
                <th>Academic Year</th>
                <th>Section</th>
                <th>Assigned Faculty</th>
                <th>Semester</th>
                <th>Credits</th>
                <th>Weekly Hours</th>
                <th>Type</th>
                <th>Session Block</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="font-mono text-xs font-bold text-brand-300 bg-brand-500/10 px-2 py-1 rounded-md">
                      {s.subjectCode}
                    </span>
                  </td>
                  <td className="font-semibold text-white">{s.subjectName}</td>
                  <td className="text-gray-400">{s.departmentName || 'N/A'}</td>
                  <td className="text-gray-400">{s.yearLabel || 'N/A'}</td>
                  <td className="text-gray-400">{s.sectionName ? `Section ${s.sectionName}` : 'N/A'}</td>
                  <td>
                    {s.facultyName ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> {s.facultyName}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Unassigned</span>
                    )}
                  </td>
                  <td>Sem {s.semester}</td>
                  <td>{s.credits} Credits</td>
                  <td>
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      {s.theoryHours}h Theory + {s.practicalHours}h Lab
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.subjectType === 'LAB' ? 'badge-info' : 'badge-brand'}`}>
                      {s.subjectType}
                    </span>
                  </td>
                  <td>
                    {s.subjectType === 'LAB' ? (
                      <span className="text-xs text-gray-500">—</span>
                    ) : (s.sessionBlockSize ?? 1) > 1 ? (
                      <span className="badge badge-info">{(s.sessionBlockSize ?? 1)}×consecutive</span>
                    ) : (
                      <span className="text-xs text-gray-500">Single</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(s)} className="btn-ghost btn-sm">
                        <Edit2 className="w-3.5 h-3.5 text-brand-400" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(s.id)} className="btn-ghost btn-sm text-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
              </h3>
              <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Subject Code *</label>
                  <input type="text" required className="input" value={formData.subjectCode} onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Subject Name *</label>
                  <input type="text" required className="input" value={formData.subjectName} onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Department *</label>
                  <select className="input" value={formData.departmentId || ''} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : undefined, academicYearId: undefined, sectionId: undefined })}>
                    <option value="">Select Dept</option>
                    {deptData?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Assigned Faculty</label>
                  <select className="input" value={formData.facultyId || ''} onChange={(e) => setFormData({ ...formData, facultyId: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Select Faculty</option>
                    {facultyData?.map((f) => <option key={f.id} value={f.id}>{f.fullName} ({f.designation})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Academic Year *</label>
                  <select className="input" required value={formData.academicYearId || ''} disabled={!selectedFormDept} onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value ? Number(e.target.value) : undefined, sectionId: undefined })}>
                    <option value="">Select Year</option>
                    {formYears.map((y) => <option key={y.id} value={y.id}>{y.yearLabel}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Section *</label>
                  <select className="input" required value={formData.sectionId || ''} disabled={!selectedFormYear} onChange={(e) => setFormData({ ...formData, sectionId: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Select Section</option>
                    {formSections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Semester *</label>
                  <input type="number" min="1" max="8" required className="input" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="label">Subject Type</label>
                  <select className="input" value={formData.subjectType} onChange={(e) => setFormData({ ...formData, subjectType: e.target.value })}>
                    <option value="THEORY">THEORY</option>
                    <option value="LAB">LAB</option>
                    <option value="ELECTIVE">ELECTIVE</option>
                    <option value="MANDATORY">MANDATORY</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Consecutive Periods per Session</label>
                <select
                  className="input"
                  value={formData.sessionBlockSize ?? 1}
                  onChange={(e) => setFormData({ ...formData, sessionBlockSize: Number(e.target.value) })}
                >
                  <option value={1}>1 — Single period (spread across days)</option>
                  <option value={2}>2 — Double period (2 back-to-back)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.subjectType === 'LAB'
                    ? 'Consecutive periods per practical session in a LAB room. 1 = each practical hour scheduled as a separate single-period session; 2 groups hours into consecutive blocks.'
                    : 'Consecutive periods this subject occupies each session. Practical hours of any subject are always scheduled as one continuous block regardless of this setting.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="label">Credits</label>
                  <input type="number" min="1" className="input" value={formData.credits} onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="label">Theory Hrs/Wk</label>
                  <input type="number" min="0" className="input" value={formData.theoryHours} onChange={(e) => setFormData({ ...formData, theoryHours: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="label">Lab Hrs/Wk</label>
                  <input type="number" min="0" className="input" value={formData.practicalHours} onChange={(e) => setFormData({ ...formData, practicalHours: Number(e.target.value) })} />
                </div>
              </div>

              <div className="form-footer">
                {saveMutation.isError && (
                  <p className="error-text">{getSaveError()}</p>
                )}
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingSubject ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
