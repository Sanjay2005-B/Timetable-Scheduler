import { useQuery } from '@tanstack/react-query'
import { BookMarked, Loader2, AlertTriangle, Clock, BookOpen, Building2, Layers } from 'lucide-react'
import { subjectApi, SubjectResponse } from '@/api/subjectApi'

export default function MySubjectsPage() {
  const { data: subjects, isLoading, isError } = useQuery<SubjectResponse[]>({
    queryKey: ['mySubjects'],
    queryFn: async () => {
      const res = await subjectApi.getMySubjects()
      return res.data?.data || []
    },
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Subjects</h1>
          <p className="page-subtitle">
            The subjects assigned to you for teaching this semester.
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
          <h3 className="text-lg font-bold text-white">Could not load your subjects</h3>
          <p className="text-xs text-gray-400">Please refresh the page or verify the backend is running.</p>
        </div>
      ) : !subjects || subjects.length === 0 ? (
        <div className="card py-20 text-center space-y-3">
          <BookMarked className="w-16 h-16 text-brand-500/30 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Subjects Assigned</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No subjects are currently assigned to you. Contact your department head if you
            expected to see something here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <div key={subject.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{subject.subjectName}</h3>
                  <p className="text-[11px] text-brand-300 font-mono mt-0.5">{subject.subjectCode}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${
                    subject.subjectType === 'LAB'
                      ? 'bg-purple-500/15 border border-purple-500/30 text-purple-200'
                      : 'bg-brand-500/15 border border-brand-500/30 text-brand-200'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  {subject.subjectType === 'LAB' ? 'LAB' : 'THEORY'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-gray-400">
                <p className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  {subject.departmentName || '—'}
                  {subject.sectionName && (
                    <span className="text-gray-500">· Sec {subject.sectionName}</span>
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-brand-400" />
                  Semester {subject.semester}{subject.yearLabel ? ` · ${subject.yearLabel}` : ''}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {subject.theoryHours} hr/wk theory · {subject.practicalHours} hr/wk practical
                  <span className="text-gray-500">· {subject.credits} credits</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}