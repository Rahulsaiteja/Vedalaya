import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { Card, PrimaryButton, Select, TextInput } from '../ui/form.jsx'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, verifyOtp, resendOtp } = useAuth()
  
  const [step, setStep] = useState(1) // 1: Register, 2: OTP Verification
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  
  const [otp, setOtp] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onRegisterSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await register({ name, email, password, role })
      setStep(2)
      setMessage('OTP has been sent to your email. (Check backend logs for Ethereal URL)')
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  async function onVerifySubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await verifyOtp({ email, otp })
      if (role === 'teacher') {
        // Teachers need admin approval — don't navigate to app
        setStep(3)
      } else {
        navigate('/app', { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Verification failed')
    } finally {
      setBusy(false)
    }
  }
  
  async function handleResendOtp() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await resendOtp({ email })
      setMessage('A new OTP has been sent. (Check backend logs)')
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to resend OTP')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto mt-8">
      {/* Left side: Graphic */}
      <div className="hidden md:flex flex-col items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-emerald-100/50 rounded-full blur-3xl -z-10" />
        <img src="/3d_study_books.png" alt="Study Books" className="w-[320px] drop-shadow-2xl floating-animation-slow" />
      </div>

      {/* Right side: Form */}
      <div>
        <Card>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-emerald-900 tracking-tight">
              {step === 1 ? 'Create account' : 'Verify your email'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              {step === 1 ? 'Start your learning journey today.' : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={onRegisterSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </Select>
              </div>

              {role === 'teacher' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>⏳ Teacher accounts require admin approval.</strong><br />
                  <span className="text-xs">After verifying your email, your account will be reviewed. You'll be able to log in once approved.</span>
                </div>
              )}
              
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              
              <TextInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />

              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

              <div className="pt-4">
                <PrimaryButton type="submit" disabled={busy} className="w-full">
                  {busy ? 'CREATING ACCOUNT…' : 'REGISTER'}
                </PrimaryButton>
              </div>

              <div className="text-center pt-4">
                <span className="text-sm text-slate-500 font-medium">Already have an account? </span>
                <Link to="/login" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 underline decoration-2 underline-offset-4">
                  Sign in
                </Link>
              </div>
            </form>
          ) : step === 3 ? (
            /* Teacher pending approval screen */
            <div className="space-y-6 text-center py-4">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-4xl">⏳</div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Account Pending Approval</h3>
                <p className="mt-2 text-sm text-slate-500">Your email has been verified. An admin will review and approve your teacher account shortly.</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 text-left">
                ✅ Email verified: <strong>{email}</strong>
              </div>
              <Link to="/login" className="inline-block rounded-full bg-emerald-800 px-6 py-2.5 text-xs font-bold tracking-widest text-white hover:bg-emerald-700 transition-colors uppercase">
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={onVerifySubmit} className="space-y-6">
              <TextInput
                label="One-Time Password"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                minLength={6}
                pattern="\d{6}"
                placeholder="123456"
              />
              
              {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 font-medium">{message}</div>}
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-medium">{error}</div>}

              <div className="pt-2">
                <PrimaryButton type="submit" disabled={busy || otp.length !== 6} className="w-full mb-4">
                  {busy ? 'VERIFYING…' : 'VERIFY OTP'}
                </PrimaryButton>
                
                <div className="text-center">
                  <button 
                    type="button" 
                    onClick={handleResendOtp}
                    disabled={busy}
                    className="text-sm font-bold text-slate-500 hover:text-emerald-700 underline decoration-2 underline-offset-4"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
