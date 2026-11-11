import { useEffect, useMemo, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import Icon, { Avatar } from '../components/Icon'
import { useAuth } from '../lib/auth'
import { addCharge, listCharges, removeCharge } from '../lib/blocks'
import type { BlockCharge } from '../lib/blocks'
import { listLocations } from '../lib/catalog'
import { fmtDayMonth } from '../lib/period'
import { deleteUser, listProfiles, makePassword, renameBlock, resetPassword, setActive, setPost } from '../lib/admin'
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
  const [charges, setCharges] = useState<BlockCharge[]>([])
  const [allBlocks, setAllBlocks] = useState<string[]>([])
  const [chargeFor, setChargeFor] = useState<string | null>(null)
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [pwDone, setPwDone] = useState<{ id: string; pw: string } | null>(null)
  const [cf, setCf] = useState({ block: '', from: '', to: '' })
  const [blkFor, setBlkFor] = useState<string | null>(null)
  const [blk, setBlk] = useState('')

  useEffect(() => {
    listCharges().then(setCharges).catch(() => setCharges([]))
    listLocations().then((l) => setAllBlocks(l.filter((x) => x.kind === 'block').map((x) => x.name))).catch(() => setAllBlocks([]))
  }, [])

  async function giveCharge(p: Profile) {
    if (!cf.block.trim()) return toast('ব্লক বাছুন বা লিখুন', 'err')
    if (cf.from && cf.to && cf.to < cf.from) return toast('শেষ তারিখ শুরুর আগে হতে পারে না', 'err')
    setBusyId(p.id)
    try {
      const c = await addCharge({ saao_id: p.id, block_name: cf.block, from_date: cf.from, to_date: cf.to })
      setCharges((l) => [...l, c])
      setChargeFor(null)
      setCf({ block: '', from: '', to: '' })
      toast(`${p.full_name}-কে ${c.block_name} ব্লকের অতিরিক্ত দায়িত্ব দেওয়া হয়েছে`)
    } catch (e) {
      toast(errMsg(e, 'দায়িত্ব দেওয়া যায়নি।'), 'err')
    }
    setBusyId(null)
  }

  async function dropCharge(p: Profile, c: BlockCharge) {
    if (!(await confirm(`${p.full_name}-এর ${c.block_name} ব্লকের অতিরিক্ত দায়িত্ব তুলে নেবেন? আগের সূচিগুলো থেকে যাবে।`, { ok: 'তুলে নিন', danger: true }))) return
    try {
      await removeCharge(c.id)
      setCharges((l) => l.filter((x) => x.id !== c.id))
      toast('অতিরিক্ত দায়িত্ব তুলে নেওয়া হয়েছে')
    } catch (e) {
      toast(errMsg(e, 'বদলানো যায়নি।'), 'err')
    }
  }

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

  async function doReset(p: Profile) {
    if (pw.length < 8) return toast('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে', 'err')
    if (!(await confirm(`${p.full_name}-এর পাসওয়ার্ড বদলে নতুনটা দেবেন? তাঁর চালু থাকা লগইন বন্ধ হয়ে যাবে।`, { ok: 'রিসেট করুন' }))) return
    setBusyId(p.id)
    try {
      await resetPassword(p.id, pw)
      setPwDone({ id: p.id, pw })
      setPwFor(null)
      toast(`${p.full_name}-এর পাসওয়ার্ড রিসেট হয়েছে`)
    } catch (e) {
      toast(errMsg(e, 'রিসেট করা যায়নি।'), 'err')
    }
    setBusyId(null)
  }

  async function doRename(p: Profile) {
    const nb = blk.replace(/\s+/g, ' ').trim()
    if (!nb) return toast('ব্লকের নাম লিখুন', 'err')
    if (nb === (p.block_name ?? '')) { setBlkFor(null); return }
    if (!(await confirm(`${p.full_name}-এর ব্লক "${p.block_name ?? '—'}" থেকে "${nb}" করবেন? তাঁর আগের ও চলতি সব সূচি এবং কৃষক গ্রুপেও নতুন নাম বসবে।`, { ok: 'বদলান' }))) return
    await run(p, async () => { await renameBlock(p.id, nb) }, { block_name: nb }, `${p.full_name}-এর ব্লক এখন: ${nb}`)
    setBlkFor(null)
  }

  async function copyPw(text: string) {
    try { await navigator.clipboard.writeText(text); toast('কপি হয়েছে') } catch { toast('কপি করা যায়নি, হাতে লিখে নিন', 'err') }
  }

  async function remove(p: Profile) {
    const ok = await confirm(
      `${p.full_name}-এর একাউন্ট একেবারে মুছে ফেলবেন? লগইন, প্রোফাইল, তাঁর নিজের সূচি ও কৃষক গ্রুপ মুছে যাবে। এটা আর ফেরত আনা যাবে না।`,
      { ok: 'মুছে ফেলুন', danger: true },
    )
    if (!ok) return
    setBusyId(p.id)
    try {
      await deleteUser(p.id)
      setRows((r) => (r ?? []).filter((x) => x.id !== p.id))
      toast(`${p.full_name}-এর একাউন্ট মুছে ফেলা হয়েছে`)
    } catch (e) {
      toast(errMsg(e, 'মোছা যায়নি।'), 'err')
    }
    setBusyId(null)
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
          <datalist id="admin-blocks">{allBlocks.map((b) => <option key={b} value={b} />)}</datalist>
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
                {can && pwFor === p.id && (
                  <div className="pw-form">
                    <label className="field">
                      <span className="flabel">নতুন পাসওয়ার্ড</span>
                      <span className="finput">
                        <Icon name="lock" size={16} />
                        <input value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" spellCheck={false} aria-label="নতুন পাসওয়ার্ড" />
                        <button type="button" className="peek" title="নতুন বানান" aria-label="নতুন পাসওয়ার্ড বানান" onClick={() => setPw(makePassword())}><Icon name="refresh" size={16} /></button>
                      </span>
                      <span className="fhint">নিজে লিখতে পারেন, অথবা যেটা বসানো আছে সেটাই রাখুন। কমপক্ষে ৮ অক্ষর।</span>
                    </label>
                    <div className="row">
                      <button type="button" className="sm" disabled={busy} onClick={() => void doReset(p)}>রিসেট করুন</button>
                      <button type="button" className="ghost sm" onClick={() => setPwFor(null)}>বাতিল</button>
                    </div>
                  </div>
                )}
                {can && saao && blkFor === p.id && (
                  <div className="pw-form">
                    <label className="field">
                      <span className="flabel">ব্লকের সঠিক নাম</span>
                      <span className="finput">
                        <Icon name="map" size={16} />
                        <input value={blk} list="admin-blocks" onChange={(e) => setBlk(e.target.value)} aria-label="ব্লকের নাম" autoFocus />
                      </span>
                      <span className="fhint">তালিকা থেকে বাছুন বা বানান ঠিক করে লিখুন। আগের সব সূচি ও কৃষক গ্রুপেও নতুন নাম বসবে।</span>
                    </label>
                    <div className="row">
                      <button type="button" className="sm" disabled={busy} onClick={() => void doRename(p)}>সেভ করুন</button>
                      <button type="button" className="ghost sm" onClick={() => setBlkFor(null)}>বাতিল</button>
                    </div>
                  </div>
                )}
                {pwDone?.id === p.id && (
                  <div className="pw-done">
                    <span>{p.full_name}-এর নতুন পাসওয়ার্ড:</span>
                    <code>{pwDone.pw}</code>
                    <button type="button" className="ghost sm" onClick={() => void copyPw(pwDone.pw)}>কপি</button>
                    <span className="muted small">এটা তাঁকে ফোনে বা সরাসরি জানান। লগইনের পর প্রোফাইল থেকে নিজের পাসওয়ার্ড দিতে বলুন। এই পেজ ছাড়লে আর দেখা যাবে না।</span>
                  </div>
                )}
                {saao && p.active && (charges.some((c) => c.saao_id === p.id) || can) && (
                  <div className="xcharge">
                    <span className="xc-label"><Icon name="map" size={14} /> অতিরিক্ত দায়িত্ব</span>
                    {charges.filter((c) => c.saao_id === p.id).map((c) => (
                      <span key={c.id} className="chip xchip">
                        {c.block_name} ব্লক
                        {(c.from_date || c.to_date) && <small>{c.from_date ? fmtDayMonth(c.from_date) : 'শুরু'} – {c.to_date ? fmtDayMonth(c.to_date) : 'চলমান'}</small>}
                        {can && <button type="button" aria-label={`${c.block_name} ব্লকের দায়িত্ব তুলে নিন`} onClick={() => void dropCharge(p, c)}><Icon name="x" size={14} /></button>}
                      </span>
                    ))}
                    {!charges.some((c) => c.saao_id === p.id) && <span className="muted small">নেই</span>}
                    {can && chargeFor !== p.id && (
                      <button type="button" className="chip more" onClick={() => { setChargeFor(p.id); setCf({ block: '', from: '', to: '' }) }}>+ ব্লক যোগ</button>
                    )}
                    {can && chargeFor === p.id && (
                      <div className="xc-form">
                        {allBlocks.length ? (
                          <select value={cf.block} onChange={(e) => setCf({ ...cf, block: e.target.value })} aria-label="ব্লক">
                            <option value="">ব্লক বাছুন</option>
                            {allBlocks.filter((b) => b !== p.block_name && !charges.some((c) => c.saao_id === p.id && c.block_name === b))
                              .map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        ) : (
                          <input value={cf.block} placeholder="ব্লকের নাম" aria-label="ব্লক" onChange={(e) => setCf({ ...cf, block: e.target.value })} />
                        )}
                        <label>শুরু<input type="date" value={cf.from} onChange={(e) => setCf({ ...cf, from: e.target.value })} /></label>
                        <label>শেষ (ঐচ্ছিক)<input type="date" value={cf.to} onChange={(e) => setCf({ ...cf, to: e.target.value })} /></label>
                        <div className="row">
                          <button type="button" className="sm" disabled={busy} onClick={() => void giveCharge(p)}>দায়িত্ব দিন</button>
                          <button type="button" className="ghost sm" onClick={() => setChargeFor(null)}>বাতিল</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                    {saao && (
                      <button type="button" className="ghost sm blk-btn" disabled={busy}
                        onClick={() => { setBlkFor(blkFor === p.id ? null : p.id); setBlk(p.block_name ?? '') }}>
                        <Icon name="map" size={14} /> ব্লক সংশোধন
                      </button>
                    )}
                    <button type="button" className="ghost sm pw-btn" disabled={busy}
                      onClick={() => { setPwFor(pwFor === p.id ? null : p.id); setPw(makePassword()); setPwDone(null) }}>
                      <Icon name="lock" size={14} /> পাসওয়ার্ড রিসেট
                    </button>
                    {dev && (
                      <button type="button" className="icon-btn danger-text uc-del" disabled={busy} aria-label={`${p.full_name}-এর একাউন্ট মুছুন`} title="একাউন্ট মুছুন" onClick={() => void remove(p)}>
                        <Icon name="trash" size={18} />
                      </button>
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
