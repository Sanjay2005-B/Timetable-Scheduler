import { useQuery } from '@tanstack/react-query'
import { Calendar, User, Building2, Layers, Loader2, AlertTriangle } from 'lucide-react'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import { useAuthStore } from '@/store/authStore'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Converts any positive integer to its Roman numeral form (1 → I, 4 → IV). */
function toRoman(value: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let remaining = value
  let out = ''
  for (const [amount, symbol] of table) {
    while (remaining >= amount) {
      out += symbol
      remaining -= amount
    }
  }
  return out
}

/**
 * Academic years are stored as free text seeded by the college ("1st Year",
 * "2nd Year", ...), so the display numeral is derived rather than stored: any
 * label carrying a number becomes its Roman numeral ("1st Year" → "I"), a label
 * already written as a numeral is kept ("Year II" → "II"), and anything else is
 * passed through untouched.
 */
function yearToRoman(yearLabel?: string | null): string {
  const trimmed = (yearLabel ?? '').trim()
  if (!trimmed) return ''
  const numeric = trimmed.match(/\d+/)
  if (numeric) {
    const value = parseInt(numeric[0], 10)
    if (Number.isFinite(value) && value > 0) return toRoman(value)
  }
  const roman = trimmed.match(/([IVXLCDM]+)/i)
  if (roman) return roman[1].toUpperCase()
  return trimmed
}

/** The class a timetable belongs to, as DEPARTMENT-YEAR-SECTION (e.g. CSE-I-A). */
function classLabel(timetable: TimetableResponse): string {
  return [timetable.departmentName, yearToRoman(timetable.yearLabel), timetable.sectionName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join('-')
}

export default function MyTimetablePage() {
  const { user } = useAuthStore()
  // The timetable is always requested from the server: identity comes from the
  // JWT, so a stale/absent client-side userId must never suppress the fetch and
  // make a faculty member with real lessons look like they have no timetable.
  const { data: timetables, isLoading, isError } = useQuery<TimetableResponse[]>({
    queryKey: ['myTimetable', user?.userId],
    queryFn: async () => {
      const res = await timetableApi.getMyTimetable()
      return res.data?.data || []
    },
  })

  const { data: timeSlotData } = useQuery<TimeSlot[]>({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data?.data || []
    },
  })

  const masterColumns: TimeSlot[] = (timeSlotData ?? [])
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
  const useMasterSlots = masterColumns.length > 0

  const isFaculty = user?.roles?.includes('ROLE_FACULTY')

  const renderTimetableGrid = (entries: TimetableEntryDto[], gridClass?: string) => {
    const allEntries: TimetableEntryDto[] = entries ?? []
    const columns: { key: string; label: string }[] = useMasterSlots
      ? masterColumns.map((ts) => ({
          key: String(ts.id),
          label: `${ts.startTime} - ${ts.endTime}`,
        }))
      : Array.from(new Set(allEntries.map((e) => e.timeSlotTime) || []))
          .sort()
          .map((t) => ({ key: t, label: t }))

    const entryMap = new Map<string, TimetableEntryDto>()
    allEntries.forEach((e) => {
      entryMap.set(`${e.dayOfWeek}_${useMasterSlots ? e.timeSlotId : e.timeSlotTime}`, e)
    })

    return (
      <div className="card p-5 space-y-4">
        <div className="overflow-x-auto">
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
            {/* Was `divide-y divide-white/5` — invisible on the near-white card. */}
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
                        {/* LAB vs THEORY now mirrors the text badge (LAB =
                            accent, THEORY = neutral) rather than the old
                            near-identical brand-600/15 vs brand-500/15 blues. */}
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
                          {/* Faculty never need their own name on their own
                              timetable — they get the class instead. Students keep
                              the faculty name, which is the useful detail for them. */}
                          {isFaculty ? (
                            <div className="text-[9px] text-slate-600 flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5 text-slate-500" /> {gridClass}
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-600 flex items-center gap-1">
                              <User className="w-2.5 h-2.5 text-slate-500" /> {entry.facultyName}
                            </div>
                          )}
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
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Timetable</h1>
          <p className="page-subtitle">
            {isFaculty
              ? 'Your scheduled teaching hours across all sections.'
              : 'Your weekly class schedule.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        </div>
      ) : isError ? (
        <div className="card">
          <div className="empty-state py-24">
            <AlertTriangle className="w-16 h-16 text-danger/40" />
            <h3 className="empty-state-title">Could not load your timetable</h3>
            <p className="empty-state-desc">Please refresh the page or verify the backend is running.</p>
          </div>
        </div>
      ) : !timetables || timetables.length === 0 ? (
        <div className="card">
          <div className="empty-state py-24">
            <Calendar className="w-16 h-16 text-accent-500/25" />
            <h3 className="empty-state-title">
              {isFaculty ? 'No Timetable Assigned Yet' : 'No Timetable Published Yet'}
            </h3>
            <p className="empty-state-desc">
              {isFaculty
                ? 'No timetable currently contains your teaching sessions.'
                : 'Your section does not have a published timetable yet. Please check back later.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Faculty get one grid per timetable so a subject taught in several
              sections keeps its own DEPARTMENT-YEAR-SECTION label instead of
              being merged into a single grid. Students keep the single merged
              grid they had before. */}
          {isFaculty
            ? (timetables ?? []).map((timetable) => (
                <div key={timetable.id} className="space-y-2">
                  {timetables!.length > 1 && (
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      {classLabel(timetable)}
                      <span className="font-medium normal-case tracking-normal text-slate-500">
                        {' '}· Semester {timetable.semester} · {timetable.academicSession}
                      </span>
                    </div>
                  )}
                  {renderTimetableGrid(timetable.entries ?? [], classLabel(timetable))}
                </div>
              ))
            : renderTimetableGrid((timetables ?? []).flatMap((t) => t.entries ?? []))}
        </div>
      )}
    </div>
  )
}