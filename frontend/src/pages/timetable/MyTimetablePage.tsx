import { useQuery } from '@tanstack/react-query'
import { Calendar, User, Building2, Loader2, AlertTriangle } from 'lucide-react'
import { timetableApi, TimetableResponse, TimetableEntryDto } from '@/api/timetableApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import { useAuthStore } from '@/store/authStore'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function MyTimetablePage() {
  const { user } = useAuthStore()
  const timetableUserId = user?.userId
  console.log('[MyTimetable] render - userId:', timetableUserId, 'roles:', user?.roles)
  const { data: timetables, isLoading, isError } = useQuery<TimetableResponse[]>({
    queryKey: ['myTimetable', timetableUserId],
    queryFn: async () => {
      console.log('[MyTimetable] queryFn executing - userId:', timetableUserId)
      const res = await timetableApi.getMyTimetable()
      console.log('[MyTimetable] queryFn response - status:', res.status, 'data keys:', res.data?.data?.length || 0)
      return res.data?.data || []
    },
    enabled: !!timetableUserId,
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

  const renderCombinedTimetable = () => {
    const allEntries: TimetableEntryDto[] = (timetables ?? []).flatMap((t) => t.entries ?? [])
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : isError ? (
        <div className="card py-20 text-center space-y-3">
          <AlertTriangle className="w-16 h-16 text-danger/40 mx-auto" />
          <h3 className="text-lg font-bold text-white">Could not load your timetable</h3>
          <p className="text-xs text-gray-400">Please refresh the page or verify the backend is running.</p>
        </div>
      ) : !timetables || timetables.length === 0 ? (
        <div className="card py-20 text-center space-y-3">
          <Calendar className="w-16 h-16 text-brand-500/30 mx-auto" />
          <h3 className="text-lg font-bold text-white">
            {isFaculty ? 'No Timetable Assigned Yet' : 'No Timetable Published Yet'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {isFaculty
              ? 'No timetable currently contains your teaching sessions.'
              : 'Your section does not have a published timetable yet. Please check back later.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderCombinedTimetable()}
        </div>
      )}
    </div>
  )
}