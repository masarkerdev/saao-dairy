import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout, { Field } from '../components/AuthLayout'
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
      setError(error.message.includes('Email not confirmed')
        ? 'ইমেইল এখনো যাচাই হয়নি। ইনবক্সের লিংকে ক্লিক করুন।'
        : 'ইমেইল বা পাসওয়ার্ড মেলেনি। আবার দেখে লিখুন।')
    }
  }

  return (
    <AuthLayout title="লগইন করুন" subtitle="আপনার ইমেইল ও পাসওয়ার্ড দিন">
      <form onSubmit={onSubmit} className="auth-form">
        <Field label="ইমেইল" icon="mail" type="email" required autoComplete="email" placeholder="name@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="পাসওয়ার্ড" icon="lock" type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-err" role="alert">{error}</p>}
        <button className="btn-lg" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'লগইন'}</button>
      </form>
      <p className="auth-alt">একাউন্ট নেই? <Link to="/signup">নতুন একাউন্ট খুলুন</Link></p>
      <p className="muted small">পাসওয়ার্ড ভুলে গেলে আপনার কো-এডমিন বা উপজেলা কৃষি অফিসকে জানান।</p>
    </AuthLayout>
  )
}
