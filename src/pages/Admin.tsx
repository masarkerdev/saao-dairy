import { useEffect, useMemo, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import Icon, { Avatar } from '../components/Icon'
import { useAuth } from '../lib/auth'
import { listProfiles, setActive, setPost } from '../lib/admin'
import type { UserFilter } from '../lib/admin'
import { bn } from '../lib/period'
import { errMsg } from '../lib/schedules'
import { POSTS, canManage, isDeveloper, isSaaoProfile, postMismatch, postOf, roleTitle } from '../types'
import type { Post, Profile } from '../types'

const TABS: { key: UserFilter; label: string }[] = [
  { key: 'pending', label: 'অপেক্ষমাণ' },
  { key: 'active', label: 'সক্রিয়' },
  { key: 'all', label: 'সব' },
]
type Kind = 'all' | 'officer' | 'saao'
const postLabel = (x: Post) => (x.role === 'saao' ? x.designation : `${x.designation} (${x.title})`)

// ইউজার ব্যবস্থাপনা
//  • ডেভেলপার: সবার পদ (পদবি + ভূমিকা) ঠিক করেন; কর্মকর্তাদের অনুমোদন শুধু ডেভেলপার
//  • এডমিন ও কো-এডমিন-১/২: শুধু উপসহকারী কৃষি কর্মকর্তাদের সক্রিয়/নিষ্ক্রিয় করেন
export default function Admin() {
  const { profile: me } = useAuth()
  const dev = isDeveloper(me?.role)
  const { confirm, toast } = useFeedback()
  const [tab, setTab] = useState<UserFilter>('pending')
  const [kind, setKind] = useState<Kind>(dev ? 'all' : 'saao')
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
  const broken = (rows ?? []).filter(postMismatch).length

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

  const postChange = (x: Post): Partial<Profile> => ({ designation: x.designation, role: x.role, ...(x.role !== 'saao' ? { block_name: null, union_name: null } : {}) })

  async function approve(p: Profile) {
    const post = postOf(p.designation)
    const msg = post.role === 'saao'
      ? `${p.full_name}-কে উপসহকারী কৃষি কর্মকর্তা হিসেবে সক্রিয় করবেন?`
      : `${p.full_name}-কে ${post.designation} হিসেবে অনুমোদন দেবেন? ভূমিকা হবে: ${post.title}।`
    if (!(await confirm(msg, { ok: 'অনুমোদন দিন' }))) return
    if (dev) await run(p, () => setPost(p.id, post, true), { ...postChange(post), active: true }, `${p.full_name} সক্রিয় হয়েছেন`)
    else await run(p, () => setActive(p.id, true), { active: true }, `${p.full_name} সক্রিয় হয়েছেন`)
  }

  async function deactivate(p: Profile) {
    if (!(await confirm(`${p.full_name}-কে নিষ্ক্রিয় করবেন? তিনি আর লগইন করে কাজ করতে পারবেন না।`, { ok: 'নিষ্ক্রিয় করুন', danger: true }))) return
    await run(p, () => setActive(p.id, false), { active: false }, `${p.full_name} নিষ্ক্রিয় হয়েছেন`)
  }

  async function changePost(p: Profile, designation: string) {
    const post = postOf(designation)
    if (post.designation === p.designation && post.role === p.role) return
    if (!(await confirm(`${p.full_name}-এর পদ "${postLabel(post)}" করবেন?${post.role !== 'saao' ? ' ব্লক ও ইউনিয়ন মুছে যাবে।' : ''}`))) return
    await run(p, () => setPost(p.id, post), postChange(post), 'পদ ও ভূমিকা হালনাগাদ হয়েছে')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{dev ? 'ডেভেলপার প্যানেল' : 'ইউজার ব্যবস্থাপনা'}</h1>
          <p className="muted small">
            {dev
              ? 'সবার পদ ও ভূমিকা এখান থেকে ঠিক করুন। কর্মকর্তাদের অনুমোদন শুধু এখান থেকে হয়।'
              : 'উপসহকারী কৃষি কর্মকর্তাদের নতুন সাইনআপ যাচাই করে সক্রিয় করুন।'}
          </p>
        </div>
      </header>

      {dev && (
        <div className="post-legend">
          {POSTS.slice(0, 3).map((x) => <span key={x.designation}><b>{x.title}</b> {x.designation}</span>)}
        </div>
      )}
      {dev && broken > 0 && (
        <p className="note-soft warn"><Icon name="alert" size={16} /> {bn(broken)}জনের পদবি ও ভূমিকা মিলছে না। কার্ডের "পদ" থেকে ঠিক করুন।</p>
      )}

      <div className="seg" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {dev && (
        <div className="chips-row kind-chips">
          {([['all', 'সবাই'], ['officer', 'কর্মকর্তা'], ['saao', 'উপসহকারী কৃষি কর্মকর্তা']] as [Kind, string][]).map(([k, label]) => (
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
            const saao = isSaaoProfile(p)
            const bad = postMismatch(p)
            return (
              <article key={p.id} className={'ucard' + (p.active ? '' : ' pending') + (bad ? ' bad' : '')}>
                <div className="uc-top">
                  <Avatar name={p.full_name} size={42} />
                  <div className="uc-who">
                    <strong>{p.full_name}{self && <span className="badge">আপনি</span>}</strong>
                    <span className="muted small">{p.designation ?? 'পদবি নেই'}{p.block_name && saao ? ` · ${p.block_name} ব্লক` : ''}</span>
                  </div>
                  {p.active
                    ? <span className={`badge ${p.role === 'saao' ? '' : 'st-forwarded'}`}>{roleTitle(p)}</span>
                    : <span className="badge st-submitted">অপেক্ষমাণ</span>}
                </div>
                <div className="uc-info">
                  {p.email && <span><Icon name="mail" size={14} /> {p.email}</span>}
                  {p.mobile && <a href={`tel:${p.mobile}`}><Icon name="phone" size={14} /> {bn(p.mobile)}</a>}
                </div>
                {bad && <p className="warn-text small" style={{ margin: 0 }}>ভূমিকা "{roleTitle(p)}", কিন্তু পদবি "{p.designation ?? 'নেই'}"। সঠিক পদ বেছে নিন।</p>}

                {can ? (
                  <div className="uc-actions">
                    {dev && (
                      <label className="post-pick">
                        <span>পদ</span>
                        <select value={bad ? '' : postOf(p.designation).designation} disabled={busy} onChange={(e) => void changePost(p, e.target.value)}>
                          {bad && <option value="">বাছুন…</option>}
                          {POSTS.map((x) => <option key={x.designation} value={x.designation}>{postLabel(x)}</option>)}
                        </select>
                      </label>
                    )}
                    {!p.active ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void approve(p)}>
                          <Icon name="check" size={16} /> {saao ? 'সক্রিয় করুন' : 'অনুমোদন দিন'}
                        </button>
                        {!saao && <span className="muted small">ভূমিকা হবে: {postOf(p.designation).title}</span>}
                      </>
                    ) : (
                      <button type="button" className="ghost sm danger-text" disabled={busy} onClick={() => void deactivate(p)}>নিষ্ক্রিয় করুন</button>
                    )}
                  </div>
                ) : (
                  !self && <p className="muted small lock-note"><Icon name="lock" size={14} /> {saao ? 'পরিবর্তনের অনুমতি নেই' : 'কর্মকর্তাদের একাউন্ট ডেভেলপার অনুমোদন করেন'}</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <p className="muted small">
        উপজেলা কৃষি অফিসার এডমিন, অতিরিক্ত কৃষি অফিসার কো-এডমিন-১, কৃষি সম্প্রসারণ কর্মকর্তা কো-এডমিন-২। উপসহকারী কৃষি কর্মকর্তাদের
        এঁদের যে কেউ সক্রিয় করতে পারেন; এই কর্মকর্তাদের অনুমোদন ও পদ পরিবর্তন শুধু ডেভেলপার করেন। নিজের ভূমিকা কেউ বদলাতে পারেন না।
      </p>
    </div>
  )
}
