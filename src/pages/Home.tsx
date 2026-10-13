import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pendingUsersCount } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { countByStatus } from '../lib/review'
import { STATUS_LABEL, bn, deleteSchedule, errMsg, fmtDate, listMySchedules, parseDate } from '../lib/schedules'
import type { Schedule } from '../lib/schedules'
import { ROLE_SHORT, isReviewer } from '../types'

export default function Home() {
  const { profile, signOut } = useAuth()
  const [list, setList] = useState<Schedule[] | null>(null)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [forwarded, setForwarded] = useState<number | null>(null)
  const [newUsers, setNewUsers] = useState<number | null>(null)

  const reviewer = isReviewer(profile?.role)

  useEffect(() => {
    if (!profile) return
    listMySchedules(profile.id).then(setList).catch(() => setError('সূচির তালিকা লোড করা যায়নি।'))
    if (!isReviewer(profile.role)) return
    countByStatus('submitted', profile.id).then(setSubmitted).catch(() => setSubmitted(null))
    countByStatus('forwarded', profile.id).then(setForwarded).catch(() => setForwarded(null))
    pendingUsersCount().then(setNewUsers).catch(() => setNewUsers(null))
  }, [profile])

  if (!profile) return null

  async function remove(s: Schedule) {
    if (!confirm('এই খসড়া সূচি মুছে ফেলবেন?')) return
    try {
      await deleteSchedule(s.id)
      setList((l) => (l ?? []).filter((x) => x.id !== s.id))
    } catch (e) {
      alert(errMsg(e, 'মোছা যায়নি।'))
    }
  }

  // কার কাজ বাকি তা ভূমিকা অনুযায়ী
  const myQueue = profile.role === 'admin' ? forwarded : submitted

  const mySchedules = (
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
          {list.map((s) => (
            <li key={s.id}>
              <Link to={`/schedules/${s.id}`} className="grow">
                <strong>{s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ</strong>
                <div className="muted">শুরু: {fmtDate(parseDate(s.start_date))}</div>
              </Link>
              <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              {s.status === 'draft' && <button className="ghost sm" onClick={() => void remove(s)}>মুছুন</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="page">
      <header className="top">
        <div>
          <strong>{profile.full_name}</strong>
          <div className="muted">
            {ROLE_SHORT[profile.role]}
            {profile.block_name ? ` · ${profile.block_name} ব্লক` : ''}
          </div>
        </div>
        <button className="ghost" onClick={() => void signOut()}>লগআউট</button>
      </header>

      {reviewer && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2>{profile.role === 'admin' ? 'অনুমোদন' : 'যাচাই'}</h2>
          <div className="stats">
            <Link to="/review" className="stat">
              <b>{myQueue === null ? '…' : bn(myQueue)}</b>
              <span>{profile.role === 'admin' ? 'অনুমোদনের অপেক্ষায়' : 'যাচাইয়ের অপেক্ষায়'}</span>
            </Link>
            <Link to="/review" className="stat dim">
              <b>{(profile.role === 'admin' ? submitted : forwarded) === null ? '…' : bn((profile.role === 'admin' ? submitted : forwarded) ?? 0)}</b>
              <span>{profile.role === 'admin' ? 'কো-এডমিনের যাচাইয়ে' : 'উপজেলা কৃষি অফিসারের কাছে'}</span>
            </Link>
            <Link to="/admin" className="stat dim">
              <b>{newUsers === null ? '…' : bn(newUsers)}</b>
              <span>নতুন ইউজার সক্রিয়ের অপেক্ষায়</span>
            </Link>
          </div>
          <p className="row" style={{ marginBottom: 0 }}>
            <Link to="/review" className="btn">সূচি পর্যালোচনা</Link>
            <Link to="/admin" className="btn ghost-btn">ইউজার ব্যবস্থাপনা</Link>
          </p>
        </div>
      )}

      {mySchedules}
    </div>
  )
}
