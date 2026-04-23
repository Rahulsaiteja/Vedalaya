import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

export function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadScholarships() {
      try {
        const res = await api.get('/scholarships')
        setScholarships(res.data.scholarships || [])
      } catch (err) {
        setError(err?.response?.data?.error?.message || 'Failed to fetch scholarships')
      } finally {
        setLoading(false)
      }
    }
    loadScholarships()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center text-rose-800 backdrop-blur-sm shadow-sm transition-all">
        <h2 className="text-xl font-bold tracking-tight mb-2">Oops! Something went wrong</h2>
        <p className="text-sm opacity-80">{error}</p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-emerald-800 to-teal-900 px-8 py-16 shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 drop-shadow-md">
            Unlock Your Potential with Scholarships
          </h1>
          <p className="text-lg text-emerald-100/90 font-medium max-w-2xl mx-auto drop-shadow-sm">
            Explore carefully curated financial aid opportunities tailored for school students. Don't let anything hold you back from your dreams.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scholarships.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-lg font-medium">
            No scholarships available at the moment. Please check back later!
          </div>
        ) : (
          scholarships.map((scholarship) => (
            <div
              key={scholarship.id}
              className="group relative flex flex-col justify-between rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:ring-emerald-200"
            >
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-emerald-400 to-indigo-500 opacity-0 blur transition group-hover:opacity-20"></div>
              
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold tracking-widest text-emerald-700 uppercase ring-1 ring-emerald-600/10">
                    {scholarship.category || 'General'}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    Deadline: {new Date(scholarship.deadline).toLocaleDateString()}
                  </span>
                </div>
                
                <h3 className="mb-2 text-xl font-bold text-slate-800 leading-snug group-hover:text-emerald-700 transition-colors">
                  {scholarship.title}
                </h3>
                
                <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-3">
                  {scholarship.description}
                </p>

                <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                  <div className="flex items-start text-sm">
                    <span className="font-semibold text-slate-700 w-24 shrink-0">Eligibility:</span>
                    <span className="text-slate-600">{scholarship.eligibility}</span>
                  </div>
                  <div className="flex items-start text-sm">
                    <span className="font-semibold text-slate-700 w-24 shrink-0">Amount:</span>
                    <span className="text-emerald-700 font-bold">{scholarship.amount}</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-auto pt-4 border-t border-slate-50">
                <a
                  href={scholarship.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold tracking-widest text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-emerald-200/50 focus:outline-none focus:ring-4 focus:ring-emerald-100 uppercase"
                >
                  Apply Now
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
