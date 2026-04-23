import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function StudentDashboard() {
  const [quizzes, setQuizzes] = useState([])
  const [attempts, setAttempts] = useState([])
  const [error, setError] = useState(null)
  const { t } = useLanguage()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      try {
        const [qRes, aRes] = await Promise.all([api.get('/quizzes'), api.get('/attempts/me')])
        if (cancelled) return
        setQuizzes(qRes.data.quizzes || [])
        setAttempts(aRes.data.attempts || [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load dashboard')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="grid gap-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{t('student_dashboard')}</h2>
        <p className="mt-2 text-slate-500 font-medium">{t('student_dashboard_subtitle')}</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lectures Card */}
        <Link to="/lectures" className="block rounded-2xl border-2 border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 hover:border-emerald-300 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900 group-hover:text-emerald-700">{t('lectures')}</h3>
              <p className="mt-1 text-emerald-800/70 font-medium">Watch video lectures and study materials.</p>
            </div>
          </div>
        </Link>

        {/* Results Card */}
        <Link to="/results" className="block rounded-2xl border-2 border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 hover:border-indigo-300 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-indigo-900 group-hover:text-indigo-700">{t('results_title') || 'My Results'}</h3>
              <p className="mt-1 text-indigo-800/70 font-medium">View your quiz scores and attempt history.</p>
            </div>
          </div>
        </Link>
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-emerald-900">{t('available_quizzes')}</h3>
          </div>
          <div className="space-y-4">
            {quizzes.length === 0 ? (
              <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">{t('no_published_quizzes')}</div>
            ) : (
              quizzes.map((q) => (
                <Link
                  key={q._id}
                  to={`/quizzes/${q._id}`}
                  className="block rounded-xl border-2 border-slate-100 bg-slate-50 p-5 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors group"
                >
                  <div className="font-bold text-slate-700 group-hover:text-emerald-800 transition-colors">{q.title}</div>
                  <div className="mt-2 text-sm text-slate-500 font-medium line-clamp-2">{q.description || t('no_description')}</div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-700 uppercase">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {q.timeLimitSeconds}{t('seconds_time_limit')}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-emerald-900">{t('recent_attempts')}</h3>
          </div>
          <div className="space-y-4">
            {attempts.length === 0 ? (
              <div className="text-sm font-medium text-slate-400 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">{t('no_attempts_recent')}</div>
            ) : (
              attempts.slice(0, 8).map((a) => (
                <div key={a._id} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-5 flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="font-bold text-slate-700">{a.quiz?.title || t('quiz')}</div>
                    <div className="mt-1 text-xs font-medium text-slate-400">
                      {new Date(a.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">{t('score_uppercase')}</span>
                    <span className="font-bold text-emerald-600">{a.score}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

