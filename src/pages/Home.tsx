import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import Icon, { Avatar } from '../components/Icon'
import StatusSteps from '../components/StatusSteps'
import { pendingUsersCount } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { blocksFor, listCharges } from '../lib/blocks'
import type { BlockCharge } from '../lib/blocks'
import { getSubmitDaysBefore, listFarmerGroups } from '../lib/catalog'
import { monthOverview } from '../lib/dashboard'
import type { RowState, SaaoRow } from '../lib/dashboard'
import {
  bn, daysBetween, fmtDayMonth, monthDeadline, monthOf, monthPeriods, monthTitle, nextMonth, periodOf, planningMonth, prevMonth, sameMonth, todayISO,
} from '../lib/period'
import type { Month } from '../lib/period'
import { GROUP_COUNT, STATUS_SHORT, countFilled, deleteSchedule, errMsg, groupByMonth, listMySchedules } from '../lib/schedules'
import type { MonthGroup, Schedule } from '../lib/schedules'
import Admin from './Admin'
import { isDeveloper, isReviewer, roleTitle } from '../types'

function greet() {
  const h = new Date().getHours()
  return h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ অপরাহ্ন' : 'শুভ সন্ধ্যা'
}

// পূরণের অগ্রগতি: গোল রিং
function Ring({ value, total }: { value: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r, pct = total ? Math.min(1, value / total) : 0
  return (
    <div className="ring" role="img" aria-label={`${bn(value)}/${bn(total)} গ্রুপ পূরণ`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} className="ring-bg" />
        <circle cx="38" cy="38" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span><b>{bn(value)}</b>/{bn(total)}</span>
    </div>
  )
}

function Deadline({ m, daysBefore, done }: { m: Month; daysBefore: number; done: boolean }) {
  const today = todayISO()
  const dl = monthDeadline(m, daysBefore)
  const left = daysBetween(today, dl)
  if (done) return <span className="muted small">জমার শেষ সময় ছিল {fmtDayMonth(dl)}</span>
  if (left < 0) return <span className="err small">জমার শেষ সময় পার হয়েছে ({fmtDayMonth(dl)})</span>
  return (
    <span className={left <= 2 ? 'warn-text small' : 'muted small'}>
      জমার শেষ সময় {fmtDayMonth(dl)} · {left === 0 ? 'আজই' : `${bn(left)} দিন বাকি`}
    </span>
  )
}

// ---------- এসএএও ----------
function SaaoHome() {
  const { profile } = useAuth()
  const { confirm, toast } = useFeedback()
  const [list, setList] = useState<Schedule[] | null>(null)
  const [groupCount, setGroupCount] = useState<number | null>(null)
  const [filled, setFilled] = useState<Record<string, number>>({})
  const [daysBefore, setDaysBefore] = useState(2)
  const [charges, setCharges] = useState<BlockCharge[]>([])
  const today = todayISO()
  const focus = planningMonth(today)
  const running = monthOf(periodOf(today))

  useEffect(() => {
    if (!profile) return
    listMySchedules(profile.id).then(setList).catch(() => setList([]))
    listFarmerGroups(profile.id).then((l) => setGroupCount(l.filter((x) => x.active).length)).catch(() => setGroupCount(null))
    getSubmitDaysBefore().then(setDaysBefore).catch(() => undefined)
    listCharges(profile.id).then(setCharges).catch(() => setCharges([]))
  }, [profile])

  const months = useMemo(() => groupByMonth(list ?? []), [list])
  const ofMonth = (m: Month, extra: boolean, block?: string) =>
    months.find((g) => sameMonth(g.month, m) && (extra ? g.block === block : !g.extra)) ?? null
  const current = ofMonth(focus, false)
  const now = ofMonth(running, false)
  const extraBlocks = blocksFor(profile, charges, monthPeriods(focus)[0]).filter((b) => b.extra)

  // ফোকাস মাসের দুই পক্ষের পূরণ-সংখ্যা
  useEffect(() => {
    for (const s of [current?.first, current?.second]) {
      if (s) countFilled(s.id).then((n) => setFilled((f) => ({ ...f, [s.id]: n }))).catch(() => undefined)
    }
  }, [current?.first?.id, current?.second?.id])

  if (!profile) return null
  const returned = months.filter((g) => g.status === 'returned')

  async function remove(g: MonthGroup) {
    if (!(await confirm(`${monthTitle(g.month)}-এর খসড়া সূচি (দুই পক্ষ) মুছে ফেলবেন?`, { ok: 'মুছুন', danger: true }))) return
    try {
      for (const s of [g.first, g.second]) if (s && s.status === 'draft') await deleteSchedule(s.id)
      setList((l) => (l ?? []).filter((x) => x.id !== g.first?.id && x.id !== g.second?.id))
    } catch (e) {
      toast(errMsg(e, 'মোছা যায়নি।'), 'err')
    }
  }

  const parts = current ? [current.first, current.second] : []
  const fc = parts.reduce((n, s) => n + (s ? filled[s.id] ?? 0 : 0), 0)
  const editable = current && (current.status === 'draft' || current.status === 'returned')
  const missing = current ? parts.filter((x) => !x).length : 2
  const newLink = `/schedules/new?m=${focus.year}-${focus.month}`

  return (
    <div className="page narrow home">
      <section className="hero">
        <div className="hero-top">
          <Avatar name={profile.full_name} size={48} />
          <div>
            <div className="hero-hi">{greet()},</div>
            <div className="hero-name">{profile.full_name}</div>
            <div className="hero-sub">{profile.block_name ? `${profile.block_name} ব্লক · ` : ''}{profile.upazila} · আজ {fmtDayMonth(today)}</div>
          </div>
        </div>
      </section>

      {returned.map((g) => (
        <Link key={g.key} to={`/schedules/${g.main.id}`} className="card note-box linkcard alert-card">
          <Icon name="alert" size={22} />
          <div>
            <strong>{monthTitle(g.month)}{g.extra ? ` (${g.block} ব্লক)` : ''}-এর সূচি সংশোধনের জন্য ফেরত এসেছে</strong>
            {(g.first?.approver_note || g.second?.approver_note) && <div>“{g.first?.approver_note || g.second?.approver_note}”</div>}
            <span className="small">খুলে ঠিক করুন, তারপর আবার মাস জমা দিন →</span>
          </div>
        </Link>
      ))}

      {groupCount === 0 && (
        <div className="card hint-box">
          <strong>শুরুতে একটি কাজ:</strong> আপনার কৃষক গ্রুপগুলোর নাম, ঠিকানা ও মোবাইল একবার লিখে রাখুন। তাহলে প্রতি মাসে শুধু বাছাই করলেই হবে।
          <div style={{ marginTop: 8 }}><Link to="/groups" className="btn">গ্রুপ তালিকা তৈরি করুন</Link></div>
        </div>
      )}

      <section className="card focus">
        <div className="focus-row">
          <div className="focus-text">
            <div className="eyebrow">পরের মাস</div>
            <h1>{monthTitle(focus)}</h1>
            <div className="muted">দুই পক্ষ · ১-১৫ ও ১৬-শেষ, মাসে একবার জমা</div>
          </div>
          {current && missing === 0 && <Ring value={fc} total={GROUP_COUNT * 2} />}
          {list && !current && <div className="focus-empty"><Icon name="calendarPlus" size={30} /></div>}
        </div>
        {list === null ? (
          <p className="muted">লোড হচ্ছে…</p>
        ) : current ? (
          <>
            <StatusSteps status={current.status} />
            <div className="pk-row">
              {([1, 2] as const).map((f) => {
                const s = f === 1 ? current.first : current.second
                return s
                  ? <Link key={f} to={`/schedules/${s.id}`} className="pk"><b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>{filled[s.id] === undefined ? '…' : `${bn(filled[s.id])}/১২ পূরণ`}</small></Link>
                  : <Link key={f} to={newLink} className="pk missing"><b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>তৈরি হয়নি</small></Link>
              })}
            </div>
            <Deadline m={focus} daysBefore={daysBefore} done={!editable} />
            <Link to={missing ? newLink : `/schedules/${current.main.id}`} className="btn btn-lg focus-cta">
              {missing ? 'বাকি পক্ষের সূচি তৈরি করুন'
                : editable ? fc < GROUP_COUNT * 2 ? `বাকি ${bn(GROUP_COUNT * 2 - fc)}টি গ্রুপ পূরণ করুন` : 'সূচি খুলে মাস জমা দিন'
                  : 'সূচি দেখুন'}
              <Icon name="right" size={18} />
            </Link>
          </>
        ) : (
          <>
            <p style={{ margin: '10px 0 4px' }}>এই মাসের সূচি এখনো তৈরি হয়নি।</p>
            <Deadline m={focus} daysBefore={daysBefore} done={false} />
            <Link to={newLink} className="btn btn-lg focus-cta">মাসের সূচি তৈরি করুন <Icon name="right" size={18} /></Link>
          </>
        )}
      </section>

      {extraBlocks.map((b) => {
        const xg = ofMonth(focus, true, b.name)
        return (
          <section key={b.name} className="card xcard">
            <div className="xc-top">
              <span className="qa-ico"><Icon name="map" /></span>
              <div className="grow">
                <div className="eyebrow">অতিরিক্ত দায়িত্ব</div>
                <strong>{b.name} ব্লক · {monthTitle(focus)}</strong>
              </div>
              {xg ? <span className={`badge st-${xg.status}`}>{STATUS_SHORT[xg.status]}</span> : <span className="badge st-none">তৈরি হয়নি</span>}
            </div>
            {xg
              ? <Link to={`/schedules/${xg.main.id}`} className="btn ghost-btn">সূচি খুলুন <Icon name="right" size={16} /></Link>
              : <Link to={`${newLink}&b=${encodeURIComponent(b.name)}`} className="btn ghost-btn">এই ব্লকের মাসিক সূচি তৈরি করুন <Icon name="right" size={16} /></Link>}
          </section>
        )
      })}

      <div className="qa">
        <Link to={newLink} className="qa-item"><span className="qa-ico"><Icon name="calendarPlus" /></span><span>নতুন সূচি</span></Link>
        <Link to="/groups" className="qa-item"><span className="qa-ico"><Icon name="groups" /></span><span>আমার গ্রুপ{groupCount ? ` (${bn(groupCount)})` : ''}</span></Link>
        {now
          ? <Link to={`/schedules/${now.main.id}`} className="qa-item"><span className="qa-ico"><Icon name="calendar" /></span><span>চলতি মাস</span></Link>
          : <Link to="/profile" className="qa-item"><span className="qa-ico"><Icon name="user" /></span><span>প্রোফাইল</span></Link>}
      </div>

      <section>
        <h2 className="sec-title">সব সূচি</h2>
        {list && months.length === 0 && <div className="card empty"><Icon name="file" size={28} /><span>এখনো কোনো সূচি নেই।</span></div>}
        {months.length > 0 && (
          <div className="sched-list">
            {months.map((g) => (
              <div key={g.key} className={`sched-card bar-${g.status}`}>
                <Link to={`/schedules/${g.main.id}`} className="sc-main">
                  <span className="sc-date"><b>{bn(g.month.month)}</b><small>মাস</small></span>
                  <span className="grow">
                    <strong>{monthTitle(g.month)}</strong>
                    <span className="muted small">
                      {g.first && g.second ? 'দুই পক্ষ' : g.first ? 'শুধু ১ম পক্ষ' : 'শুধু ২য় পক্ষ'}
                      {g.extra ? ` · ${g.block} ব্লক (অতিরিক্ত)` : ''}
                    </span>
                  </span>
                  <span className={`badge st-${g.status}`}>{STATUS_SHORT[g.status]}</span>
                </Link>
                {g.status === 'draft' && (
                  <button type="button" className="icon-btn" aria-label="খসড়া মুছুন" onClick={() => void remove(g)}><Icon name="trash" size={18} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------- কো-এডমিন ও উপজেলা কৃষি অফিসার ----------
const STATE_LABEL: Record<RowState, string> = {
  none: 'তৈরি করেননি', draft: 'খসড়া', returned: 'ফেরত', submitted: 'যাচাই বাকি', forwarded: 'উপজেলায়', approved: 'অনুমোদিত',
}

function ReviewerHome() {
  const { profile } = useAuth()
  const today = todayISO()
  const [month, setMonth] = useState<Month>(planningMonth(today))
  const [rows, setRows] = useState<SaaoRow[] | null>(null)
  const [newUsers, setNewUsers] = useState<number | null>(null)
  const [daysBefore, setDaysBefore] = useState(2)
  const [filter, setFilter] = useState<'all' | 'notyet' | 'mine'>('all')

  useEffect(() => {
    setRows(null)
    monthOverview(month).then(setRows).catch(() => setRows([]))
  }, [month])
  useEffect(() => {
    pendingUsersCount('saao').then(setNewUsers).catch(() => setNewUsers(null))
    getSubmitDaysBefore().then(setDaysBefore).catch(() => undefined)
  }, [])

  const isAdmin = profile?.role === 'admin'
  const myState: RowState = isAdmin ? 'forwarded' : 'submitted'
  const count = (st: RowState[]) => (rows ?? []).filter((r) => st.includes(r.state)).length
  const shown = useMemo(() => {
    const r = rows ?? []
    if (filter === 'notyet') return r.filter((x) => ['none', 'draft', 'returned'].includes(x.state))
    if (filter === 'mine') return r.filter((x) => x.state === myState || (isAdmin && x.state === 'submitted'))
    return r
  }, [rows, filter, myState, isAdmin])

  const tiles: { label: string; n: number; cls: string; f: typeof filter }[] = [
    { label: isAdmin ? 'আপনার অনুমোদনের অপেক্ষায়' : 'আপনার যাচাইয়ের অপেক্ষায়', n: count([myState]), cls: 'warn', f: 'mine' },
    { label: 'জমা দেননি', n: count(['none', 'draft', 'returned']), cls: 'bad', f: 'notyet' },
    { label: isAdmin ? 'কো-এডমিনের যাচাইয়ে' : 'উপজেলা কৃষি অফিসারের কাছে', n: count([isAdmin ? 'submitted' : 'forwarded']), cls: '', f: 'all' },
    { label: 'অনুমোদিত', n: count(['approved']), cls: 'good', f: 'all' },
  ]

  return (
    <div className="page narrow">
      <section className="hero hero-rev">
        <div className="hero-top">
          {profile && <Avatar name={profile.full_name} size={48} />}
          <div>
            <div className="hero-hi">{greet()},</div>
            <div className="hero-name">{profile?.full_name}</div>
            <div className="hero-sub">{profile?.designation ? `${profile.designation} · ` : ''}{roleTitle(profile)} · {profile?.upazila}{newUsers ? ` · ${bn(newUsers)}জন নতুন সাইনআপ অপেক্ষায়` : ''}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <button type="button" className="ghost sm" aria-label="আগের মাস" onClick={() => setMonth(prevMonth(month))}><Icon name="left" size={18} /></button>
          <div className="pcenter">
            <h1>{monthTitle(month)}</h1>
            <div className="muted small">মাসিক সূচি (দুই পক্ষ) · <Deadline m={month} daysBefore={daysBefore} done={false} /></div>
          </div>
          <button type="button" className="ghost sm" aria-label="পরের মাস" onClick={() => setMonth(nextMonth(month))}><Icon name="right" size={18} /></button>
        </div>

        <div className="tiles">
          {tiles.map((t) => (
            <button type="button" key={t.label} className={`tile ${t.cls}${filter === t.f && t.f !== 'all' ? ' sel' : ''}`} onClick={() => setFilter(filter === t.f ? 'all' : t.f)}>
              <b>{rows ? bn(t.n) : '…'}</b><span>{t.label}</span>
            </button>
          ))}
        </div>

        {!rows && <p className="muted">লোড হচ্ছে…</p>}
        {rows && rows.length === 0 && <p className="muted">কোনো সক্রিয় এসএএও নেই। নতুন সাইনআপ "ইউজার" পেজ থেকে সক্রিয় করুন।</p>}
        {rows && rows.length > 0 && (
          <>
            <div className="row between small" style={{ marginTop: 10 }}>
              <span className="muted">{filter === 'all' ? `সব ব্লক (${bn(rows.length)})` : filter === 'notyet' ? 'যাঁরা জমা দেননি' : 'আপনার কাজ বাকি'}</span>
              {filter !== 'all' && <button type="button" className="ghost sm" onClick={() => setFilter('all')}>সবাই দেখুন</button>}
            </div>
            <ul className="list srows">
              {shown.map((r) => (
                <li key={r.key} className={r.extra ? 'xrow' : ''}>
                  {r.schedule ? (
                    <Link to={`/schedules/${r.schedule.id}`} className="grow who-cell">
                      <Avatar name={r.profile.full_name} size={34} />
                      <span>
                      <strong>{r.profile.full_name}</strong>
                      <div className="muted small">{r.block ? `${r.block} ব্লক${r.extra ? ' (অতিরিক্ত দায়িত্ব)' : ''} · ` : ''}{bn(r.filled)}/২৪ গ্রুপ{r.pokkhos < 2 ? ' · এক পক্ষ বাকি' : ''}</div>
                      </span>
                    </Link>
                  ) : (
                    <div className="grow who-cell">
                      <Avatar name={r.profile.full_name} size={34} />
                      <span>
                      <strong>{r.profile.full_name}</strong>
                      <div className="muted small">{r.block ? `${r.block} ব্লক${r.extra ? ' (অতিরিক্ত দায়িত্ব)' : ''}` : ''}</div>
                      </span>
                    </div>
                  )}
                  {r.profile.mobile && <a className="call" href={`tel:${r.profile.mobile}`} aria-label={`${r.profile.full_name}-কে ফোন`}><Icon name="phone" size={16} /><span>{bn(r.profile.mobile)}</span></a>}
                  <span className={`badge st-${r.state}`}>{STATE_LABEL[r.state]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="quick">
        <Link to="/review" className="card linkcard"><Icon name="review" className="qi" /><strong>সূচি পর্যালোচনা</strong><span className="muted small">সব মাসের জমা পড়া সূচি</span></Link>
        <Link to="/admin" className="card linkcard"><Icon name="groups" className="qi" /><strong>ইউজার</strong><span className="muted small">{newUsers ? `${bn(newUsers)}জন নতুন সাইনআপ সক্রিয়ের অপেক্ষায়` : 'সাইনআপ সক্রিয় করা, ভূমিকা দেওয়া'}</span></Link>
        <Link to="/settings" className="card linkcard"><Icon name="settings" className="qi" /><strong>সেটিংস</strong><span className="muted small">সরকারি ছুটি, আলোচ্য বিষয়, ব্লক</span></Link>
      </div>
    </div>
  )
}

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return null
  if (isDeveloper(profile.role)) return <Admin />
  return isReviewer(profile.role) ? <ReviewerHome /> : <SaaoHome />
}
