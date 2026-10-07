import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listForReview } from '../lib/review'
import type { ReviewRow } from '../lib/review'
import { STATUS_LABEL, bn, parseDate } from '../lib/schedules'
import type { Status } from '../lib/schedules'

const TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'submitted', label: 'জমা পড়া' },
  { key: 'approved', label: 'অনুমোদিত' },
  { key: 'returned', label: 'ফেরত' },
  { key: 'all', label: 'সব' },
]

const fmt = (iso: string) => {
  const d = new Date(iso)
  return bn(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`)
}

export default function Review() {
  const [tab, setTab] = useState<Status | 'all'>('submitted')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setRows(null)
    setError('')
    listForReview(tab)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError('তালিকা লোড করা যায়নি।'))
    return () => {
      alive = false
    }
  }, [tab])

  return (
    <div className="page">
      <p><Link to="/">← হোম</Link></p>
      <div className="card">
        <h2>সূচি পর্যালোচনা</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : 'ghost'} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className="err">{error}</p>}
        {!rows && !error && <p className="muted">লোড হচ্ছে…</p>}
        {rows && rows.length === 0 && <p className="muted">এই তালিকায় কিছু নেই।</p>}
        {rows && rows.length > 0 && (
          <ul className="list">
            {rows.map((s) => (
              <li key={s.id}>
                <Link to={`/schedules/${s.id}`} className="grow">
                  <strong>{s.owner?.full_name ?? 'অজানা'}</strong>
                  {s.owner?.block_name ? ` · ${s.owner.block_name} ব্লক` : ''}
                  <div className="muted">
                    {s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ · শুরু {fmt(s.start_date + 'T00:00:00')}
                    {s.submitted_at ? ` · জমা ${fmt(s.submitted_at)}` : ''}
                    {s.owner?.mobile ? ` · ${s.owner.mobile}` : ''}
                  </div>
                </Link>
                <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
