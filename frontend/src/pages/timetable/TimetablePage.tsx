import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CheckCircle, AlertTriangle, Building2, Layers, BookOpen, User, Loader2, X, Sparkles, ChevronDown
} from 'lucide-react'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'
import { departmentApi, DepartmentResponse } from '@/api/departmentApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import { useAuthStore } from '@/store/authStore'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Current semester derived from the academic calendar instead of a fixed
// assumption: the ODD session (Jul–Dec) starts with semester 1, the EVEN
// session (Jan–Jun) with semester 2 — mirroring the backend's
// currentAcademicSession() derivation.
const defaultSemester = (): number => (new Date().getMonth() + 1 >= 7 ? 1 : 2)

const toolbarSelectClass =
  'h-10 w-full appearance-none rounded-xl border border-white/10 bg-surface-100 pl-9 pr-9 text-sm font-medium text-white outline-none transition-all hover:border-white/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/25'

export default function TimetablePage() {
  const { hasRole } = useAuthStore()
  const canGenerate = hasRole('ROLE_HOD') || hasRole('ROLE_EXAM_COORDINATOR') || hasRole('ROLE_SUPER_ADMIN')

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<number>(defaultSemester())
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false)
  const [showConflictsModal, setShowConflictsModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const queryClient = useQueryClient()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // ── Fetch Departments ───────────────────────────────────────────
  const { data: deptData, isError: deptError } = useQuery<DepartmentResponse[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await departmentApi.getDepartments({ size: 50 })
      return res.data?.data?.content || []
    },
  })

  const selectedDept = deptData?.find((d) => d.id === selectedDeptId) || deptData?.[0]
  const availableYears = selectedDept?.academicYears?.filter((y) => y.isEnabled !== false) || []
  const selectedYear = availableYears.find((y) => y.id === selectedYearId) || availableYears[0]
  const availableSections = selectedYear?.sections || []
  const activeSection = availableSections.find((s) => s.id === selectedSectionId) || availableSections[0]

  // ── Fetch Current Timetable ──────────────────────────────────────
  // Query key carries the REAL selected identifiers so cache entries are
  // strictly per selection and switching never shows stale data.
  const sectionQueryKey = [
    'sectionTimetable',
    selectedDept?.collegeId ?? null,
    selectedDept?.id ?? null,
    selectedYear?.id ?? null,
    activeSection?.id ?? null,
    selectedSemester,
  ] as const
  const { data: timetable, isLoading } = useQuery<TimetableResponse | null>({
    queryKey: sectionQueryKey,
    queryFn: async () => {
      if (!activeSection?.id) return null
      try {
        const res = await timetableApi.getTimetableBySection(activeSection.id, selectedSemester)
        return res.data.data || null
      } catch {
        return null
      }
    },
    enabled: !!activeSection?.id,
  })

  // ── Time-Slot Master (configured teaching periods) ──────────────
  // Base the grid structure on the configured time-slot master (same source
  // as MyTimetablePage / ReportsPage) so unscheduled periods render as
  // "Free Period" instead of silently collapsing away.
  const { data: timeSlotData } = useQuery<TimeSlot[]>({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data?.data || []
    },
  })
  const masterSlots: TimeSlot[] = (timeSlotData ?? [])
    .filter((s) => !s.isBreak)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
  const useMasterSlots = masterSlots.length > 0

  // ── AI Generator Mutation ────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (data: { departmentId: number; sectionId: number; semester: number }) =>
      timetableApi.generateTimetable(data),
    onSuccess: async () => {
      setIsGeneratorModalOpen(false)
      showToast('Timetable generated successfully!', 'success')
      await queryClient.invalidateQueries({ queryKey: sectionQueryKey })
    },
    onError: (err) => {
      setIsGeneratorModalOpen(false)
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Timetable generation failed. Please verify subjects, classrooms and availability are configured.'
      showToast(msg, 'error')
    },
  })

  const handleGenerate = () => {
    if (!selectedDept?.id || !activeSection?.id) return
    generateMutation.mutate({
      departmentId: selectedDept.id,
      sectionId: activeSection.id,
      semester: selectedSemester,
    })
  }

  // ── Timetable Display ──
  const entryMap = new Map<string, TimetableEntryDto>()
  timetable?.entries?.forEach((e: TimetableEntryDto) => {
    entryMap.set(`${e.dayOfWeek}_${useMasterSlots ? e.timeSlotId : e.timeSlotTime}`, e)
  })

  const columns: { key: string; label: string }[] = useMasterSlots
    ? masterSlots.map((ts) => ({
        key: String(ts.id),
        label: `${ts.startTime} - ${ts.endTime}`,
      }))
    : Array.from(new Set(timetable?.entries?.map((e) => e.timeSlotTime) || []))
        .sort()
        .map((t) => ({ key: t, label: t }))

  // Real scheduled count vs actual configured available slots.
  const scheduledCount = timetable?.entries?.length ?? 0
  const availableSlots = useMasterSlots
    ? masterSlots.length * DAYS.length
    : columns.length * DAYS.length

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
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {canGenerate
              ? 'Generate and manage section timetables.'
              : 'View-only timetables. Contact your HOD or exam coordinator to modify schedules.'}
          </p>
        </div>
        {canGenerate && (
          <button
            onClick={() => setIsGeneratorModalOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-brand text-white text-xs font-bold shadow-glow hover:opacity-90 transition-all"
          >
            <Sparkles className="w-4 h-4" /> Run AI Generator
          </button>
        )}
      </div>

      {/* ── Selection Toolbar ── */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Department */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              className={toolbarSelectClass}
              value={selectedDept?.id ?? ''}
              onChange={(e) => {
                setSelectedDeptId(Number(e.target.value) || null)
                setSelectedYearId(null)
                setSelectedSectionId(null)
              }}
            >
              {deptData?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Year */}
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              className={toolbarSelectClass}
              value={selectedYear?.id ?? ''}
              onChange={(e) => {
                setSelectedYearId(Number(e.target.value) || null)
                setSelectedSectionId(null)
              }}
            >
              {availableYears.map((y) => (
                <option key={y.id} value={y.id}>{y.yearLabel}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Section */}
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              className={toolbarSelectClass}
              value={activeSection?.id ?? ''}
              onChange={(e) => setSelectedSectionId(Number(e.target.value) || null)}
            >
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Semester */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              className={toolbarSelectClass}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Timetable Display ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : timetable && timetable.entries?.length > 0 ? (
        <div className="card overflow-x-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase w-24">Day / Slot</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-2 py-1.5 text-[11px] font-bold text-gray-300 text-center min-w-[140px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-white/[0.02]">
                  <td className="px-2 py-1.5 text-[11px] font-bold text-brand-300 uppercase tracking-wider bg-surface-100/50">
                    {day}
                  </td>
                  {columns.map((col) => {
                    const entry = entryMap.get(`${day}_${col.key}`)
                    if (!entry) {
                      return (
                        <td key={col.key} className="p-1.5 text-center text-[11px] border border-white/5">
                          <span className="text-gray-600 italic">Free Period</span>
                        </td>
                      )
                    }
                    const isLab = entry.isLab
                    return (
                      <td key={col.key} className="p-1 border border-white/5">
                        <div className={`px-2 py-1.5 rounded-md space-y-0.5 ${
                          isLab
                            ? 'bg-purple-500/15 border border-purple-500/30'
                            : 'bg-brand-500/15 border border-brand-500/30'
                        }`}>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-[11px] text-white">{entry.subjectCode}</span>
                            <span className={`text-[9px] px-1 py-px rounded font-semibold ${isLab ? 'bg-purple-500/30 text-purple-200' : 'bg-brand-500/30 text-brand-200'}`}>
                              {isLab ? 'LAB' : 'THEORY'}
                            </span>
                          </div>
                          <div className="text-[10px] font-medium text-gray-200 truncate">{entry.subjectName}</div>
                          <div className="text-[9px] text-gray-400 flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-brand-400" /> {entry.facultyName}
                          </div>
                          <div className="text-[9px] text-gray-400 flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 text-emerald-400" /> {entry.roomName || `Room ${entry.roomNumber}`}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card py-20 text-center space-y-4">
          <Calendar className="w-16 h-16 text-brand-500/30 mx-auto" />
          <h3 className="text-lg font-bold text-white">No timetable available for this selection.</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No timetable has been generated for the selected Department / Year / Section / Semester combination.
          </p>
          {canGenerate && (
            <button
              onClick={() => setIsGeneratorModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-brand text-white text-xs font-bold shadow-glow hover:opacity-90 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Run AI Generator
            </button>
          )}
        </div>
      )}

      {/* ── Schedule Metrics ── */}
      {timetable && timetable.entries?.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-400" /> {scheduledCount} / {availableSlots} Slots Scheduled
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Optimization Score: {timetable.optimizationScore || 100}%
            </div>

            {timetable.conflictCount > 0 ? (
              <button
                onClick={() => setShowConflictsModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-danger/15 border border-danger/30 text-red-400 text-xs font-bold flex items-center gap-1.5 hover:bg-danger/25 transition-all"
              >
                <AlertTriangle className="w-4 h-4 animate-bounce" /> {timetable.conflictCount} Conflicts Detected
              </button>
            ) : (
              <div className="px-3.5 py-1.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 0 Conflicts (Clean)
              </div>
            )}
          </div>
          <div className="text-[11px] text-gray-500">
            {timetable.departmentName} · {selectedYear?.yearLabel || ''} Sec {timetable.sectionName} · Semester {timetable.semester} · {timetable.academicSession}
          </div>
        </div>
      )}

      {deptError && (
        <p className="w-full text-xs text-red-400">
          Could not load departments from the server. Please refresh the page or verify the backend is running.
        </p>
      )}

      {/* ── Conflicts Modal ── */}
      {showConflictsModal && timetable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowConflictsModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-surface-800 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Conflicts Detected</h3>
                  <p className="text-[11px] text-gray-400">{timetable.conflictCount} issues on this timetable</p>
                </div>
              </div>
              <button onClick={() => setShowConflictsModal(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 max-h-[55vh] overflow-y-auto space-y-3">
              {timetable.conflicts && timetable.conflicts.length > 0 ? (
                timetable.conflicts.map((c) => (
                  <div key={c.id} className="rounded-xl border border-danger/20 bg-danger/5 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                      {c.conflictType} · {c.severity}
                    </p>
                    <p className="text-xs text-gray-300">{c.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400">No conflict details available.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowConflictsModal(false)}
                className="h-9 px-5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generator Modal ── */}
      {isGeneratorModalOpen && canGenerate && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsGeneratorModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-surface-800 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-purple-500/30 border border-brand-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Execute AI Generator</h3>
                  <p className="text-[11px] text-gray-400">Generates a conflict-free timetable via heuristic engine</p>
                </div>
              </div>
              <button onClick={() => setIsGeneratorModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-100/50">
              <div className="space-y-2">
                <p className="text-[10px] text-gray-500 tracking-widest uppercase font-semibold">Target Department</p>
                <p className="text-sm font-bold text-white">{selectedDept.name}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] text-gray-500 tracking-widest uppercase font-semibold">Target Section</p>
                <p className="text-sm font-bold text-white">Section {activeSection?.name || '—'}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] text-gray-500 tracking-widest uppercase font-semibold">Semester</p>
                <p className="text-sm font-bold text-white">Semester {selectedSemester}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-white/10 bg-surface-100/50 p-4 space-y-2">
                <p className="text-xs font-bold text-white">The engine will schedule:</p>
                <ul className="space-y-2 text-[12px] text-gray-400">
                  {[
                    'Lectures, tutorials and labs into valid weekly slots.',
                    'Teachers within their availability windows.',
                    'Rooms respecting capacity and equipment (lab) needs.',
                    'Minimizing conflicts while balancing workload.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsGeneratorModalOpen(false)}
                  disabled={generateMutation.isPending}
                  className="h-10 flex-1 rounded-xl border border-white/10 text-sm font-bold text-gray-300 hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="h-10 flex-1 rounded-xl bg-gradient-brand text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generateMutation.isPending ? 'Generating...' : 'Run Generator Engine'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}