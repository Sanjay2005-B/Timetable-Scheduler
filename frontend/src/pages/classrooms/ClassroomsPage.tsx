import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, Plus, Trash2, Edit2, Loader2, X, Building2, Users, GraduationCap } from 'lucide-react'
import { classroomApi, ClassroomRequest, ClassroomResponse } from '@/api/classroomApi'
import { departmentApi, DepartmentResponse, AcademicYearDto } from '@/api/departmentApi'
import SearchInput from '@/components/ui/SearchInput'
import { useHodScope } from '@/hooks/useHodScope'

export default function ClassroomsPage() {
  const queryClient = useQueryClient()
  // An HOD's classroom list and every ownership target are confined to their
  // own department by the backend; the form is pinned to match.
  const { isHod, departmentId } = useHodScope()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<ClassroomResponse | null>(null)

  const [formData, setFormData] = useState<ClassroomRequest>({
    roomNumber: '',
    roomName: '',
    building: 'Block A',
    departmentId: undefined,
    academicYearId: undefined,
    sectionId: undefined,
    roomType: 'LECTURE_HALL',
    capacity: 60,
    floor: 1,
    status: 'AVAILABLE',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['classrooms', search, typeFilter],
    queryFn: async () => {
      const res = await classroomApi.getClassrooms({ search, roomType: typeFilter, size: 50 })
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

  const selectedDept: DepartmentResponse | undefined = deptData?.find((d) => d.id === formData.departmentId)
  const selectedYear: AcademicYearDto | undefined = selectedDept?.academicYears.find(
    (y) => y.id === formData.academicYearId && y.isEnabled !== false,
  )
  const yearOptions = selectedDept?.academicYears.filter((y) => y.isEnabled !== false) || []
  const sectionOptions = selectedYear?.sections || []

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingRoom) {
        await classroomApi.updateClassroom(editingRoom.id, formData)
      } else {
        await classroomApi.createClassroom(formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => classroomApi.deleteClassroom(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
    onError: (err: any) => {
      window.alert(err?.response?.data?.message || 'Failed to delete classroom.')
    },
  })

  const openCreateModal = () => {
    saveMutation.reset()
    setEditingRoom(null)
    setFormData({
      roomNumber: `CS-${Math.floor(Math.random() * 900) + 100}`,
      roomName: '',
      building: 'Block A',
      departmentId: isHod ? departmentId ?? undefined : deptData && deptData.length > 0 ? deptData[0].id : undefined,
      academicYearId: undefined,
      sectionId: undefined,
      roomType: 'LECTURE_HALL',
      capacity: 60,
      floor: 1,
      status: 'AVAILABLE',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (r: ClassroomResponse) => {
    saveMutation.reset()
    setEditingRoom(r)
    setFormData({
      roomNumber: r.roomNumber,
      roomName: r.roomName || '',
      building: r.building || '',
      departmentId: r.departmentId,
      academicYearId: r.academicYearId,
      sectionId: r.sectionId,
      roomType: r.roomType,
      capacity: r.capacity,
      floor: r.floor || 1,
      status: r.status,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingRoom(null)
  }

  const getSaveError = () => {
    const d = (saveMutation.error as any)?.response?.data
    if (d?.errors && Object.keys(d.errors).length) {
      return `${d.message || 'Validation failed'}: ${Object.values(d.errors).join('; ')}`
    }
    return d?.message || 'Failed to save classroom.'
  }

  const classrooms = data?.content || []

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Classroom Management</h1>
          <p className="page-subtitle">Manage lecture halls, labs, seminar rooms, and room capacities</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Classroom
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SearchInput
          className="flex-1 max-w-md"
          value={search}
          onChange={setSearch}
          placeholder="Search by room number, building, room name…"
        />

        <select
          className="input w-auto min-w-[180px] h-10"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Room Types</option>
          <option value="LECTURE_HALL">LECTURE_HALL</option>
          <option value="LAB">LAB</option>
          <option value="SEMINAR_ROOM">SEMINAR_ROOM</option>
          <option value="AUDITORIUM">AUDITORIUM</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="card">
          <div className="empty-state py-24">
            <DoorOpen className="w-16 h-16 text-green-600/25 mb-4" />
            <h3 className="empty-state-title">No Classrooms Found</h3>
            <p className="empty-state-desc">Add your college's rooms to start timetable generation.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classrooms.map((r) => (
            <div
              key={r.id}
              className="card p-4 h-full flex flex-col gap-3 hover:border-slate-300 hover:shadow-card transition-all"
            >
              {/* 1 — Building + room type */}
              <div className="flex items-center justify-between gap-2">
                {/* Building is a location, not a brand moment — neutral badge. */}
                <span className="badge badge-gray text-[10px] truncate" title={r.building || undefined}>{r.building || 'Main'}</span>
                <span className={`badge ${r.roomType === 'LAB' ? 'badge-info' : 'badge-gray'} whitespace-nowrap`}>
                  {r.roomType}
                </span>
              </div>

              {/* 2 — Room number + room name */}
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight truncate" title={r.roomNumber}>{r.roomNumber}</h3>
                <p className="text-[11px] text-slate-600 truncate" title={r.roomName || undefined}>{r.roomName || 'Classroom'}</p>
              </div>

              {/* 3 — Capacity · 4 — Floor · 5 — Department & year/section */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] bg-slate-50 border border-line px-2.5 py-2 rounded-sm">
                <div className="min-w-0">
                  <span className="text-slate-600 block">Capacity</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Users className="w-3 h-3 text-green-600 flex-shrink-0" /> {r.capacity} seats
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-600 block">Floor</span>
                  <span className="font-semibold text-slate-900">{r.floor || 1}</span>
                </div>
                <div className="min-w-0 col-span-2">
                  <span className="text-slate-600 block">Department</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1 min-w-0">
                    <Building2 className="w-3 h-3 text-accent-600 flex-shrink-0" />
                    <span className="truncate" title={r.departmentName || undefined}>{r.departmentName || 'Shared'}</span>
                  </span>
                </div>
                <div className="min-w-0 col-span-2">
                  <span className="text-slate-600 block">Year / Section</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1 min-w-0">
                    <GraduationCap className="w-3 h-3 text-accent-600 flex-shrink-0" />
                    <span className="truncate">
                      {r.academicYearId
                        ? `${r.academicYearLabel || 'Year'}${r.sectionId ? ' · ' + (r.sectionName || '') : ''}`
                        : 'All'}
                    </span>
                  </span>
                </div>
              </div>

              {/* 6 — Availability · 7 — Actions */}
              <div className="mt-auto flex items-center justify-between gap-1 border-t border-line pt-2">
                <span className={`badge ${r.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                  {r.status}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(r)} className="btn-ghost btn-sm">
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Edit
                  </button>
                  <button onClick={() => deleteMutation.mutate(r.id)} className="btn-ghost btn-sm text-danger">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-green-600" />
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </h3>
              <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Room Number *</label>
                  <input type="text" required className="input" value={formData.roomNumber} onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Building</label>
                  <input type="text" className="input" value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Room Type</label>
                  <select className="input" value={formData.roomType} onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}>
                    <option value="LECTURE_HALL">LECTURE_HALL</option>
                    <option value="LAB">LAB</option>
                    <option value="SEMINAR_ROOM">SEMINAR_ROOM</option>
                    <option value="AUDITORIUM">AUDITORIUM</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Capacity (Students) *</label>
                  <input type="number" required min="1" className="input" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label className="label">Department Ownership</label>
                <p className="text-xs text-slate-500 mb-2">
                  {isHod
                    ? 'Rooms you manage belong to your own department.'
                    : 'Leave shared to let any department\'s timetable use this room.'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="form-group">
                    <select
                      className="input"
                      value={formData.departmentId ?? ''}
                      disabled={isHod}
                      title={isHod ? 'You can only manage classrooms in your own department' : undefined}
                      onChange={(e) => {
                        const departmentId = e.target.value === '' ? undefined : Number(e.target.value)
                        setFormData({ ...formData, departmentId, academicYearId: undefined, sectionId: undefined })
                      }}
                    >
                      <option value="">Shared (All)</option>
                      {deptData?.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      className="input"
                      value={formData.academicYearId ?? ''}
                      disabled={!formData.departmentId}
                      onChange={(e) => {
                        const academicYearId = e.target.value === '' ? undefined : Number(e.target.value)
                        setFormData({ ...formData, academicYearId, sectionId: undefined })
                      }}
                    >
                      <option value="">All Years</option>
                      {yearOptions.map((y) => (
                        <option key={y.id} value={y.id}>{y.yearLabel}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      className="input"
                      value={formData.sectionId ?? ''}
                      disabled={!formData.academicYearId}
                      onChange={(e) => setFormData({ ...formData, sectionId: e.target.value === '' ? undefined : Number(e.target.value) })}
                    >
                      <option value="">All Sections</option>
                      {sectionOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-footer">
                {saveMutation.isError && (
                  <p className="error-text">{getSaveError()}</p>
                )}
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingRoom ? 'Update Room' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
