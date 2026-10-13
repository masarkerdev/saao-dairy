import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import StatusSteps from '../components/StatusSteps'
import { pendingUsersCount } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { getSubmitDaysBefore, listFarmerGroups } from '../lib/catalog'
import { periodOverview } from '../lib/dashboard'
import type { RowState, SaaoRow } from '../lib/dashboard'
import {
  bn, daysBetween, deadlineFor, fmtDayMonth, nextPeriod, periodRange, periodStart, periodTitle, planningPeriod, prevPeriod, toISO, todayISO,
} from '../lib/period'
import type { Period } from '../lib/period'
import { GROUP_COUNT, STATUS_SHORT, countFilled, deleteSchedule, errMsg, listMySchedules, schedulePeriod } from '../lib/schedules'
import type { Schedule } from '../lib/schedules'
import { isReviewer } from '../types'

function Deadline({ p, daysBefore, done }: { p: Period; daysBefore: number; done: boolean }) {
  const today = todayISO()
  const dl = deadlineFor(p, daysBefore)
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
  const today = todayISO()
  const focus = planningPeriod(today)

  useEffect(() => {
    if (!profile) return
    listMySchedules(profile.id).then(setList).catch(() => setList([]))
    listFarmerGroups(profile.id).then((l) => setGroupCount(l.filter((x) => x.active).length)).catch(() => setGroupCount(null))
    getSubmitDaysBefore().then(setDaysBefore).catch(() => undefined)
  }, [profile])

  // ফোকাসের সূচির পূরণ-সংখ্যা
  const current = list?.find((s) => s.start_date === periodStart(focus)) ?? null
  const running = list?.find((s) => s.start_date === periodStart(prevPeriod(focus))) ?? null
  useEffect(() => {
    if (!current) return
    countFilled(current.id).then((n) => setFilled((f) => ({ ...f, [current.id]: n }))).catch(() => undefined)
  }, [current])

  if (!profile) return null
  const returned = (list ?? []).filter((s) => s.status === 'returned')

  async function remove(s: Schedule) {
    if (!(await confirm('এই খসড়া সূচি মুছে ফেলবেন?', { ok: 'মুছুন', danger: true }))) return
    try {
      await deleteSchedule(s.id)
      setList((l) => (l ?? []).filter((x) => x.id !== s.id))
    } catch (e) {
      toast(errMsg(e, 'মোছা যায়নি।'), 'err')
    }
  }

  const fc = current ? filled[current.id] : undefined

  return (
    <div className="page narrow">
      {returned.map((s) => (
        <Link key={s.id} to={`/schedules/${s.id}`} className="card note-box linkcard">
          <strong>{periodTitle(schedulePeriod(s))} সংশোধনের জন্য ফেরত এসেছে</strong>
          {s.approver_note && <div>“{s.approver_note}”</div>}
          <span className="small">খুলে ঠিক করুন, তারপর আবার জমা দিন →</span>
        </Link>
      ))}

      {groupCount === 0 && (
        <div className="card hint-box">
          <strong>শুরুতে একটি কাজ:</strong> আপনার কৃষক গ্রুপগুলোর নাম, ঠিকানা ও মোবাইল একবার লিখে রাখুন। তাহলে প্রতি পক্ষে শুধু বাছাই করলেই হবে।
          <div style={{ marginTop: 8 }}><Link to="/groups" className="btn">গ্রুপ তালিকা তৈরি করুন</Link></div>
        </div>
      )}

      <section className="card focus">
        <div className="eyebrow">পরের পক্ষ</div>
        <h1>{periodTitle(focus)}</h1>
        <div className="muted">{periodRange(focus)}</div>
        {list === null ? (
          <p className="muted">লোড হচ্ছে…</p>
        ) : current ? (
          <>
            <StatusSteps status={current.status} />
            {fc !== undefined && (
              <div className="progress">
                <div className="pbar"><span style={{ width: `${(fc / GROUP_COUNT) * 100}%` }} /></div>
                <span>{bn(fc)}/১২ গ্রুপ পূরণ</span>
              </div>
            )}
            <Deadline p={focus} daysBefore={daysBefore} done={current.status !== 'draft' && current.status !== 'returned'} />
            <div className="row" style={{ marginTop: 10 }}>
              <Link to={`/schedules/${current.id}`} className="btn">
                {current.status === 'draft' || current.status === 'returned'
                  ? fc !== undefined && fc < GROUP_COUNT ? `বাকি ${bn(GROUP_COUNT - fc)}টি গ্রুপ পূরণ করুন` : 'সূচি খুলুন'
                  : 'সূচি দেখুন'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p>এই পক্ষের সূচি এখনো তৈরি হয়নি।</p>
            <Deadline p={focus} daysBefore={daysBefore} done={false} />
            <div className="row" style={{ marginTop: 10 }}>
              <Link to={`/schedules/new?p=${focus.year}-${focus.month}-${focus.fortnight}`} className="btn">সূচি তৈরি করুন</Link>
            </div>
          </>
        )}
      </section>

      {running && (
        <Link to={`/schedules/${running.id}`} className="card linkcard running">
          <span className="muted small">চলতি পক্ষ · {periodRange(schedulePeriod(running))}</span>
          <span>{periodTitle(schedulePeriod(running))}</span>
          <span className={`badge st-${running.status}`}>{STATUS_SHORT[running.status]}</span>
        </Link>
      )}

      <section className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>সব সূচি</h2>
          <Link to="/groups" className="small">আমার কৃষক গ্রুপ{groupCount ? ` (${bn(groupCount)})` : ''} →</Link>
        </div>
        {list && list.length === 0 && <p className="muted">এখনো কোনো সূচি নেই।</p>}
        {list && list.length > 0 && (
          <ul className="list">
            {list.map((s) => (
              <li key={s.id}>
                <Link to={`/schedules/${s.id}`} className="grow">
                  <strong>{periodTitle(schedulePeriod(s))}</strong>
                  <div className="muted small">{periodRange(schedulePeriod(s))}</div>
                </Link>
                <span className={`badge st-${s.status}`}>{STATUS_SHORT[s.status]}</span>
                {s.status === 'draft' && <button type="button" className="ghost sm" onClick={() => void remove(s)}>মুছুন</button>}
              </li>
            ))}
          </ul>
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
  const [period, setPeriod] = useState<Period>(planningPeriod(today))
  const [rows, setRows] = useState<SaaoRow[] | null>(null)
  const [newUsers, setNewUsers] = useState<number | null>(null)
  const [daysBefore, setDaysBefore] = useState(2)
  const [filter, setFilter] = useState<'all' | 'notyet' | 'mine'>('all')

  useEffect(() => {
    setRows(null)
    periodOverview(period).then(setRows).catch(() => setRows([]))
  }, [period])
  useEffect(() => {
    pendingUsersCount().then(setNewUsers).catch(() => setNewUsers(null))
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
      <section className="card">
        <div className="row between">
          <button type="button" className="ghost sm" aria-label="আগের পক্ষ" onClick={() => setPeriod(prevPeriod(period))}>←</button>
          <div className="pcenter">
            <h1>{periodTitle(period)}</h1>
            <div className="muted small">{periodRange(period)} · <Deadline p={period} daysBefore={daysBefore} done={false} /></div>
          </div>
          <button type="button" className="ghost sm" aria-label="পরের পক্ষ" onClick={() => setPeriod(nextPeriod(period))}>→</button>
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
              <span className="muted">{filter === 'all' ? `সব এসএএও (${bn(rows.length)})` : filter === 'notyet' ? 'যাঁরা জমা দেননি' : 'আপনার কাজ বাকি'}</span>
              {filter !== 'all' && <button type="button" className="ghost sm" onClick={() => setFilter('all')}>সবাই দেখুন</button>}
            </div>
            <ul className="list srows">
              {shown.map((r) => (
                <li key={r.profile.id}>
                  {r.schedule ? (
                    <Link to={`/schedules/${r.schedule.id}`} className="grow">
                      <strong>{r.profile.full_name}</strong>
                      <div className="muted small">{r.profile.block_name ? `${r.profile.block_name} ব্লক · ` : ''}{bn(r.filled)}/১২ গ্রুপ</div>
                    </Link>
                  ) : (
                    <div className="grow">
                      <strong>{r.profile.full_name}</strong>
                      <div className="muted small">{r.profile.block_name ? `${r.profile.block_name} ব্লক` : ''}</div>
                    </div>
                  )}
                  {r.profile.mobile && <a className="call" href={`tel:${r.profile.mobile}`} aria-label={`${r.profile.full_name}-কে ফোন`}>{bn(r.profile.mobile)}</a>}
                  <span className={`badge st-${r.state}`}>{STATE_LABEL[r.state]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="quick">
        <Link to="/review" className="card linkcard"><strong>সূচি পর্যালোচনা</strong><span className="muted small">সব পক্ষের জমা পড়া সূচি</span></Link>
        <Link to="/admin" className="card linkcard"><strong>ইউজার</strong><span className="muted small">{newUsers ? `${bn(newUsers)}জন নতুন সাইনআপ সক্রিয়ের অপেক্ষায়` : 'সাইনআপ সক্রিয় করা, ভূমিকা দেওয়া'}</span></Link>
        <Link to="/settings" className="card linkcard"><strong>সেটিংস</strong><span className="muted small">সরকারি ছুটি, আলোচ্য বিষয়, ব্লক</span></Link>
      </div>
    </div>
  )
}

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return null
  return isReviewer(profile.role) ? <ReviewerHome /> : <SaaoHome />
}
