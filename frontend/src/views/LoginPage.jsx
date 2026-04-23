import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login({ email, password })
      navigate('/app', { replace: true })
    } catch (err) {
      if (err?.response?.data?.error?.needsVerification) {
        setError('Email not verified. Please register again to re-send OTP.')
      } else {
        setError(err?.response?.data?.error?.message || 'Login failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto mt-8">
      {/* Left side: Graphic */}
      <div className="hidden md:flex flex-col items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-emerald-100/50 rounded-full blur-3xl -z-10" />
        <img src="/3d_study_brain.png" alt="Study Brain" className="w-[300px] drop-shadow-2xl animate-float" />
      </div>

      {/* Right side: Form */}
      <div>
        <Card>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 font-medium">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

            <div className="pt-2">
              <PrimaryButton type="submit" disabled={busy} className="w-full">
                {busy ? 'LOGGING IN…' : 'LOGIN'}
              </PrimaryButton>
            </div>
            
            <div className="text-center pt-4">
              <span className="text-sm text-slate-500 font-medium">Don't have an account? </span>
              <Link to="/register" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 underline decoration-2 underline-offset-4">
                Sign up
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

