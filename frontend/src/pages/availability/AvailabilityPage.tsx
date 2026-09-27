import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Save, Loader2, Users, Check, Ban, Star } from 'lucide-react'
import { availabilityApi, AvailabilityDto, TimeSlot } from '@/api/availabilityApi'
import { facultyApi } from '@/api/facultyApi'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export default function AvailabilityPage() {
  const queryClient = useQueryClient()
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null)
  const [matrix, setMatrix] = useState<Record<string, 'PREFERRED' | 'AVAILABLE' | 'BLOCKED'>>({})

  // ── Fetch Faculty List ───────────────────────────────────────────
  const { data: facultyData } = useQuery({
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

  // ── Fetch Time Slots ─────────────────────────────────────────────
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const res = await availabilityApi.getTimeSlots()
      return res.data.data || []
    },
  })

  // ── Fetch Selected Faculty's Availability ───────────────────────
  const { isLoading: isAvailLoading } = useQuery({
    queryKey: ['availability', selectedFacultyId],
    queryFn: async () => {
      if (!selectedFacultyId) return []
      const res = await availabilityApi.getFacultyAvailability(selectedFacultyId)
      const list = res.data.data || []
      const newMatrix: Record<string, 'PREFERRED' | 'AVAILABLE' | 'BLOCKED'> = {}
      list.forEach((item) => {
        newMatrix[`${item.dayOfWeek}_${item.timeSlotId}`] = item.status
      })
      setMatrix(newMatrix)
      return list
    },
    enabled: !!selectedFacultyId,
  })

  // ── Save Availability Mutation ──────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFacultyId || !timeSlots) return
      const payload: AvailabilityDto[] = []
      DAYS.forEach((day) => {
        timeSlots.forEach((slot) => {
          if (!slot.isBreak) {
            const key = `${day}_${slot.id}`
            const status = matrix[key] || 'AVAILABLE'
            payload.push({
              facultyId: selectedFacultyId,
              dayOfWeek: day,
              timeSlotId: slot.id,
              status,
            })
          }
        })
      })
      await availabilityApi.saveFacultyAvailability(selectedFacultyId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', selectedFacultyId] })
    },
  })

  const toggleSlotStatus = (day: string, slotId: number) => {
    const key = `${day}_${slotId}`
    const current = matrix[key] || 'AVAILABLE'
    const nextStatusMap: Record<string, 'PREFERRED' | 'AVAILABLE' | 'BLOCKED'> = {
      AVAILABLE: 'PREFERRED',
      PREFERRED: 'BLOCKED',
      BLOCKED: 'AVAILABLE',
    }
    setMatrix((prev) => ({ ...prev, [key]: nextStatusMap[current] }))
  }

  const selectedFaculty = facultyData?.find((f) => f.id === selectedFacultyId)

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Availability Matrix</h1>
          <p className="page-subtitle">Set preferred, available, and blocked time slots per faculty member</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!selectedFacultyId || saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Preferences
        </button>
      </div>

      {/* Faculty Selector & Legend */}
      <div className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-accent-600" />
          <span className="text-sm font-semibold text-slate-900">Select Faculty:</span>
          <select
            className="input w-auto min-w-[260px]"
            value={selectedFacultyId || ''}
            onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
          >
            {facultyData?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fullName} ({f.employeeId}) · {f.departmentName || 'General'}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-accent-700 font-medium">
            <Star className="w-3.5 h-3.5 fill-accent-600 text-accent-600" /> Preferred
          </span>
          <span className="flex items-center gap-1.5 text-green-600 font-medium">
            <Check className="w-3.5 h-3.5" /> Available
          </span>
          <span className="flex items-center gap-1.5 text-danger font-medium">
            <Ban className="w-3.5 h-3.5" /> Blocked
          </span>
          <span className="text-slate-500 italic">(Click cell to cycle)</span>
        </div>
      </div>

      {/* Interactive Matrix Grid */}
      {isAvailLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        </div>
      ) : (
        /* `table-container` already carries its own border, radius, background
           and overflow — the extra `card` here was a second surface + border. */
        <div className="table-container">
          <table className="table border-collapse">
            <thead>
              <tr>
                <th className="w-32">Day / Slot</th>
                {timeSlots?.map((slot) => (
                  <th key={slot.id} className="text-center min-w-[110px]">
                    <div className="font-bold text-slate-900">{slot.slotLabel || `P${slot.slotOrder}`}</div>
                    <div className="text-[10px] text-slate-600 font-normal">
                      {slot.startTime.substring(0, 5)} - {slot.endTime.substring(0, 5)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <td className="font-bold text-xs text-accent-700 bg-slate-50 uppercase tracking-wider">
                    {day}
                  </td>
                  {timeSlots?.map((slot) => {
                    if (slot.isBreak) {
                      return (
                        <td key={slot.id} className="bg-slate-100/50 text-center text-xs text-slate-500 font-semibold py-4">
                          LUNCH BREAK
                        </td>
                      )
                    }
                    const key = `${day}_${slot.id}`
                    const status = matrix[key] || 'AVAILABLE'

                    return (
                      <td key={slot.id} className="p-1">
                        <button
                          type="button"
                          onClick={() => toggleSlotStatus(day, slot.id)}
                          className={`w-full py-3.5 px-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                            status === 'PREFERRED'
                              ? 'bg-accent-50 border border-accent-200 text-accent-700'
                              : status === 'BLOCKED'
                              ? 'bg-danger/10 border border-danger/30 text-danger'
                              : 'bg-success/10 border border-success/30 text-success hover:bg-success/20'
                          }`}
                        >
                          {status === 'PREFERRED' && <Star className="w-3.5 h-3.5 fill-accent-600" />}
                          {status === 'AVAILABLE' && <Check className="w-3.5 h-3.5" />}
                          {status === 'BLOCKED' && <Ban className="w-3.5 h-3.5" />}
                          {status}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
