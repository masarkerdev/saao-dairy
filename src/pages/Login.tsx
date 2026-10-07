import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('Email not confirmed')
          ? 'ইমেইল এখনো যাচাই হয়নি। ইনবক্সের লিংকে ক্লিক করুন।'
          : 'ইমেইল বা পাসওয়ার্ড ভুল।',
      )
    }
  }

  return (
    <div className="card auth">
      <h1>পাক্ষিক ভ্রমণসূচী</h1>
      <p className="muted">উপসহকারী কৃষি কর্মকর্তা — লগইন</p>
      <form onSubmit={onSubmit}>
        <label>ইমেইল
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>পাসওয়ার্ড
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="err">{error}</p>}
        <button disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'লগইন'}</button>
      </form>
      <p className="muted">একাউন্ট নেই? <Link to="/signup">নতুন একাউন্ট খুলুন</Link></p>
    </div>
  )
}
