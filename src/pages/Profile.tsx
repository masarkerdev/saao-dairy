import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Field } from '../components/AuthLayout'
import { useFeedback } from '../components/Feedback'
import AppSetup from '../components/AppSetup'
import Icon, { Avatar } from '../components/Icon'
import { renameBlock } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { listCharges } from '../lib/blocks'
import type { BlockCharge } from '../lib/blocks'
import { listLocations } from '../lib/catalog'
import type { Location } from '../lib/catalog'
import { mobileError, normalizeMobile } from '../lib/mobile'
import { bn, fmtDayMonth } from '../lib/period'
import { errMsg } from '../lib/schedules'
import { supabase } from '../lib/supabase'
import { SAAO_TITLE, isSaaoProfile, roleTitle } from '../types'

// নিজের তথ্য দেখা ও বদলানো, পাসওয়ার্ড পরিবর্তন, লগআউট
export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const { confirm, toast } = useFeedback()
  const [locs, setLocs] = useState<Location[]>([])
  const [charges, setCharges] = useState<BlockCharge[]>([])
  const [f, setF] = useState({ full_name: '', mobile: '', block_name: '', union_name: '' })
  const [pw, setPw] = useState({ a: '', b: '' })
  const [busy, setBusy] = useState<'' | 'info' | 'pw'>('')

  useEffect(() => {
    listLocations().then(setLocs).catch(() => setLocs([]))
  }, [])
  useEffect(() => {
    if (profile?.role === 'saao') listCharges(profile.id).then(setCharges).catch(() => setCharges([]))
  }, [profile])
  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name, mobile: profile.mobile ? bn(profile.mobile) : '', block_name: profile.block_name ?? '', union_name: profile.union_name ?? '' })
  }, [profile])

  if (!profile) return null
  const isSaao = isSaaoProfile(profile)
  const blocks = locs.filter((l) => l.kind === 'block')
  const unions = locs.filter((l) => l.kind === 'union')
  const mErr = f.mobile ? mobileError(f.mobile) : null

  async function saveInfo(e: FormEvent) {
    e.preventDefault()
    if (!f.full_name.trim()) return toast('নাম লিখুন', 'err')
    if (mErr) return toast(mErr, 'err')
    const newBlock = f.block_name.replace(/\s+/g, ' ').trim()
    const oldBlock = profile!.block_name ?? ''
    const blockChanged = isSaao && newBlock !== oldBlock
    if (isSaao && !newBlock) return toast('ব্লকের নাম লিখুন', 'err')
    if (blockChanged && oldBlock && !(await confirm(
      `ব্লকের নাম "${oldBlock}" থেকে "${newBlock}" করবেন? আপনার আগের ও চলতি সব সূচি এবং "আমার গ্রুপ"-এর গ্রুপগুলোতেও নতুন নাম বসবে (অতিরিক্ত দায়িত্বের ব্লক বাদে)।`,
      { ok: 'বদলান' },
    ))) return
    setBusy('info')
    try {
      if (blockChanged) await renameBlock(profile!.id, newBlock, f.union_name)
      const row: Record<string, string | null> = { full_name: f.full_name.trim(), mobile: f.mobile ? normalizeMobile(f.mobile) : null }
      if (isSaao) row.union_name = f.union_name.trim() || null
      const { data, error } = await supabase.from('profiles').update(row).eq('id', profile!.id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('সেভ করা যায়নি।')
      await refreshProfile()
      toast(blockChanged ? `তথ্য হালনাগাদ হয়েছে। ব্লক এখন: ${newBlock}` : 'আপনার তথ্য হালনাগাদ হয়েছে')
    } catch (err) {
      toast(errMsg(err, 'সেভ করা যায়নি।'), 'err')
    }
    setBusy('')
  }

  async function changePw(e: FormEvent) {
    e.preventDefault()
    if (pw.a.length < 8) return toast('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে', 'err')
    if (pw.a !== pw.b) return toast('দুই ঘরের পাসওয়ার্ড মেলেনি', 'err')
    setBusy('pw')
    const { error } = await supabase.auth.updateUser({ password: pw.a })
    setBusy('')
    if (error) return toast(errMsg(error, 'পাসওয়ার্ড বদলানো যায়নি।'), 'err')
    setPw({ a: '', b: '' })
    toast('পাসওয়ার্ড বদলানো হয়েছে। পরের বার নতুন পাসওয়ার্ডে লগইন করবেন।')
  }

  return (
    <div className="page narrow">
      <section className="card profile-head">
        <Avatar name={profile.full_name} size={64} />
        <div className="ph-text">
          <h1>{profile.full_name}</h1>
          <div className="muted">{profile.role === 'developer' ? 'ডেভেলপার (সিস্টেম পরিচালনা)' : profile.designation ?? SAAO_TITLE}{profile.block_name && isSaao ? ` · ${profile.block_name} ব্লক` : ''}</div>
          <div className="chips-row">
            <span className="badge st-approved">{roleTitle(profile)}</span>
            <span className="badge">{profile.upazila}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2><Icon name="user" size={18} /> আমার তথ্য</h2>
        <form onSubmit={saveInfo} className="auth-form">
          <Field label="পূর্ণ নাম" icon="user" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Field label="মোবাইল নম্বর" icon="phone" type="tel" inputMode="tel" value={f.mobile} error={mErr}
            onChange={(e) => setF({ ...f, mobile: e.target.value })} />
          {isSaao && (
            <div className="two">
              <label className="field">
                <span className="flabel">ব্লক</span>
                <span className="finput">
                  <Icon name="map" size={16} />
                  <input value={f.block_name} list="profile-blocks" placeholder="তালিকা থেকে বাছুন বা লিখুন"
                    onChange={(e) => setF({ ...f, block_name: e.target.value })} />
                </span>
                <datalist id="profile-blocks">{blocks.map((b) => <option key={b.id} value={b.name} />)}</datalist>
                {f.block_name.trim() !== (profile.block_name ?? '') && f.block_name.trim()
                  ? <span className="fhint warn-text">সেভ করলে আগের সব সূচি ও গ্রুপেও নতুন নাম বসবে</span>
                  : <span className="fhint">বানান ভুল থাকলে ঠিক করে সেভ করুন</span>}
              </label>
              <label className="field">
                <span className="flabel">ইউনিয়ন</span>
                {unions.length ? (
                  <select value={f.union_name} onChange={(e) => setF({ ...f, union_name: e.target.value })}>
                    <option value="">বাছুন</option>
                    {unions.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                ) : (
                  <span className="finput"><input value={f.union_name} onChange={(e) => setF({ ...f, union_name: e.target.value })} /></span>
                )}
              </label>
            </div>
          )}
          <div className="readonly-row"><Icon name="mail" size={18} /><span>{profile.email ?? '—'}</span><span className="muted small">ইমেইল বদলানো যায় না</span></div>
          {isSaao && <p className="muted small" style={{ margin: 0 }}>নাম, ব্লক ও উপজেলা আপনার সূচির প্রিন্টে সইয়ের নিচে বসে।</p>}
          <div><button disabled={busy === 'info'}>{busy === 'info' ? 'সেভ হচ্ছে…' : 'তথ্য সেভ করুন'}</button></div>
        </form>
      </section>

      {isSaao && charges.length > 0 && (
        <section className="card">
          <h2><Icon name="map" size={18} /> অতিরিক্ত দায়িত্ব</h2>
          <div className="chips-row">
            {charges.map((c) => (
              <span key={c.id} className="chip xchip">{c.block_name} ব্লক
                {(c.from_date || c.to_date) && <small>{c.from_date ? fmtDayMonth(c.from_date) : 'শুরু'} – {c.to_date ? fmtDayMonth(c.to_date) : 'চলমান'}</small>}
              </span>
            ))}
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>প্রতিটি ব্লকের সূচি আলাদা তৈরি ও জমা দিতে হবে। দায়িত্ব দেন বা তুলে নেন উপজেলা কৃষি অফিসার বা কো-এডমিন।</p>
        </section>
      )}

      <section className="card">
        <h2><Icon name="lock" size={18} /> পাসওয়ার্ড বদলান</h2>
        <form onSubmit={changePw} className="auth-form">
          <div className="two">
            <Field label="নতুন পাসওয়ার্ড" icon="lock" type="password" autoComplete="new-password" hint="কমপক্ষে ৮ অক্ষর"
              value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
            <Field label="আবার লিখুন" icon="lock" type="password" autoComplete="new-password"
              error={pw.b && pw.a !== pw.b ? 'মেলেনি' : null} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
          </div>
          <div><button className="ghost" disabled={busy === 'pw'}>{busy === 'pw' ? 'বদলানো হচ্ছে…' : 'পাসওয়ার্ড বদলান'}</button></div>
        </form>
      </section>

      <AppSetup />

      <button type="button" className="ghost logout-btn" onClick={() => void signOut()}>
        <Icon name="logout" size={18} /> লগআউট
      </button>
    </div>
  )
}
