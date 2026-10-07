import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { listProfiles, setActive, setRole } from '../lib/admin'
import type { UserFilter } from '../lib/admin'
import { ROLE_LABEL } from '../types'
import type { Profile, Role } from '../types'

const TABS: { key: UserFilter; label: string }[] = [
  { key: 'pending', label: 'অপেক্ষমাণ' },
  { key: 'active', label: 'সক্রিয়' },
  { key: 'all', label: 'সব' },
]

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab] = useState<UserFilter>('pending')
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError('')
    listProfiles(tab)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError('তালিকা লোড করা যায়নি।'))
    return () => {
      alive = false
    }
  }, [tab])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!rows || !t) return rows
    return rows.filter((p) =>
      [p.full_name, p.email, p.mobile, p.block_name, p.union_name].some((v) => (v ?? '').toLowerCase().includes(t)),
    )
  }, [rows, q])

  function patch(id: string, change: Partial<Profile>) {
    setRows((r) => {
      if (!r) return r
      const next = r.map((p) => (p.id === id ? { ...p, ...change } : p))
      // ট্যাব অনুযায়ী যে সারি আর মিলছে না তা তালিকা থেকে সরে যাবে
      return next.filter((p) => tab === 'all' || (tab === 'active' ? p.active : !p.active))
    })
  }

  async function toggleActive(p: Profile) {
    const next = !p.active
    if (!next && !confirm(`${p.full_name}-কে নিষ্ক্রিয় করবেন? তিনি আর সূচি তৈরি বা সম্পাদনা করতে পারবেন না।`)) return
    setBusyId(p.id)
    try {
      await setActive(p.id, next)
      patch(p.id, { active: next })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'পরিবর্তন করা যায়নি।')
    }
    setBusyId(null)
  }

  async function changeRole(p: Profile, role: Role) {
    if (role === p.role) return
    if (role === 'admin' && !confirm(`${p.full_name}-কে অ্যাডমিন বানাবেন? অ্যাডমিন সব ইউজার ম্যানেজ করতে পারে।`)) return
    setBusyId(p.id)
    try {
      await setRole(p.id, role)
      patch(p.id, { role })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'পরিবর্তন করা যায়নি।')
    }
    setBusyId(null)
  }

  return (
    <div className="page">
      <p><Link to="/">← হোম</Link></p>
      <div className="card">
        <h2>ইউজার ব্যবস্থাপনা</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : 'ghost'} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="নাম, ইমেইল, মোবাইল বা ব্লক দিয়ে খুঁজুন"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', marginTop: 8 }}
        />
        {error && <p className="err">{error}</p>}
        {!shown && !error && <p className="muted">লোড হচ্ছে…</p>}
        {shown && shown.length === 0 && <p className="muted">এই তালিকায় কেউ নেই।</p>}
        {shown && shown.length > 0 && (
          <ul className="list">
            {shown.map((p) => {
              const self = p.id === me?.id
              const busy = busyId === p.id
              return (
                <li key={p.id} className="urow">
                  <div className="grow">
                    <strong>{p.full_name}</strong>
                    {self && <span className="badge">আপনি</span>}
                    {!p.active && <span className="badge st-submitted">অপেক্ষমাণ</span>}
                    <div className="muted">
                      {[p.block_name && `${p.block_name} ব্লক`, p.union_name, p.mobile, p.email].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <select value={p.role} disabled={self || busy} onChange={(e) => void changeRole(p, e.target.value as Role)}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button
                    className={p.active ? 'ghost sm' : 'sm'}
                    disabled={self || busy}
                    onClick={() => void toggleActive(p)}
                  >
                    {p.active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="muted">নিজের role বা সক্রিয় অবস্থা বদলানো যায় না, যাতে ভুল করে অ্যাডমিন হারিয়ে না যায়।</p>
      </div>
    </div>
  )
}
