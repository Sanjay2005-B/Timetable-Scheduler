import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Printer, Users, DoorOpen, FileText, User, Building2, CalendarClock } from 'lucide-react'
import { facultyApi } from '@/api/facultyApi'
import { availabilityApi, TimeSlot } from '@/api/availabilityApi'
import axiosClient from '@/api/axiosClient'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function ReportsPage() {
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null)

  const { data: facultyList } = useQuery({
    queryKey: ['faculty'],
    queryFn: async () => {
      const res = await facultyApi.getFaculty({ size: 100 })
      const list = res.data.data?.content || []
      if (list.length > 0 && selectedFacultyId === null) {
        setSelectedFacultyId(list[0].id)
      }
      return list
    },
  })

  const { data: facultyReport } = useQuery({
    queryKey: ['facultyReport', selectedFacultyId],
    queryFn: async () => {
      if (!selectedFacultyId) return null
      const res = await axiosClient.get(`/reports/faculty/${selectedFacultyId}`)
      return res.data.data
    },
    enabled: !!selectedFacultyId,
  })

  const { data: timeSlotData } = useQuery<TimeSlot[]>({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data?.data || []
    },
  })

  // Grid columns come from the TimeSlot master (same pattern as TimetablePage):
  // break/lunch slots excluded, sorted by slotOrder, labelled with their times.
  const columns: { key: string; label: string }[] = (timeSlotData ?? [])
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0))
    .map((ts) => ({
      key: String(ts.id),
      label: `${ts.startTime} - ${ts.endTime}`,
    }))

  // Group the faculty's entries by day & slot identity so cells match columns.
  const entryMap = new Map<string, any>()
  facultyReport?.entries?.forEach((e: any) => {
    entryMap.set(`${e.day}_${e.timeSlotId}`, e)
  })

  const { data: roomReport } = useQuery({
    queryKey: ['roomReport'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/rooms/utilization')
      return res.data.data
    },
  })

  return (
    <div className="space-y-3">
      <div className="page-header">
        <div>
          <h1 className="page-title">Report & Analytics Centre</h1>
          <p className="page-subtitle">Export faculty workload, timetable schedules, and classroom utilization reports</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary">
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm bg-accent-50 text-accent-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{facultyList?.length || 0}</p>
            <p className="text-xs text-slate-600">Total Faculty Members</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm bg-green-100 text-green-600 flex items-center justify-center">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{roomReport?.totalRooms || 0}</p>
            <p className="text-xs text-slate-600">Available Classrooms</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm bg-teal-100 text-teal-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">100%</p>
            <p className="text-xs text-slate-600">Timetable Accuracy Rate</p>
          </div>
        </div>
      </div>

      {/* Faculty Individual Schedule Report */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-600" /> Faculty Schedule Report
          </h3>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">Faculty:</span>
            <select
              className="input w-auto min-w-[240px]"
              value={selectedFacultyId || ''}
              onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
            >
              {facultyList?.map((f) => (
                <option key={f.id} value={f.id}>{f.fullName} ({f.employeeId})</option>
              ))}
            </select>
          </div>
        </div>

        {facultyReport ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-line p-3 rounded-sm">
              <span>Assigned Total Weekly Periods: <strong className="text-slate-900 text-sm">{facultyReport.assignedPeriodsCount} periods</strong></span>
              <span>Faculty: <strong className="text-accent-700">{facultyReport.faculty}</strong></span>
            </div>

            {columns.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Time slot master is unavailable — cannot render the weekly grid.
              </p>
            ) : (
              /* Was `card overflow-x-auto p-4` nested inside a `card` parent — a
                 double surface. The parent card already supplies the padding. */
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
                                <span className="text-slate-500 italic">FREE</span>
                              </td>
                            )
                          }
                          const isLab = entry.isLab
                          return (
                            <td key={col.key} className="p-1 border border-line relative group">
                              {/* LAB vs THEORY now mirrors the text badge (LAB =
                                  accent, THEORY = neutral) rather than the old
                                  near-identical brand-600/15 vs brand-500/15 blues. */}
                              <div
                                className={`px-2 py-1.5 rounded-sm space-y-0.5 transition-all ${
                                  isLab
                                    ? 'bg-accent-50 border border-accent-200'
                                    : 'bg-slate-50 border border-line'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-[11px] text-slate-900">{entry.subjectCode}</span>
                                  <span className={`text-[9px] px-1 py-px rounded font-semibold ${isLab ? 'bg-accent-50 text-accent-700' : 'bg-slate-200 text-slate-700'}`}>
                                    {isLab ? 'LAB' : 'THEORY'}
                                  </span>
                                </div>
                                <div className="text-[10px] font-medium text-slate-700 truncate">{entry.subjectName}</div>
                                <div className="text-[9px] text-slate-600 flex items-center gap-1">
                                  {/* `text-lavender-500` was an UNDEFINED utility (dead
                                      class) and rendered as no colour at all. */}
                                  <User className="w-2.5 h-2.5 text-slate-500" /> {entry.yearLabel} Sec {entry.sectionName}
                                </div>
                                <div className="text-[9px] text-slate-600 flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 text-green-600" /> {entry.roomNumber}
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
            )}

            {!facultyReport.entries || facultyReport.entries.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center flex items-center justify-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> No scheduled periods found for this faculty member yet.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">Select a faculty member above to view their schedule report.</p>
        )}
      </div>
    </div>
  )
}
