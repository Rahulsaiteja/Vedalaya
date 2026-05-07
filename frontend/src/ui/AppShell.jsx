import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useLanguage } from '../state/LanguageContext.jsx'
import { api } from '../utils/api.js'

function NavItem({ to, children, end = false, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-full px-4 py-2 text-xs font-bold tracking-widest transition-colors ${
          isActive ? 'bg-emerald-800 text-white' : 'text-slate-500 hover:text-emerald-800 hover:bg-emerald-50'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export function AppShell() {
  const { isAuthed, user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { language, setLanguage, t } = useLanguage()
  // const [isChatOpen, setIsChatOpen] = useState(false)
  // const [question, setQuestion] = useState('')
  // const [chatMessages, setChatMessages] = useState([])
  // const [chatBusy, setChatBusy] = useState(false)
  // const [chatError, setChatError] = useState(null)

  const handleLogout = () => {
    logout()
    setIsMobileMenuOpen(false)
  }

  /*
  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      if (!isAuthed || user?.role !== 'student') return
      try {
        const res = await api.get('/doubts/history')
        if (!cancelled) setChatMessages((res.data.messages || []).reverse())
      } catch {
        // ignore history failures
      }
    }
    loadHistory()
    return () => {
      cancelled = true
    }
  }, [isAuthed, user?.role])

  async function askFromWidget() {
    if (!question.trim()) return
    setChatBusy(true)
    setChatError(null)
    try {
      const q = question.trim()
      setQuestion('')
      const res = await api.post('/doubts/ask', { question: q })
      setChatMessages((prev) => [...prev, res.data.message])
    } catch (err) {
      setChatError(err?.response?.data?.error?.message || 'Failed to get answer')
    } finally {
      setChatBusy(false)
    }
  }
  */

  const LanguageSelector = () => (
    <div className="relative inline-block text-left ml-2 mr-2">
      <select 
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-sm font-bold text-slate-500 bg-transparent hover:text-emerald-800 transition-colors focus:ring-0 uppercase cursor-pointer outline-none appearance-none"
      >
        <option className="text-slate-800 normal-case" value="en">English</option>
        <option className="text-slate-800 normal-case" value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
        <option className="text-slate-800 normal-case" value="hi">हिन्दी (Hindi)</option>
        <option className="text-slate-800 normal-case" value="bn">বাংলা (Bengali)</option>
        <option className="text-slate-800 normal-case" value="te">తెలుగు (Telugu)</option>
        <option className="text-slate-800 normal-case" value="mr">मराठी (Marathi)</option>
        <option className="text-slate-800 normal-case" value="ta">தமிழ் (Tamil)</option>
        <option className="text-slate-800 normal-case" value="ur">اردو (Urdu)</option>
        <option className="text-slate-800 normal-case" value="gu">ગુજરાતી (Gujarati)</option>
        <option className="text-slate-800 normal-case" value="kn">ಕನ್ನಡ (Kannada)</option>
        <option className="text-slate-800 normal-case" value="ml">മലയാളം (Malayalam)</option>
        <option className="text-slate-800 normal-case" value="or">ଓଡ଼ିଆ (Odia)</option>
        <option className="text-slate-800 normal-case" value="as">অসমীয়া (Assamese)</option>
        <option className="text-slate-800 normal-case" value="mai">मैथिली (Maithili)</option>
        <option className="text-slate-800 normal-case" value="kok">कोंकणी (Konkani)</option>
        <option className="text-slate-800 normal-case" value="doi">डोगरी (Dogri)</option>
        <option className="text-slate-800 normal-case" value="sa">संस्कृतम् (Sanskrit)</option>
        <option className="text-slate-800 normal-case" value="ne">नेपाली (Nepali)</option>
        <option className="text-slate-800 normal-case" value="sd">سنڌي (Sindhi)</option>
        <option className="text-slate-800 normal-case" value="ks">کٲشُر (Kashmiri)</option>
        <option className="text-slate-800 normal-case" value="mni">মৈতৈলোন্ (Manipuri)</option>
        <option className="text-slate-800 normal-case" value="sat">ᱥᱟᱱᱛᱟᱲᱤ (Santali)</option>
      </select>
       <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
          <path fillRule="evenodd" d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  )

  const navLinks = (
    <>
      <LanguageSelector />
      {isAuthed && user?.role === 'student' && (
        <>
          <NavItem to="/student" end onClick={() => setIsMobileMenuOpen(false)}>
            {t('dashboard')}
          </NavItem>

          <NavItem to="/flashcards" onClick={() => setIsMobileMenuOpen(false)}>{t('flashcards')}</NavItem>
          <NavItem to="/scholarships" onClick={() => setIsMobileMenuOpen(false)}>{t('scholarships')}</NavItem>
          <NavItem to="/student/attendance" onClick={() => setIsMobileMenuOpen(false)}>{t('attendance')}</NavItem>
          {/* <NavItem to="/doubts" onClick={() => setIsMobileMenuOpen(false)}>Doubt AI</NavItem> */}
        </>
      )}
      {isAuthed && user?.role === 'teacher' && (
        <>
          <NavItem to="/teacher" end onClick={() => setIsMobileMenuOpen(false)}>
            {t('dashboard')}
          </NavItem>

          <NavItem to="/teacher/quizzes/new" onClick={() => setIsMobileMenuOpen(false)}>{t('create_quiz')}</NavItem>
          <NavItem to="/teacher/attendance" onClick={() => setIsMobileMenuOpen(false)}>{t('attendance')}</NavItem>
        </>
      )}
      {isAuthed && user?.role === 'admin' && (
        <>
          <NavItem to="/admin" end onClick={() => setIsMobileMenuOpen(false)}>Admin Panel</NavItem>
        </>
      )}

      {!isAuthed ? (
        <div className="flex items-center gap-4 ml-4">
          <NavLink
            to="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-sm font-bold tracking-widest text-slate-500 hover:text-emerald-800 transition-colors uppercase"
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-full bg-emerald-800 px-6 py-2.5 text-xs font-bold tracking-widest text-white hover:bg-emerald-700 transition-colors shadow-sm uppercase uppercase"
          >
            Register
          </NavLink>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          className="rounded-full bg-slate-100 ml-4 px-5 py-2 text-xs font-bold tracking-widest text-slate-500 hover:bg-slate-200 w-full md:w-auto transition-colors uppercase mt-4 md:mt-0 lg:ml-4"
        >
          {t('logout')}
        </button>
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans backdrop-blur-3xl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100/50 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          
          {/* Logo area */}
          <Link to={isAuthed ? "/app" : "/"} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-800 rounded-full flex items-center justify-center text-white font-bold text-lg">
              VD
            </div>
            <span className="font-bold text-emerald-900 tracking-tight hidden sm:block">Vedalaya</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2 ml-auto">
            {navLinks}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden rounded-full p-2 text-emerald-800 hover:bg-emerald-50 focus:outline-none transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-emerald-100 bg-white px-4 py-4 shadow-lg absolute w-full left-0">
            <nav className="flex flex-col gap-2">
              {navLinks}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      {/*
      {isAuthed && user?.role === 'student' && (
        <button
          type="button"
          title="Open Doubt AI"
          onClick={() => setIsChatOpen((v) => !v)}
          className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg ring-4 ring-emerald-100 transition-transform hover:scale-105 hover:bg-emerald-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h8" />
            <path d="M8 7h8" />
          </svg>
        </button>
      )}

      {isAuthed && user?.role === 'student' && isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
            <div className="font-bold text-emerald-900">Doubt AI</div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <div className="max-h-80 overflow-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-sm text-slate-500">Ask a doubt to get started.</div>
            ) : (
              chatMessages.slice(-8).map((m) => (
                <div key={m._id || m.id} className="space-y-1">
                  <div className="text-xs font-bold tracking-widest text-emerald-700 uppercase">You</div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-slate-800">{m.question}</div>
                  <div className="text-xs font-bold tracking-widest text-indigo-700 uppercase">AI</div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">{m.answer}</div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-emerald-100 p-3">
            {chatError && <div className="mb-2 text-xs text-rose-700">{chatError}</div>}
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    askFromWidget()
                  }
                }}
                placeholder="Type your doubt..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={askFromWidget}
                disabled={chatBusy || !question.trim()}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {chatBusy ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      */}
    </div>
  )
}
