import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, PrimaryButton, TextInput } from '../ui/form.jsx'
import { api } from '../utils/api.js'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password reset token. Please request a new link.')
    }
  }, [token])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const res = await api.post('/auth/reset-password', { token, password })
      setMessage(res.data.message || 'Password has been successfully reset.')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid items-center max-w-xl mx-auto mt-16">
      <Card>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">Set New Password</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Please enter your new password below.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <TextInput 
            label="New Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            minLength={8}
          />
          <TextInput 
            label="Confirm Password" 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            required 
            minLength={8}
          />

          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 font-medium">{message}<br/><span className="text-xs mt-1 block">Redirecting to login...</span></div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

          <div className="pt-2">
            <PrimaryButton type="submit" disabled={busy || !token || message} className="w-full">
              {busy ? 'SAVING…' : 'RESET PASSWORD'}
            </PrimaryButton>
          </div>
          
          <div className="text-center pt-4">
            <Link to="/login" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 underline decoration-2 underline-offset-4">
              Back to login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
