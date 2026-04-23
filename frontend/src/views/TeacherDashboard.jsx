import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card, PrimaryButton } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState([])
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const { t } = useLanguage()

  async function load() {
    setError(null)
    const res = await api.get('/quizzes')
    setQuizzes(res.data.quizzes || [])
  }

  useEffect(() => {
    let cancelled = false
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load quizzes')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function togglePublish(q) {
    setBusyId(q._id)
    setError(null)
    try {
      if (q.status === 'published') await api.post(`/quizzes/${q._id}/unpublish`)
      else await api.post(`/quizzes/${q._id}/publish`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('teacher_dashboard')}</h2>
          <p className="mt-2 text-slate-500 font-medium">Create quizzes, publish, and track attempts.</p>
        </div>
        <Link to="/teacher/quizzes/new">
          <PrimaryButton>{t('create_quiz')}</PrimaryButton>
        </Link>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lectures Card */}
        <Link to="/teacher/lectures" className="block rounded-2xl border-2 border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 hover:border-emerald-300 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900 group-hover:text-emerald-700">{t('lectures')}</h3>
              <p className="mt-1 text-emerald-800/70 font-medium">Upload video lectures and manage materials.</p>
            </div>
          </div>
        </Link>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-emerald-900">Your quizzes</h3>
        </div>
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">No quizzes yet.</div>
          ) : (
            quizzes.map((q) => (
              <div key={q._id} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex items-start justify-between gap-3 w-full md:w-auto flex-1">
                  <div>
                    <div className="font-bold text-slate-700">{q.title}</div>
                    <div className="mt-1 text-sm text-slate-500 font-medium line-clamp-2">{q.description || 'No description provided'}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      {q.timeLimitSeconds}s TIME LIMIT
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase ${
                      q.status === 'published' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-4">
                    <Link
                      to={`/teacher/quizzes/${q._id}/edit`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-sm transition-colors flex-1 md:flex-none text-center"
                    >
                      Edit
                    </Link>
                    <Link
                      to={`/teacher/quizzes/${q._id}/analytics`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-sm transition-colors flex-1 md:flex-none text-center"
                    >
                      Analytics
                    </Link>
                    <button
                      onClick={() => togglePublish(q)}
                      disabled={busyId === q._id}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors flex-1 md:flex-none"
                    >
                      {busyId === q._id ? 'Updating…' : q.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

