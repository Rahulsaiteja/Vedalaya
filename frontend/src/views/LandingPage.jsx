import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export function LandingPage() {
  const { isAuthed } = useAuth()

  if (isAuthed) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="relative min-h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-emerald-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute top-1/2 left-0 w-[40vw] h-[40vw] bg-emerald-50/50 rounded-full blur-3xl -translate-x-1/4" />

      <div className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-slate-50 flex items-center justify-center">

      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-24 flex flex-col-reverse xl:flex-row gap-16 xl:gap-24 items-center justify-between">
        
        {/* Left Side: Typography */}
        <div className="w-full xl:w-5/12 text-center xl:text-left flex flex-col items-center xl:items-start pt-8 xl:pt-12">
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-[#006241] leading-[1.1] mb-6">
            The smartest hour<br className="hidden md:block"/>of the day
          </h1>
          <p className="text-slate-500 max-w-md text-lg font-medium leading-relaxed mb-10">
            Sign up to get exclusive access to thousands of ready-made quizzes and smart flashcards this semester.
          </p>
          <Link to={isAuthed ? "/app" : "/register"} className="inline-block bg-emerald-800 text-white font-bold tracking-widest text-sm px-10 py-5 rounded-full hover:bg-emerald-700 transition-colors shadow-xl">
            START LEARNING
          </Link>
        </div>

        {/* Right Side: Floating Cards */}
        <div className="w-full xl:w-7/12 flex items-center justify-center gap-6 relative mt-16 xl:mt-0">
          
          {/* Card 1 (Left) - Hidden on smaller screens */}
          <div className="hidden md:block w-52 bg-slate-100 rounded-[2rem] p-5 pt-20 relative shadow-sm h-[280px] opacity-80 hover:-translate-y-3 hover:shadow-xl hover:opacity-100 transition-all duration-300 cursor-pointer">
            <img src="/3d_study_notebook.png" alt="Study block" className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 drop-shadow-md" />
            <h3 className="font-bold text-slate-700 text-sm leading-tight text-center mt-2">Intro to Biology<br/>Flashcards</h3>
            <div className="mt-8 text-[11px] text-slate-400 font-medium space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1"><span>Format</span> <span className="text-slate-600">Flashcard</span></div>
              <div className="flex justify-between border-b border-slate-200 pb-1"><span>Difficulty</span> <span className="text-slate-600">Beginner</span></div>
            </div>
          </div>

          {/* Center Card (Hero) */}
          <div className="w-72 sm:w-80 bg-emerald-800 rounded-[2rem] p-6 pt-10 relative shadow-2xl z-20 h-auto min-h-[380px] text-emerald-50 flex flex-col justify-center hover:-translate-y-4 hover:shadow-emerald-900/50 transition-all duration-300 cursor-pointer">
            
            <div className="text-xs font-bold tracking-widest uppercase mb-4 text-emerald-300 text-center">
              Featured Quiz
            </div>

            <h2 className="font-bold text-2xl leading-tight mb-8 text-center">Advanced Math<br/>Calculus Final Mock</h2>
            
            <div className="space-y-4 mb-10 flex-1">
              <div className="flex justify-between items-center border-b border-emerald-700 pb-2 text-sm">
                <span className="font-semibold text-emerald-200 opacity-80">Format</span>
                <span className="text-emerald-50 font-medium">Multiple Choice</span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-700 pb-2 text-sm">
                <span className="font-semibold text-emerald-200 opacity-80">Questions</span>
                <span className="text-emerald-50 font-medium">50 Total</span>
              </div>
            </div>

            <div className="flex justify-center mt-auto">
              <Link to={isAuthed ? "/app" : "/register"} className="inline-block w-[80%] bg-white text-emerald-900 text-center font-bold text-xs tracking-widest py-4 rounded-full hover:bg-emerald-50 transition-colors shadow-md">
                ADD TO DASHBOARD
              </Link>
            </div>
          </div>

          {/* Card 3 (Right) - Hidden on smaller screens */}
          <div className="hidden md:block w-52 bg-slate-100 rounded-[2rem] p-5 pt-20 relative shadow-sm h-[280px] opacity-80 hover:-translate-y-3 hover:shadow-xl hover:opacity-100 transition-all duration-300 cursor-pointer">
            <img src="/3d_study_books.png" alt="Study books" className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 drop-shadow-md" />
            <h3 className="font-bold text-slate-700 text-sm leading-tight text-center mt-2">World History<br/>Practice Test</h3>
            <div className="mt-8 text-[11px] text-slate-400 font-medium space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1"><span>Format</span> <span className="text-slate-600">Quiz</span></div>
              <div className="flex justify-between border-b border-slate-200 pb-1"><span>Difficulty</span> <span className="text-slate-600">Advanced</span></div>
            </div>
          </div>

        </div>

      </div>
    </div>
    </div>
  )
}
