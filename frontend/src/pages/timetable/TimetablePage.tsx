import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CheckCircle, AlertTriangle, Building2, Layers, BookOpen, User, Loader2, X, Sparkles, ChevronDown
} from 'lucide-react'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'
import { departmentApi, DepartmentResponse } from '@/api/departmentApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import { useAuthStore } from '@/store/authStore'
import { useHodScope } from '@/hooks/useHodScope'
import { QueryErrorMessage } from '@/components/ui/QueryErrorMessage'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Current semester derived from the academic calendar instead of a fixed
// assumption: the ODD session (Jul–Dec) starts with semester 1, the EVEN
// session (Jan–Jun) with semester 2 — mirroring the backend's
// currentAcademicSession() derivation.
const defaultSemester = (): number => (new Date().getMonth() + 1 >= 7 ? 1 : 2)

const toolbarSelectClass =
  'h-10 w-full appearance-none rounded-sm border border-line bg-white pl-9 pr-9 text-sm font-medium text-slate-900 outline-none transition-all hover:border-slate-300 focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/25'

export default function TimetablePage() {
  const { hasRole } = useAuthStore()
  const canGenerate = hasRole('ROLE_HOD') || hasRole('ROLE_EXAM_COORDINATOR') || hasRole('ROLE_SUPER_ADMIN')
  // The backend already confines an HOD to their own department for both the
  // section read and generation; the selector is locked to match.
  const { isHod } = useHodScope()

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
  const { data: deptData, isError: deptError, error: deptLoadError } = useQuery<DepartmentResponse[]>({
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
    <div className="space-y-5">
      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div className={`p-4 rounded-sm font-semibold text-xs animate-fade-in flex items-center justify-between ${
          toastType === 'error'
            ? 'bg-danger/20 border border-danger/40 text-danger'
            : 'bg-success/20 border border-success/40 text-success'
        }`}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-600 hover:text-slate-900"><X className="w-4 h-4" /></button>
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
            className="btn-primary"
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
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              className={toolbarSelectClass}
              value={selectedDept?.id ?? ''}
              disabled={isHod}
              title={isHod ? 'You can only view and generate timetables for your own department' : undefined}
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
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Year */}
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Section */}
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              className={toolbarSelectClass}
              value={activeSection?.id ?? ''}
              onChange={(e) => setSelectedSectionId(Number(e.target.value) || null)}
            >
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Semester */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              className={toolbarSelectClass}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Timetable Display ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        </div>
      ) : timetable && timetable.entries?.length > 0 ? (
        <div className="card overflow-x-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="px-2 py-1.5 text-[11px] font-bold text-slate-600 uppercase w-24">Day / Slot</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-2 py-1.5 text-[11px] font-bold text-slate-700 text-center min-w-[140px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            {/* Was `divide-y divide-white/5` — a 5%-white rule left over from a
                dark theme, invisible on the near-white card. Row separation is
                already carried by each cell's own border. */}
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 text-[11px] font-bold text-accent-700 uppercase tracking-wider bg-slate-50">
                    {day}
                  </td>
                  {columns.map((col) => {
                    const entry = entryMap.get(`${day}_${col.key}`)
                    if (!entry) {
                      return (
                        <td key={col.key} className="p-1.5 text-center text-[11px] border border-line">
                          <span className="text-slate-500 italic">Free Period</span>
                        </td>
                      )
                    }
                    const isLab = entry.isLab
                    return (
                      <td key={col.key} className="p-1 border border-line">
                        {/* LAB vs THEORY was bg-brand-600/15 vs bg-brand-500/15 —
                            two almost identical blues at 15% opacity, so the
                            distinction the cell was meant to carry was invisible.
                            It now mirrors the text badge below it (LAB = accent,
                            THEORY = neutral) instead of contradicting it, which
                            also keeps magenta off the ~36 THEORY cells. */}
                        <div className={`px-2 py-1.5 rounded-sm space-y-0.5 ${
                          isLab
                            ? 'bg-accent-50 border border-accent-200'
                            : 'bg-slate-50 border border-line'
                        }`}>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-[11px] text-slate-900">{entry.subjectCode}</span>
                            <span className={`text-[9px] px-1 py-px rounded font-semibold ${isLab ? 'bg-accent-50 text-accent-700' : 'bg-slate-200 text-slate-700'}`}>
                              {isLab ? 'LAB' : 'THEORY'}
                            </span>
                          </div>
                          <div className="text-[10px] font-medium text-slate-700 truncate">{entry.subjectName}</div>
                          <div className="text-[9px] text-slate-600 flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-slate-500" /> {entry.facultyName}
                          </div>
                          <div className="text-[9px] text-slate-600 flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 text-green-600" /> {entry.roomName || `Room ${entry.roomNumber}`}
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
        <div className="card">
          <div className="empty-state py-24">
            <Calendar className="w-16 h-16 text-accent-500/25" />
            <h3 className="empty-state-title">No timetable available for this selection.</h3>
            <p className="empty-state-desc">
              No timetable has been generated for the selected Department / Year / Section / Semester combination.
            </p>
            {canGenerate && (
              <button
                onClick={() => setIsGeneratorModalOpen(true)}
                className="btn-primary mt-4"
              >
                <Sparkles className="w-4 h-4" /> Run AI Generator
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Schedule Metrics ── */}
      {timetable && timetable.entries?.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-sm bg-slate-50 border border-line text-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent-600" /> {scheduledCount} / {availableSlots} Slots Scheduled
            </div>

            {timetable.conflictCount > 0 && (
              <button
                onClick={() => setShowConflictsModal(true)}
                className="px-3.5 py-1.5 rounded-sm bg-danger/15 border border-danger/30 text-danger text-xs font-bold flex items-center gap-1.5 hover:bg-danger/25 transition-all"
              >
                <AlertTriangle className="w-4 h-4 animate-bounce" /> {timetable.conflictCount} Conflicts Detected
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {timetable.departmentName} · {selectedYear?.yearLabel || ''} Sec {timetable.sectionName} · Semester {timetable.semester} · {timetable.academicSession}
          </div>
        </div>
      )}

      {deptError && (
        <QueryErrorMessage error={deptLoadError} subject="departments" />
      )}

      {/* ── Conflicts Modal ── */}
      {showConflictsModal && timetable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowConflictsModal(false)} />
          <div className="relative w-full max-w-lg rounded-sm bg-surface border border-line shadow-card-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-danger/15 border border-danger/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold">Conflicts Detected</h3>
                  <p className="text-[11px] text-slate-600">{timetable.conflictCount} issues on this timetable</p>
                </div>
              </div>
              <button onClick={() => setShowConflictsModal(false)} className="w-8 h-8 rounded-sm hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 max-h-[55vh] overflow-y-auto space-y-3">
              {timetable.conflicts && timetable.conflicts.length > 0 ? (
                timetable.conflicts.map((c) => (
                  <div key={c.id} className="rounded-sm border border-danger/20 bg-danger/5 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-danger">
                      {c.conflictType} · {c.severity}
                    </p>
                    <p className="text-xs text-slate-700">{c.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-600">No conflict details available.</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-line flex justify-end">
              <button
                onClick={() => setShowConflictsModal(false)}
                className="btn-secondary"
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
          <div className="relative w-full max-w-lg rounded-sm bg-surface border border-line shadow-card-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-accent-50 border border-accent-200 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold">Execute AI Generator</h3>
                  <p className="text-[11px] text-slate-600">Generates a conflict-free timetable via heuristic engine</p>
                </div>
              </div>
              <button onClick={() => setIsGeneratorModalOpen(false)} className="w-8 h-8 rounded-sm hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-slate-50">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 tracking-widest uppercase font-semibold">Target Department</p>
                <p className="text-sm font-bold text-slate-900">{selectedDept.name}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] text-slate-500 tracking-widest uppercase font-semibold">Target Section</p>
                <p className="text-sm font-bold text-slate-900">Section {activeSection?.name || '—'}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] text-slate-500 tracking-widest uppercase font-semibold">Semester</p>
                <p className="text-sm font-bold text-slate-900">Semester {selectedSemester}</p>
              </div>
            </div>

            <div className="px-4 py-3 space-y-4">
              <div className="rounded-sm border border-line bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-bold text-slate-900">The engine will schedule:</p>
                <ul className="space-y-2 text-[12px] text-slate-600">
                  {[
                    'Lectures, tutorials and labs into valid weekly slots.',
                    'Teachers within their availability windows.',
                    'Rooms respecting capacity and equipment (lab) needs.',
                    'Minimizing conflicts while balancing workload.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsGeneratorModalOpen(false)}
                  disabled={generateMutation.isPending}
                  className="btn-secondary btn-lg flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="btn-primary btn-lg flex-1"
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