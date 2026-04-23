import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export function RequireAuth() {
  const { isAuthed } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireRole({ role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/app" replace />
  return <Outlet />
}

