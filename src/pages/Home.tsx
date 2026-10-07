import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { pendingCount } from '../lib/review'
import { STATUS_LABEL, bn, deleteSchedule, listMySchedules, parseDate } from '../lib/schedules'
import type { Schedule } from '../lib/schedules'
import { ROLE_LABEL } from '../types'

export default function Home() {
  const { profile, signOut } = useAuth()
  const [list, setList] = useState<Schedule[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<number | null>(null)

  const isSaao = profile?.role === 'saao'

  useEffect(() => {
    if (!profile || !isSaao) return
    listMySchedules(profile.id).then(setList).catch(() => setError('সূচির তালিকা লোড করা যায়নি।'))
  }, [profile, isSaao])

  useEffect(() => {
    if (!profile || isSaao) return
    pendingCount().then(setPending).catch(() => setPending(null))
  }, [profile, isSaao])

  if (!profile) return null

  async function remove(s: Schedule) {
    if (!confirm('এই খসড়া সূচি মুছে ফেলবেন?')) return
    try {
      await deleteSchedule(s.id)
      setList((l) => (l ?? []).filter((x) => x.id !== s.id))
    } catch {
      alert('মোছা যায়নি।')
    }
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <strong>{profile.full_name}</strong>
          <div className="muted">
            {ROLE_LABEL[profile.role]}
            {profile.block_name ? ` · ${profile.block_name} ব্লক` : ''}
          </div>
        </div>
        <button className="ghost" onClick={() => void signOut()}>লগআউট</button>
      </header>

      {isSaao ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>আমার সূচি</h2>
            <Link to="/schedules/new" className="btn">+ নতুন সূচি</Link>
          </div>
          {error && <p className="err">{error}</p>}
          {!list && !error && <p className="muted">লোড হচ্ছে…</p>}
          {list && list.length === 0 && <p className="muted">এখনো কোনো সূচি নেই। "নতুন সূচি" দিয়ে শুরু করুন।</p>}
          {list && list.length > 0 && (
            <ul className="list">
              {list.map((s) => {
                const d = parseDate(s.start_date)
                return (
                  <li key={s.id}>
                    <Link to={`/schedules/${s.id}`} className="grow">
                      <strong>{s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ</strong>
                      <div className="muted">শুরু: {bn(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`)}</div>
                    </Link>
                    <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                    {s.status === 'draft' && <button className="ghost sm" onClick={() => void remove(s)}>মুছুন</button>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="card">
          <h2>স্বাগতম</h2>
          <p>
            <Link to="/review" className="btn">সূচি পর্যালোচনা</Link>
            {pending !== null && pending > 0 && <span className="badge st-submitted">{bn(pending)}টি জমা পড়েছে</span>}
          </p>
          {profile.role === 'admin' && <p className="muted">ধাপ ৫: ইউজার সক্রিয় করা ও role দেওয়া</p>}
        </div>
      )}
    </div>
  )
}
