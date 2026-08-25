import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, Sparkles, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle,
  Building2, Layers, BookOpen, User, Loader2, X, ShieldAlert, ChevronDown
} from 'lucide-react'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'
import { departmentApi, DepartmentResponse } from '@/api/departmentApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Current semester derived from the academic calendar instead of a fixed
// assumption: the ODD session (Jul–Dec) starts with semester 1, the EVEN
// session (Jan–Jun) with semester 2 — mirroring the backend's
// currentAcademicSession() derivation.
const defaultSemester = (): number => (new Date().getMonth() + 1 >= 7 ? 1 : 2)

const toolbarSelectClass =
  'h-10 w-full appearance-none rounded-xl border border-white/10 bg-surface-100 pl-9 pr-9 text-sm font-medium text-white outline-none transition-all hover:border-white/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/25'

export default function TimetablePage() {
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<number>(defaultSemester())
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false)
  const [showConflictsModal, setShowConflictsModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

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
  const { data: timetable, isLoading, refetch } = useQuery<TimetableResponse | null>({
    queryKey: ['timetable', activeSection?.id, selectedSemester],
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

  // ── Generator Mutations ─────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDept?.id || !activeSection?.id) return
      const res = await timetableApi.generateTimetable({
        departmentId: selectedDept.id,
        sectionId: activeSection.id,
        semester: selectedSemester,
      })
      return res.data.data
    },
    onSuccess: (data) => {
      refetch()
      setIsGeneratorModalOpen(false)
      showToast(`✨ Timetable generated! Optimization Score: ${data?.optimizationScore || 100}%`)
    },
  })

  const regenerateUnlockedMutation = useMutation({
    mutationFn: async () => {
      if (!timetable?.id) return
      const res = await timetableApi.regenerateUnlockedSlots(timetable.id)
      return res.data.data
    },
    onSuccess: (data) => {
      refetch()
      showToast(`⚡ Unlocked slots regenerated! New Optimization Score: ${data?.optimizationScore || 100}%`)
    },
  })

  const toggleLockMutation = useMutation({
    mutationFn: (entryId: number) => timetableApi.toggleSlotLock(entryId),
    onSuccess: () => {
      refetch()
      showToast('🔒 Slot lock status updated')
    },
  })

  // ── Fetch Slot Master (grid column source of truth) ──────────────
  const { data: timeSlotData } = useQuery<TimeSlot[]>({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data?.data || []
    },
  })

  // Column source of truth: every non-break TimeSlot from the master, ordered
  // by slotOrder, so empty/broken periods stay visible as their own column.
  // Break/lunch slots stay excluded from the grid.
  const masterColumns: TimeSlot[] = (timeSlotData ?? [])
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
  const useMasterSlots = masterColumns.length > 0

  // Grid columns: master slots labelled with their live start/end times
  // (`HH:mm:ss - HH:mm:ss`); falls back to the distinct entry times (already
  // `HH:mm - HH:mm`) when the master list is unavailable.
  const columns: { key: string; label: string }[] = useMasterSlots
    ? masterColumns.map((ts) => ({
        key: String(ts.id),
        label: `${ts.startTime} - ${ts.endTime}`,
      }))
    : Array.from(new Set(timetable?.entries?.map((e: TimetableEntryDto) => e.timeSlotTime) || []))
        .sort()
        .map((t) => ({ key: t, label: t }))

  // Group entries by day & slot identity (master slot id, or the entry's own
  // time label in the masterless fallback) so cells match columns exactly.
  const entryMap = new Map<string, TimetableEntryDto>()
  timetable?.entries?.forEach((e: TimetableEntryDto) => {
    entryMap.set(`${e.dayOfWeek}_${useMasterSlots ? e.timeSlotId : e.timeSlotTime}`, e)
  })

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
          <h1 className="page-title">AI Timetable Generator & Scheduler</h1>
          <p className="page-subtitle">Generate conflict-free section schedules powered by CSP Constraint Backtracking Solver</p>
        </div>
        <div className="flex items-center gap-3">
          {timetable && (
            <button
              onClick={() => regenerateUnlockedMutation.mutate()}
              disabled={regenerateUnlockedMutation.isPending}
              className="btn-secondary"
            >
              {regenerateUnlockedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-brand-400" />}
              Regenerate Unlocked
            </button>
          )}
          <button onClick={() => setIsGeneratorModalOpen(true)} className="btn-primary">
            <Sparkles className="w-4 h-4" /> Run AI Generator
          </button>
        </div>
      </div>

      {/* ── Department / Section / Semester Selector Controls ── */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-60">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <select
              className={toolbarSelectClass}
              value={selectedDeptId || selectedDept?.id || ''}
              onChange={(e) => {
                setSelectedDeptId(Number(e.target.value))
                setSelectedYearId(null)
                setSelectedSectionId(null)
              }}
            >
              {deptData?.map((d) => (
                <option key={d.id} value={d.id} className="bg-surface-100 text-white">{d.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative w-36">
            <Layers className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <select
              className={toolbarSelectClass}
              value={selectedYearId || selectedYear?.id || ''}
              onChange={(e) => {
                setSelectedYearId(Number(e.target.value))
                setSelectedSectionId(null)
              }}
            >
              {availableYears.map((y) => (
                <option key={y.id} value={y.id} className="bg-surface-100 text-white">{y.yearLabel}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative w-32">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <select
              className={toolbarSelectClass}
              value={selectedSectionId || activeSection?.id || ''}
              onChange={(e) => setSelectedSectionId(Number(e.target.value))}
            >
              {availableSections.map((s) => (
                <option key={s.id} value={s.id} className="bg-surface-100 text-white">Sec {s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative w-36">
            <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
            <select
              className={toolbarSelectClass}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem} className="bg-surface-100 text-white">Semester {sem}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* ── Schedule Metrics Badges ── */}
        {timetable && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                🎯 Optimization Score: {timetable.optimizationScore || 100}%
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
      </div>

      {/* ── Timetable Grid Display ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : !timetable || timetable.entries?.length === 0 ? (
        <div className="card py-20 text-center space-y-3">
          <Calendar className="w-16 h-16 text-brand-500/30 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Timetable Generated Yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Click "Run AI Generator" to produce an optimized, conflict-free weekly schedule for Section {activeSection?.name || 'A'}.
          </p>
          <button onClick={() => setIsGeneratorModalOpen(true)} className="btn-primary mt-2">
            <Sparkles className="w-4 h-4" /> Run AI Generator Engine
          </button>
        </div>
      ) : (
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
                      <td key={col.key} className="p-1 border border-white/5 relative group">
                        <div
                          className={`px-2 py-1.5 rounded-md space-y-0.5 transition-all relative ${
                            isLab
                              ? 'bg-purple-500/15 border border-purple-500/30'
                              : 'bg-brand-500/15 border border-brand-500/30'
                          } ${entry.isLocked ? 'ring-1 ring-amber-400/50' : ''}`}
                        >
                          {/* Lock / Unlock Toggle Icon */}
                          <button
                            onClick={() => toggleLockMutation.mutate(entry.id)}
                            title={entry.isLocked ? 'Unlock Slot' : 'Lock Slot'}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/40 text-gray-400 hover:text-amber-400 transition-all"
                          >
                            {entry.isLocked ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5 text-gray-500 hover:text-white" />}
                          </button>

                          <div className="flex items-center gap-1 pr-4">
                            <span className="font-bold text-[11px] text-white">{entry.subjectCode}</span>
                            <span className={`text-[9px] px-1 py-px rounded font-semibold ${isLab ? 'bg-purple-500/30 text-purple-200' : 'bg-brand-500/30 text-brand-200'}`}>
                              {isLab ? 'LAB' : 'THEORY'}
                            </span>
                          </div>

                          <div className="text-[10px] font-medium text-gray-200 truncate">{entry.subjectName}</div>
                          <div className="text-[9px] text-gray-400 flex items-center gap-1"><User className="w-2.5 h-2.5 text-brand-400" /> {entry.facultyName}</div>
                          <div className="text-[9px] text-gray-400 flex items-center gap-1"><Building2 className="w-2.5 h-2.5 text-emerald-400" /> {entry.roomName || `Room ${entry.roomNumber}`}</div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Generator Trigger Modal ── */}
      {isGeneratorModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsGeneratorModalOpen(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" /> Execute AI Generator
              </h3>
              <button onClick={() => setIsGeneratorModalOpen(false)} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-surface-100 border border-white/10 space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Target Department:</span>
                  <strong className="text-white">{selectedDept?.name}</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Target Section:</span>
                  <strong className="text-white">Section {activeSection?.name}</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Semester:</span>
                  <strong className="text-white">Semester {selectedSemester}</strong>
                </div>
              </div>

              <p className="text-gray-400 leading-relaxed">
                The CSP Engine will evaluate 20 hard and soft constraint rules including zero faculty/room double-booking, consecutive lab period blocks, faculty leave schedules, and capacity matching.
              </p>

              <div className="form-footer">
                <button onClick={() => setIsGeneratorModalOpen(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="btn-primary"
                >
                  {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Run Generator Engine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Conflicts Report Modal ── */}
      {showConflictsModal && timetable && (
        <div className="modal-backdrop" onClick={() => setShowConflictsModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 text-red-400">
                <ShieldAlert className="w-5 h-5" /> Conflict Analysis Report
              </h3>
              <button onClick={() => setShowConflictsModal(false)} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {timetable.conflicts?.map((conf) => (
                <div key={conf.id} className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-300 uppercase">{conf.conflictType}</span>
                    <span className="badge badge-danger">{conf.severity} SEVERITY</span>
                  </div>
                  <p className="text-xs text-gray-300">{conf.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
