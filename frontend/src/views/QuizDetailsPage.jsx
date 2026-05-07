import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../utils/api.js'
import { Card, PrimaryButton } from '../ui/form.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'

export function QuizDetailsPage() {
  const { id } = useParams()
  const { t } = useLanguage()
  const [quiz, setQuiz] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const res = await api.get(`/quizzes/${id}`)
      if (!cancelled) setQuiz(res.data.quiz)
    }
    load().catch((err) => {
      if (!cancelled) setError(err?.response?.data?.error?.message || 'Failed to load quiz')
    })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="max-w-3xl mx-auto mt-8">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium mb-6">{error}</div>}
      {!quiz ? (
        <div className="text-slate-400 font-medium text-center py-10 animate-pulse">{t('loading_quiz_details')}</div>
      ) : (
        <Card>
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">{quiz.title}</h2>
              <p className="mt-3 text-lg font-medium text-slate-600">{quiz.description || 'No description provided.'}</p>
              
              <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">{t('questions')}</div>
                  <div className="text-xl font-bold text-slate-800">{quiz.questions?.length || 0}</div>
                </div>
                {quiz.timeLimitSeconds && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3">
                    <div className="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-1">{t('time_limit')}</div>
                    <div className="text-xl font-bold text-emerald-900">
                      {Math.floor(quiz.timeLimitSeconds / 60) > 0 && `${Math.floor(quiz.timeLimitSeconds / 60)}m `}
                      {quiz.timeLimitSeconds % 60 > 0 ? `${quiz.timeLimitSeconds % 60}s` : ''}
                      {quiz.timeLimitSeconds % 60 === 0 && Math.floor(quiz.timeLimitSeconds / 60) === 0 ? '0s' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex justify-center">
              {quiz.attempted ? (
                <div className="text-center">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold tracking-widest text-emerald-800 uppercase">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    {t('quiz_completed')}
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-4 text-center">{t('already_attempted')}</p>
                  <Link to="/student" className="block w-full text-center rounded-full border-2 border-slate-200 px-6 py-3 text-xs font-bold tracking-widest text-slate-600 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors">
                    {t('back_to_dashboard').toUpperCase()}
                  </Link>
                </div>
              ) : (
                <Link to={`/quizzes/${id}/attempt`} className="block w-full md:w-auto">
                  <button className="w-full md:w-auto rounded-full bg-emerald-600 px-8 py-4 text-sm font-bold tracking-widest text-white hover:bg-emerald-500 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-emerald-600/20 active:scale-95 whitespace-nowrap">
                    {t('start_quiz').toUpperCase()}
                  </button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

