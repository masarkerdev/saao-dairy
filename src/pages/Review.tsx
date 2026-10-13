import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { listForReview } from '../lib/review'
import type { ReviewRow } from '../lib/review'
import { periodRange, toISO, fmtDate } from '../lib/period'
import { STATUS_LABEL, bn, schedulePeriod } from '../lib/schedules'
import type { Status } from '../lib/schedules'

type Tab = Status | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'submitted', label: 'যাচাইয়ের অপেক্ষায়' },
  { key: 'forwarded', label: 'উপজেলা কৃষি অফিসারের কাছে' },
  { key: 'returned', label: 'ফেরত' },
  { key: 'approved', label: 'অনুমোদিত' },
  { key: 'all', label: 'সব' },
]

export default function Review() {
  const { profile } = useAuth()
  // কো-এডমিনের কাজ: জমা পড়া; এডমিনের কাজ: পাঠানো
  const [tab, setTab] = useState<Tab>(profile?.role === 'admin' ? 'forwarded' : 'submitted')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!profile) return
    let alive = true
    setRows(null)
    setError('')
    listForReview(tab, profile.id)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError('তালিকা লোড করা যায়নি।'))
    return () => {
      alive = false
    }
  }, [tab, profile])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!rows || !t) return rows
    return rows.filter((s) =>
      [s.owner?.full_name, s.owner?.block_name, s.owner?.union_name, s.month_label].some((v) => (v ?? '').toLowerCase().includes(t)),
    )
  }, [rows, q])

  return (
    <div className="page">
      <p><Link to="/">← হোম</Link></p>
      <div className="card">
        <h2>সূচি পর্যালোচনা</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {profile?.role === 'admin'
            ? 'কো-এডমিন যাচাই করে পাঠানো সূচিগুলো এখানে আসে। খুলে অনুমোদন দিন বা মন্তব্যসহ ফেরত দিন।'
            : 'এসএএও-দের জমা দেওয়া সূচি খুলে যাচাই করুন, তারপর উপজেলা কৃষি অফিসারের কাছে পাঠান বা মন্তব্যসহ ফেরত দিন।'}
        </p>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : 'ghost'} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="নাম, ব্লক, ইউনিয়ন বা মাস দিয়ে খুঁজুন" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginTop: 8 }} />
        {error && <p className="err">{error}</p>}
        {!shown && !error && <p className="muted">লোড হচ্ছে…</p>}
        {shown && shown.length === 0 && <p className="muted">এই তালিকায় কিছু নেই।</p>}
        {shown && shown.length > 0 && (
          <ul className="list">
            {shown.map((s) => (
              <li key={s.id}>
                <Link to={`/schedules/${s.id}`} className="grow">
                  <strong>{s.owner?.full_name ?? 'অজানা'}</strong>
                  {s.owner?.block_name ? ` · ${s.owner.block_name} ব্লক` : ''}
                  <div className="muted">
                    {s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ ({periodRange(schedulePeriod(s))})
                    {s.submitted_at ? ` · জমা ${fmtDate(toISO(new Date(s.submitted_at)))}` : ''}
                    {s.owner?.mobile ? ` · ${bn(s.owner.mobile)}` : ''}
                  </div>
                </Link>
                <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        )}
        {shown && shown.length > 0 && <p className="muted">মোট {bn(shown.length)}টি</p>}
      </div>
    </div>
  )
}
