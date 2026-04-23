import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './state/LanguageContext.jsx'
import { useAuth } from './state/AuthContext.jsx'
import { AppShell } from './ui/AppShell.jsx'
import { RequireAuth, RequireRole } from './ui/guards.jsx'
import Chatbot from "./components/Chatbot";

const LandingPage = lazy(() => import('./views/LandingPage.jsx').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('./views/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./views/RegisterPage.jsx').then(m => ({ default: m.RegisterPage })))
const StudentDashboard = lazy(() => import('./views/StudentDashboard.jsx').then(m => ({ default: m.StudentDashboard })))
const TeacherDashboard = lazy(() => import('./views/TeacherDashboard.jsx').then(m => ({ default: m.TeacherDashboard })))
const QuizAttemptPage = lazy(() => import('./views/QuizAttemptPage.jsx').then(m => ({ default: m.QuizAttemptPage })))
const QuizDetailsPage = lazy(() => import('./views/QuizDetailsPage.jsx').then(m => ({ default: m.QuizDetailsPage })))
const StudentResultsPage = lazy(() => import('./views/StudentResultsPage.jsx').then(m => ({ default: m.StudentResultsPage })))
const FlashcardsPage = lazy(() => import('./views/FlashcardsPage.jsx').then(m => ({ default: m.FlashcardsPage })))
const TeacherQuizBuilderPage = lazy(() => import('./views/TeacherQuizBuilderPage.jsx').then(m => ({ default: m.TeacherQuizBuilderPage })))
const TeacherQuizAnalyticsPage = lazy(() => import('./views/TeacherQuizAnalyticsPage.jsx').then(m => ({ default: m.TeacherQuizAnalyticsPage })))
const TeacherLecturesPage = lazy(() => import('./views/TeacherLecturesPage.jsx').then(m => ({ default: m.TeacherLecturesPage })))
const StudentLecturesPage = lazy(() => import('./views/StudentLecturesPage.jsx').then(m => ({ default: m.StudentLecturesPage })))

const ScholarshipsPage = lazy(() => import('./views/ScholarshipsPage.jsx').then(m => ({ default: m.ScholarshipsPage })))
const TeacherTrainingDataPage = lazy(() => import('./views/TeacherTrainingDataPage.jsx').then(m => ({ default: m.TeacherTrainingDataPage })))
const AttendancePage = lazy(() => import('./views/AttendancePage.jsx').then(m => ({ default: m.AttendancePage })))
const AdminDashboard = lazy(() => import('./views/AdminDashboard.jsx').then(m => ({ default: m.AdminDashboard })))

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-slate-300">Loading…</div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen grid place-items-center">
        <div className="text-slate-300">Loading…</div>
      </div>
    }>
      <LanguageProvider>
        <>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route element={<RequireAuth />}>
                <Route
                  path="/app"
                  element={
                    user?.role === 'admin' ? (
                      <Navigate to="/admin" replace />
                    ) : user?.role === 'teacher' ? (
                      <Navigate to="/teacher" replace />
                    ) : user?.role === 'student' ? (
                      <Navigate to="/student" replace />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  }
                />

                <Route element={<RequireRole role="student" />}>
                  <Route path="/student" element={<StudentDashboard />} />

                  <Route path="/results" element={<StudentResultsPage />} />
                  <Route path="/quizzes/:id" element={<QuizDetailsPage />} />
                  <Route path="/quizzes/:id/attempt" element={<QuizAttemptPage />} />
                  <Route path="/flashcards" element={<FlashcardsPage />} />
                  <Route path="/lectures" element={<StudentLecturesPage />} />
                  <Route path="/scholarships" element={<ScholarshipsPage />} />
                  <Route path="/student/attendance" element={<AttendancePage />} />
                </Route>

                <Route element={<RequireRole role="teacher" />}>
                  <Route path="/teacher" element={<TeacherDashboard />} />
                  <Route path="/teacher/quizzes/new" element={<TeacherQuizBuilderPage mode="create" />} />
                  <Route path="/teacher/quizzes/:id/edit" element={<TeacherQuizBuilderPage mode="edit" />} />
                  <Route path="/teacher/quizzes/:id/analytics" element={<TeacherQuizAnalyticsPage />} />
                  <Route path="/teacher/lectures" element={<TeacherLecturesPage />} />
                  <Route path="/teacher/training" element={<TeacherTrainingDataPage />} />
                  <Route path="/teacher/attendance" element={<AttendancePage />} />
                </Route>

                <Route element={<RequireRole role="admin" />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>

          {/* ✅ CHATBOT ADDED HERE (GLOBAL) */}
          <Chatbot />

        </>
      </LanguageProvider>
    </Suspense>
  )
}