import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useFeedback } from '../components/Feedback'
import Icon from '../components/Icon'
import { useAuth } from '../lib/auth'
import { AUDIENCE_LABEL, deleteNotice, isLive, listNotices, pushNotice, saveNotice } from '../lib/notices'
import type { Audience, Notice } from '../lib/notices'
import { fmtDayMonth, toISO } from '../lib/period'
import { errMsg } from '../lib/schedules'
import { isReviewer } from '../types'

const blank = { title: '', body: '', audience: 'all' as Audience, pinned: false, expires_on: '' }

// নোটিশ বোর্ড: কর্মকর্তারা নোটিশ দেন, সবাই দেখেন
export default function Notices() {
  const { profile } = useAuth()
  const { confirm, toast } = useFeedback()
  const [list, setList] = useState<Notice[] | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showOld, setShowOld] = useState(false)

  useEffect(() => { listNotices().then(setList).catch(() => setList([])) }, [])
  if (!profile) return null
  const canPost = isReviewer(profile.role)
  const canEdit = (n: Notice) => canPost && (n.created_by === profile.id || profile.role === 'admin' || profile.role === 'developer')
  const live = (list ?? []).filter(isLive)
  const old = (list ?? []).filter((n) => !isLive(n))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast('শিরোনাম লিখুন', 'err')
    setBusy(true)
    try {
      const saved = await saveNotice({ ...form, id: editId ?? undefined, expires_on: form.expires_on || null }, profile!.id)
      if (!editId) void pushNotice(saved.id)
      setList(await listNotices())
      toast(editId ? 'নোটিশ হালনাগাদ হয়েছে' : 'নোটিশ দেওয়া হয়েছে। নোটিফিকেশন চালু থাকলে সবার ফোনে যাবে।')
      setForm(blank); setEditId(null); setOpen(false)
    } catch (err) {
      toast(errMsg(err, 'সেভ করা যায়নি।'), 'err')
    }
    setBusy(false)
  }

  async function remove(n: Notice) {
    if (!(await confirm(`"${n.title}" নোটিশটি মুছে ফেলবেন?`, { ok: 'মুছুন', danger: true }))) return
    try {
      await deleteNotice(n.id)
      setList((l) => (l ?? []).filter((x) => x.id !== n.id))
    } catch (e) {
      toast(errMsg(e, 'মোছা যায়নি।'), 'err')
    }
  }

  const edit = (n: Notice) => {
    setEditId(n.id)
    setForm({ title: n.title, body: n.body, audience: n.audience, pinned: n.pinned, expires_on: n.expires_on ?? '' })
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const card = (n: Notice) => (
    <article key={n.id} className={'notice' + (n.pinned ? ' pinned' : '') + (isLive(n) ? '' : ' old')}>
      <div className="nt-head">
        {n.pinned && <span className="badge st-approved"><Icon name="up" size={12} /> উপরে আটকানো</span>}
        {n.audience !== 'all' && <span className="badge">{AUDIENCE_LABEL[n.audience]}</span>}
        {n.expires_on && <span className="badge">{isLive(n) ? `${fmtDayMonth(n.expires_on)} পর্যন্ত` : 'মেয়াদ শেষ'}</span>}
      </div>
      <h2>{n.title}</h2>
      {n.body && <p className="nt-body">{n.body}</p>}
      <div className="nt-foot">
        <span className="muted small">
          {n.author?.full_name ?? 'অজানা'}{n.author?.designation ? `, ${n.author.designation}` : ''} · {fmtDayMonth(toISO(new Date(n.created_at)))}
          {n.updated_at && n.updated_at.slice(0, 16) !== n.created_at.slice(0, 16) ? ' · সম্পাদিত' : ''}
        </span>
        {canEdit(n) && (
          <span className="row tight">
            <button type="button" className="icon-btn" aria-label="সম্পাদনা" onClick={() => edit(n)}><Icon name="edit" size={16} /></button>
            <button type="button" className="icon-btn danger-text" aria-label="মুছুন" onClick={() => void remove(n)}><Icon name="trash" size={16} /></button>
          </span>
        )}
      </div>
    </article>
  )

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>নোটিশ বোর্ড</h1>
          <p className="muted small">{canPost ? 'উপজেলা থেকে সবার জন্য নির্দেশনা ও খবর। নতুন নোটিশ সবার ঘণ্টায় ও ফোনে যায়।' : 'উপজেলা কৃষি অফিস থেকে দেওয়া নির্দেশনা ও খবর।'}</p>
        </div>
        {canPost && !open && <button type="button" className="btn-add" onClick={() => { setForm(blank); setEditId(null); setOpen(true) }}><Icon name="plus" size={18} /> নতুন নোটিশ</button>}
      </header>

      {open && (
        <section className="card add-panel">
          <div className="row between"><h2 style={{ margin: 0 }}>{editId ? 'নোটিশ সম্পাদনা' : 'নতুন নোটিশ'}</h2>
            <button type="button" className="icon-btn" aria-label="বন্ধ করুন" onClick={() => setOpen(false)}><Icon name="x" size={18} /></button></div>
          <form onSubmit={submit} className="auth-form">
            <label className="field"><span className="flabel">শিরোনাম</span>
              <span className="finput"><input autoFocus value={form.title} maxLength={120} placeholder="যেমন: আমন কাটার মৌসুমে মাঠ দিবস" onChange={(e) => setForm({ ...form, title: e.target.value })} /></span>
            </label>
            <label className="field"><span className="flabel">বিস্তারিত</span>
              <textarea rows={5} value={form.body} placeholder="যা জানাতে চান" onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <div className="three">
              <label className="field"><span className="flabel">কারা দেখবেন</span>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}>
                  {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                </select>
              </label>
              <label className="field"><span className="flabel">শেষ তারিখ (ঐচ্ছিক)</span>
                <input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
              </label>
              <label className="check pin-check">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                <span>উপরে আটকে রাখুন<br /><small className="muted">সবার হোমেও দেখাবে</small></span>
              </label>
            </div>
            <div className="row">
              <button disabled={busy}>{busy ? 'সেভ হচ্ছে…' : editId ? 'হালনাগাদ করুন' : 'নোটিশ দিন'}</button>
              <button type="button" className="ghost" onClick={() => setOpen(false)}>বাতিল</button>
            </div>
          </form>
        </section>
      )}

      {!list && <p className="muted">লোড হচ্ছে…</p>}
      {list && live.length === 0 && (
        <div className="card empty"><Icon name="file" size={30} /><span>এখন কোনো নোটিশ নেই।</span></div>
      )}
      <div className="notices">{live.map(card)}</div>

      {old.length > 0 && (
        <div>
          <button type="button" className="ghost sm" onClick={() => setShowOld((v) => !v)}>{showOld ? 'মেয়াদ শেষ হওয়া নোটিশ লুকান' : `মেয়াদ শেষ হওয়া নোটিশ (${old.length})`}</button>
          {showOld && <div className="notices" style={{ marginTop: 10 }}>{old.map(card)}</div>}
        </div>
      )}
    </div>
  )
}

// হোমের উপরে: উপরে আটকানো নোটিশ (সর্বোচ্চ ২টি)
export function PinnedNotices() {
  const [list, setList] = useState<Notice[]>([])
  useEffect(() => { listNotices().then((l) => setList(l.filter((n) => n.pinned && isLive(n)).slice(0, 2))).catch(() => setList([])) }, [])
  if (!list.length) return null
  return (
    <>
      {list.map((n) => (
        <Link key={n.id} to="/notices" className="card pin-notice">
          <Icon name="bell" size={20} />
          <div>
            <strong>{n.title}</strong>
            {n.body && <span className="muted small">{n.body.length > 120 ? `${n.body.slice(0, 120)}…` : n.body}</span>}
          </div>
        </Link>
      ))}
    </>
  )
}
