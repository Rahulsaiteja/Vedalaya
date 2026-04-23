import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setAuthToken } from '../utils/api.js'

const AuthContext = createContext(null)

function readStoredAuth() {
  try {
    const raw = localStorage.getItem('vedalaya_auth')
    if (!raw) return { token: null, user: null }
    return JSON.parse(raw)
  } catch {
    return { token: null, user: null }
  }
}

export function AuthProvider({ children }) {
  const stored = readStoredAuth()
  const [token, setToken] = useState(stored.token)
  const [user, setUser] = useState(stored.user)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthToken(token)
    try {
      localStorage.setItem('vedalaya_auth', JSON.stringify({ token, user }))
    } catch {
      // ignore storage errors
    }
  }, [token, user])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        if (!token) {
          if (!cancelled) setLoading(false)
          return
        }
        const res = await api.get('/auth/me')
        if (!cancelled) setUser(res.data.user)
      } catch {
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthed: Boolean(token && user),
      async login({ email, password }) {
        const res = await api.post('/auth/login', { email, password })
        setToken(res.data.token)
        setUser(res.data.user)
        return res.data.user
      },
      async register({ name, email, password, role }) {
        const res = await api.post('/auth/register', { name, email, password, role })
        return res.data
      },
      async verifyOtp({ email, otp }) {
        const res = await api.post('/auth/verify-otp', { email, otp })
        setToken(res.data.token)
        setUser(res.data.user)
        return res.data.user
      },
      async resendOtp({ email }) {
        const res = await api.post('/auth/resend-otp', { email })
        return res.data
      },
      logout() {
        setToken(null)
        setUser(null)
      },
    }),
    [token, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

