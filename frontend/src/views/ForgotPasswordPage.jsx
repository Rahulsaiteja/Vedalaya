import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'
import { api } from '../utils/api.js'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      setMessage(res.data.message || 'If an account exists, a reset link has been sent.')
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to send reset email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid items-center max-w-xl mx-auto mt-16">
      <Card>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Reset Password</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 font-medium">{message}</div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

          <div className="pt-2">
            <PrimaryButton type="submit" disabled={busy} className="w-full">
              {busy ? 'SENDING LINK…' : 'SEND RESET LINK'}
            </PrimaryButton>
          </div>
          
          <div className="text-center pt-4">
            <span className="text-sm text-slate-500 font-medium">Remember your password? </span>
            <Link to="/login" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 underline decoration-2 underline-offset-4">
              Back to login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
