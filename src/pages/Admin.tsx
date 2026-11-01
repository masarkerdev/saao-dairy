import { useEffect, useMemo, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import Icon, { Avatar } from '../components/Icon'
import { useAuth } from '../lib/auth'
import { approveUser, listProfiles, setActive, setRole } from '../lib/admin'
import type { UserFilter } from '../lib/admin'
import { bn } from '../lib/period'
import { errMsg } from '../lib/schedules'
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_SHORT, SAAO_TITLE, canManage, isDeveloper, isSaaoProfile, suggestedRole } from '../types'
import type { Profile, Role } from '../types'

const TABS: { key: UserFilter; label: string }[] = [
  { key: 'pending', label: 'অপেক্ষমাণ' },
  { key: 'active', label: 'সক্রিয়' },
  { key: 'all', label: 'সব' },
]
type Kind = 'all' | 'officer' | 'saao'

// ইউজার ব্যবস্থাপনা
//  • ডেভেলপার: উপজেলা কৃষি অফিসার, অতিরিক্ত কৃষি অফিসার, কৃষি সম্প্রসারণ কর্মকর্তাদের অনুমোদন ও ভূমিকা দেন; এসএএও-ও পারেন
//  • উপজেলা কৃষি অফিসার ও কো-এডমিন: শুধু উপসহকারী কৃষি কর্মকর্তাদের সক্রিয়/নিষ্ক্রিয় করেন
export default function Admin() {
  const { profile: me } = useAuth()
  const dev = isDeveloper(me?.role)
  const { confirm, toast } = useFeedback()
  const [tab, setTab] = useState<UserFilter>('pending')
  const [kind, setKind] = useState<Kind>(dev ? 'officer' : 'saao')
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError('')
    listProfiles(tab)
      .then((r) => alive && setRows(r.filter((p) => p.role !== 'developer')))
      .catch(() => alive && setError('তালিকা লোড করা যায়নি।'))
    return () => { alive = false }
  }, [tab])

  const shown = useMemo(() => {
    if (!rows) return null
    const t = q.trim().toLowerCase()
    return rows
      .filter((p) => kind === 'all' || (kind === 'saao') === isSaaoProfile(p))
      .filter((p) => !t || [p.full_name, p.email, p.mobile, p.block_name, p.union_name, p.designation].some((v) => (v ?? '').toLowerCase().includes(t)))
  }, [rows, q, kind])

  const count = (k: Kind) => (rows ?? []).filter((p) => k === 'all' || (k === 'saao') === isSaaoProfile(p)).length

  function patch(id: string, change: Partial<Profile>) {
    setRows((r) => {
      if (!r) return r
      const next = r.map((p) => (p.id === id ? { ...p, ...change } : p))
      return next.filter((p) => tab === 'all' || (tab === 'active' ? p.active : !p.active))
    })
  }

  async function run(p: Profile, fn: () => Promise<void>, change: Partial<Profile>, ok: string) {
    setBusyId(p.id)
    try {
      await fn()
      patch(p.id, change)
      toast(ok)
    } catch (e) {
      toast(errMsg(e, 'পরিবর্তন করা যায়নি।'), 'err')
    }
    setBusyId(null)
  }

  async function approve(p: Profile) {
    const role = suggestedRole(p.designation)
    const msg = role === 'saao'
      ? `${p.full_name}-কে উপসহকারী কৃষি কর্মকর্তা হিসেবে সক্রিয় করবেন?`
      : `${p.full_name}-কে ${p.designation ?? ''} হিসেবে অনুমোদন দেবেন? ভূমিকা হবে: ${ROLE_LABEL[role]}।`
    if (!(await confirm(msg, { ok: 'অনুমোদন দিন' }))) return
    await run(p, () => approveUser(p.id, role), { role, active: true }, `${p.full_name} সক্রিয় হয়েছেন`)
  }

  async function deactivate(p: Profile) {
    if (!(await confirm(`${p.full_name}-কে নিষ্ক্রিয় করবেন? তিনি আর লগইন করে কাজ করতে পারবেন না।`, { ok: 'নিষ্ক্রিয় করুন', danger: true }))) return
    await run(p, () => setActive(p.id, false), { active: false }, `${p.full_name} নিষ্ক্রিয় হয়েছেন`)
  }

  async function changeRole(p: Profile, role: Role) {
    if (role === p.role) return
    if (!(await confirm(`${p.full_name}-এর ভূমিকা "${ROLE_LABEL[role]}" করবেন?`))) return
    await run(p, () => setRole(p.id, role), { role }, 'ভূমিকা বদলানো হয়েছে')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{dev ? 'ডেভেলপার প্যানেল' : 'ইউজার ব্যবস্থাপনা'}</h1>
          <p className="muted small">
            {dev
              ? 'উপজেলা কৃষি অফিসার, অতিরিক্ত কৃষি অফিসার ও কৃষি সম্প্রসারণ কর্মকর্তাদের অনুমোদন এখান থেকে।'
              : 'উপসহকারী কৃষি কর্মকর্তাদের নতুন সাইনআপ যাচাই করে সক্রিয় করুন।'}
          </p>
        </div>
      </header>

      <div className="seg" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {dev && (
        <div className="chips-row kind-chips">
          {([['officer', 'কর্মকর্তা'], ['saao', 'উপসহকারী কৃষি কর্মকর্তা'], ['all', 'সবাই']] as [Kind, string][]).map(([k, label]) => (
            <button key={k} type="button" className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
              {label} {rows && <b>{bn(count(k))}</b>}
            </button>
          ))}
        </div>
      )}

      <label className="finput search-box">
        <Icon name="search" size={18} />
        <input type="search" placeholder="নাম, ইমেইল, মোবাইল বা ব্লক দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ইউজার খুঁজুন" />
      </label>

      {error && <p className="form-err">{error}</p>}
      {!shown && !error && <p className="muted">লোড হচ্ছে…</p>}
      {shown && shown.length === 0 && (
        <div className="card empty">
          <Icon name="check" size={30} />
          <span>{tab === 'pending' ? 'অনুমোদনের অপেক্ষায় কেউ নেই।' : 'এই তালিকায় কেউ নেই।'}</span>
        </div>
      )}

      {shown && shown.length > 0 && (
        <div className="ucards">
          {shown.map((p) => {
            const self = p.id === me?.id
            const can = canManage(me, p)
            const busy = busyId === p.id
            const officer = !isSaaoProfile(p)
            const wrongRole = dev && p.active && p.designation && suggestedRole(p.designation) !== p.role
            return (
              <article key={p.id} className={'ucard' + (p.active ? '' : ' pending')}>
                <div className="uc-top">
                  <Avatar name={p.full_name} size={42} />
                  <div className="uc-who">
                    <strong>{p.full_name}{self && <span className="badge">আপনি</span>}</strong>
                    <span className="muted small">{p.designation ?? SAAO_TITLE}{p.block_name && !officer ? ` · ${p.block_name} ব্লক` : ''}</span>
                  </div>
                  {p.active
                    ? <span className={`badge ${p.role === 'saao' ? '' : 'st-forwarded'}`}>{ROLE_SHORT[p.role]}</span>
                    : <span className="badge st-submitted">অপেক্ষমাণ</span>}
                </div>
                <div className="uc-info">
                  {p.email && <span><Icon name="mail" size={14} /> {p.email}</span>}
                  {p.mobile && <a href={`tel:${p.mobile}`}><Icon name="phone" size={14} /> {bn(p.mobile)}</a>}
                </div>
                {wrongRole && <p className="warn-text small" style={{ margin: 0 }}>পদবি অনুযায়ী ভূমিকা হওয়া উচিত: {ROLE_LABEL[suggestedRole(p.designation)]}</p>}

                {can ? (
                  <div className="uc-actions">
                    {!p.active ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void approve(p)}>
                          <Icon name="check" size={16} /> {officer ? 'অনুমোদন দিন' : 'সক্রিয় করুন'}
                        </button>
                        {dev && officer && <span className="muted small">ভূমিকা হবে: {ROLE_SHORT[suggestedRole(p.designation)]}</span>}
                      </>
                    ) : (
                      <>
                        {dev && (
                          <select value={p.role} disabled={busy} aria-label="ভূমিকা" onChange={(e) => void changeRole(p, e.target.value as Role)}>
                            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        )}
                        <button type="button" className="ghost sm danger-text" disabled={busy} onClick={() => void deactivate(p)}>নিষ্ক্রিয় করুন</button>
                      </>
                    )}
                  </div>
                ) : (
                  !self && <p className="muted small lock-note"><Icon name="lock" size={14} /> {officer ? 'কর্মকর্তাদের একাউন্ট ডেভেলপার অনুমোদন করেন' : 'পরিবর্তনের অনুমতি নেই'}</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <p className="muted small">
        নিজের ভূমিকা বা সক্রিয় অবস্থা কেউ বদলাতে পারেন না। উপসহকারী কৃষি কর্মকর্তাদের সক্রিয় করতে পারেন উপজেলা কৃষি অফিসার, অতিরিক্ত কৃষি অফিসার
        বা কৃষি সম্প্রসারণ কর্মকর্তা; এই কর্মকর্তাদের একাউন্ট অনুমোদন ও ভূমিকা দেন শুধু ডেভেলপার।
      </p>
    </div>
  )
}
