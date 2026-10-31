import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout, { Field } from '../components/AuthLayout'
import Icon from '../components/Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { listLocations } from '../lib/catalog'
import type { Location } from '../lib/catalog'
import { mobileError, normalizeMobile } from '../lib/mobile'
import { DESIGNATIONS, SAAO_TITLE } from '../types'

const DESIG_NOTE: Record<string, string> = {
  [SAAO_TITLE]: 'নিজের ব্লকের পাক্ষিক সূচি তৈরি ও জমা',
  'উপজেলা কৃষি অফিসার': 'সূচি অনুমোদন, সব ইউজার',
  'অতিরিক্ত কৃষি অফিসার': 'সূচি যাচাই ও পাঠানো',
  'কৃষি সম্প্রসারণ কর্মকর্তা': 'সূচি যাচাই ও পাঠানো',
}

export default function Signup() {
  const { session } = useAuth()
  const [f, setF] = useState({ designation: SAAO_TITLE, full_name: '', block_name: '', union_name: '', mobile: '', email: '', password: '' })
  const [locs, setLocs] = useState<Location[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listLocations().then(setLocs).catch(() => setLocs([]))
  }, [])

  // ইমেইল যাচাই বন্ধ থাকলে সাইনআপেই সেশন তৈরি হয়; তখন সরাসরি অ্যাপে যাবে
  if (session) return <Navigate to="/" replace />

  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const blocks = locs.filter((l) => l.kind === 'block')
  const unions = locs.filter((l) => l.kind === 'union')
  const isSaao = f.designation === SAAO_TITLE
  const mErr = f.mobile ? mobileError(f.mobile) : null
  const pwShort = f.password.length > 0 && f.password.length < 8

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (isSaao && !f.block_name.trim()) return setError('ব্লক বাছুন বা লিখুন।')
    if (!f.mobile.trim() || mobileError(f.mobile)) return setError('সঠিক মোবাইল নম্বর দিন (১১ অঙ্ক, ০১ দিয়ে শুরু)।')
    if (f.password.length < 8) return setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: f.full_name.trim(),
          designation: f.designation,
          block_name: isSaao ? f.block_name.trim() : '',
          union_name: isSaao ? f.union_name.trim() : '',
          mobile: normalizeMobile(f.mobile),
        },
      },
    })
    setBusy(false)
    if (error) setError(error.message.includes('already') ? 'এই ইমেইলে আগেই একাউন্ট আছে। লগইন করুন।' : error.message)
  }

  return (
    <AuthLayout title="নতুন একাউন্ট" subtitle="একাউন্ট খোলার পর উপজেলা থেকে যাচাই করে সক্রিয় করা হবে">
      <form onSubmit={onSubmit} className="auth-form">
        <fieldset className="desig">
          <legend className="flabel">আপনার পদবি</legend>
          {DESIGNATIONS.map((d) => (
            <label key={d} className={'dcard-opt' + (f.designation === d ? ' on' : '')}>
              <input type="radio" name="designation" value={d} checked={f.designation === d} onChange={() => set('designation')(d)} />
              <span className="dt">{d}</span>
              <span className="dn">{DESIG_NOTE[d]}</span>
              {f.designation === d && <Icon name="check" size={18} className="dcheck" />}
            </label>
          ))}
        </fieldset>

        <div className="fsection">আপনার পরিচয়</div>
        <Field label="পূর্ণ নাম" icon="user" required autoComplete="name" value={f.full_name} onChange={(e) => set('full_name')(e.target.value)} />
        {isSaao && (
          <div className="two">
            <label className="field">
              <span className="flabel">ব্লক</span>
              {blocks.length ? (
                <select required value={f.block_name} onChange={(e) => set('block_name')(e.target.value)}>
                  <option value="">বাছুন</option>
                  {blocks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              ) : (
                <span className="finput"><Icon name="map" size={18} /><input required value={f.block_name} onChange={(e) => set('block_name')(e.target.value)} /></span>
              )}
            </label>
            <label className="field">
              <span className="flabel">ইউনিয়ন</span>
              {unions.length ? (
                <select value={f.union_name} onChange={(e) => set('union_name')(e.target.value)}>
                  <option value="">বাছুন</option>
                  {unions.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              ) : (
                <span className="finput"><input value={f.union_name} onChange={(e) => set('union_name')(e.target.value)} /></span>
              )}
            </label>
          </div>
        )}
        {!isSaao && <p className="note-soft">উপজেলা পর্যায়ের কর্মকর্তাদের ব্লক বা ইউনিয়ন লাগে না। ভূমিকা (এডমিন বা কো-এডমিন) উপজেলা থেকে যাচাই করে দেওয়া হবে।</p>}
        <Field label="মোবাইল নম্বর" icon="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="০১৭১১২২৩৩৪৪"
          value={f.mobile} error={mErr} onChange={(e) => set('mobile')(e.target.value)} />

        <div className="fsection">লগইনের তথ্য</div>
        <Field label="ইমেইল" icon="mail" type="email" required autoComplete="email" placeholder="name@example.com"
          value={f.email} onChange={(e) => set('email')(e.target.value)} />
        <Field label="পাসওয়ার্ড" icon="lock" type="password" required autoComplete="new-password"
          hint="কমপক্ষে ৮ অক্ষর" error={pwShort ? 'আরও লিখুন, কমপক্ষে ৮ অক্ষর লাগবে' : null}
          value={f.password} onChange={(e) => set('password')(e.target.value)} />

        {error && <p className="form-err" role="alert">{error}</p>}
        <button className="btn-lg" disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'একাউন্ট খুলুন'}</button>
      </form>
      <p className="auth-alt">একাউন্ট আছে? <Link to="/login">লগইন করুন</Link></p>
    </AuthLayout>
  )
}
