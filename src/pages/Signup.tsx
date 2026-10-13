import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { listLocations } from '../lib/catalog'
import type { Location } from '../lib/catalog'
import { mobileError, normalizeMobile } from '../lib/mobile'

export default function Signup() {
  const { session } = useAuth()
  const [f, setF] = useState({ full_name: '', block_name: '', union_name: '', mobile: '', email: '', password: '' })
  const [locs, setLocs] = useState<Location[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listLocations().then(setLocs).catch(() => setLocs([]))
  }, [])

  // ইমেইল যাচাই বন্ধ থাকলে সাইনআপেই সেশন তৈরি হয়; তখন সরাসরি অ্যাপে যাবে
  if (session) return <Navigate to="/" replace />

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const blocks = locs.filter((l) => l.kind === 'block')
  const unions = locs.filter((l) => l.kind === 'union')
  const mErr = f.mobile ? mobileError(f.mobile) : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.block_name.trim()) return setError('ব্লক বাছুন বা লিখুন।')
    if (mobileError(f.mobile) || !f.mobile.trim()) return setError('সঠিক মোবাইল নম্বর দিন (১১ অঙ্ক, ০১ দিয়ে শুরু)।')
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
          mobile: normalizeMobile(f.mobile),
        },
      },
    })
    setBusy(false)
    if (error) setError(error.message.includes('already') ? 'এই ইমেইলে আগেই একাউন্ট আছে। লগইন করুন।' : error.message)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="card auth">
        <h1>একাউন্ট তৈরি হয়েছে</h1>
        <p>এখন লগইন করুন। কো-এডমিন (অতিরিক্ত কৃষি অফিসার বা কৃষি সম্প্রসারণ কর্মকর্তা) একাউন্ট সক্রিয় করার পর আপনি সূচি তৈরি করতে পারবেন।</p>
        <Link to="/login">লগইন পেজে যান</Link>
      </div>
    )
  }

  return (
    <div className="card auth">
      <h1>নতুন একাউন্ট</h1>
      <p className="muted">উপসহকারী কৃষি কর্মকর্তা</p>
      <form onSubmit={onSubmit}>
        <label>পূর্ণ নাম<input required autoComplete="name" value={f.full_name} onChange={set('full_name')} /></label>
        <div className="two">
          <label>ব্লক
            {blocks.length ? (
              <select required value={f.block_name} onChange={set('block_name')}>
                <option value="">বাছুন</option>
                {blocks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            ) : (
              <input required value={f.block_name} onChange={set('block_name')} />
            )}
          </label>
          <label>ইউনিয়ন
            {unions.length ? (
              <select value={f.union_name} onChange={set('union_name')}>
                <option value="">বাছুন</option>
                {unions.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            ) : (
              <input value={f.union_name} onChange={set('union_name')} />
            )}
          </label>
        </div>
        <label>মোবাইল নম্বর
          <input type="tel" inputMode="tel" required autoComplete="tel" value={f.mobile} aria-invalid={!!mErr} onChange={set('mobile')} placeholder="০১৭১১২২৩৩৪৪" />
        </label>
        {mErr && <p className="err small">{mErr}</p>}
        <label>ইমেইল<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>
        <label>পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} /></label>
        {error && <p className="err">{error}</p>}
        <button disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'একাউন্ট খুলুন'}</button>
      </form>
      <p className="muted">একাউন্ট আছে? <Link to="/login">লগইন</Link></p>
    </div>
  )
}
