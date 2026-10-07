import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Signup() {
  const { session } = useAuth()
  const [f, setF] = useState({ full_name: '', block_name: '', union_name: '', mobile: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  // ইমেইল যাচাই বন্ধ থাকলে সাইনআপেই সেশন তৈরি হয়; তখন সরাসরি অ্যাপে যাবে
  if (session) return <Navigate to="/" replace />

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (f.password.length < 8) return setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: f.full_name.trim(),
          block_name: f.block_name.trim(),
          union_name: f.union_name.trim(),
          mobile: f.mobile.trim(),
        },
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="card auth">
        <h1>একাউন্ট তৈরি হয়েছে</h1>
        <p>১) আপনার ইমেইলে পাঠানো লিংকে ক্লিক করে ইমেইল যাচাই করুন।</p>
        <p>২) এরপর লগইন করুন। অ্যাডমিন একাউন্ট সক্রিয় করার পর আপনি সূচি তৈরি করতে পারবেন।</p>
        <Link to="/login">লগইন পেজে যান</Link>
      </div>
    )
  }

  return (
    <div className="card auth">
      <h1>নতুন একাউন্ট</h1>
      <form onSubmit={onSubmit}>
        <label>পূর্ণ নাম<input required value={f.full_name} onChange={set('full_name')} /></label>
        <label>ব্লক<input required value={f.block_name} onChange={set('block_name')} /></label>
        <label>ইউনিয়ন<input value={f.union_name} onChange={set('union_name')} /></label>
        <label>মোবাইল নম্বর<input type="tel" required value={f.mobile} onChange={set('mobile')} /></label>
        <label>ইমেইল<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>
        <label>পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} /></label>
        {error && <p className="err">{error}</p>}
        <button disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'একাউন্ট খুলুন'}</button>
      </form>
      <p className="muted">একাউন্ট আছে? <Link to="/login">লগইন</Link></p>
    </div>
  )
}
