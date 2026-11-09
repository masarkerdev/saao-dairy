import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import Icon from '../components/Icon'
import { useAuth } from '../lib/auth'
import { blocksFor, listCharges } from '../lib/blocks'
import type { BlockCharge } from '../lib/blocks'
import { getSubmitDaysBefore, holidayMap, listFarmerGroups, listHolidays } from '../lib/catalog'
import type { FarmerGroup, Holiday } from '../lib/catalog'
import {
  WEEKDAYS, bn, dayKind, fmtDayMonth, freePlaces, monthDeadline, monthEnd, monthPeriods, monthStart, monthTitle,
  nextMonth, periodDates, periodRange, periodStart, planningMonth, prevMonth, sameMonth, todayISO,
} from '../lib/period'
import type { HolidayMap, Month, Period } from '../lib/period'
import { createMonth, errMsg, listMySchedules, takenPlaces } from '../lib/schedules'
import type { Schedule } from '../lib/schedules'

const mkey = (m: Month) => `${m.year}-${m.month}`
const ek = (start: string, block: string) => `${start}|${block}`
// ?m=2026-12 (নতুন) বা ?p=2026-12-1 (পুরোনো লিংক)
const parseMonth = (m: string | null, p: string | null): Month | null => {
  const x = (m ?? p)?.match(/^(\d{4})-(\d{1,2})/)
  return x ? { year: Number(x[1]), month: Number(x[2]) } : null
}

const WD = [6, 0, 1, 2, 3, 4, 5].map((i) => WEEKDAYS[i].slice(0, 2))
const KIND_LABEL: Record<string, string> = { visit: 'ভিজিট', sunday: 'রবিবার', meeting: 'সভা (বুধ)', weekend: 'সাপ্তাহিক ছুটি', holiday: 'সরকারি ছুটি' }

// এক পক্ষের ছোট ক্যালেন্ডার (সপ্তাহ শুরু শনিবার)
function MiniCal({ p, hmap, taken }: { p: Period; hmap: HolidayMap; taken: Set<string> }) {
  const dates = periodDates(p)
  const places = freePlaces(p, hmap, taken)
  const count: Record<string, number> = {}
  places.forEach((pl) => { count[pl.visit_date] = (count[pl.visit_date] ?? 0) + 1 })
  const firstDow = (new Date(dates[0] + 'T00:00:00').getDay() + 1) % 7
  return (
    <div className="mc-block">
      <div className="mc-title">{p.fortnight === 1 ? '১ম' : '২য়'} পক্ষ · {periodRange(p)} <span className="muted">({bn(places.length)}টি গ্রুপের জায়গা)</span></div>
      <div className="minical" role="grid" aria-label={`${p.fortnight === 1 ? '১ম' : '২য়'} পক্ষের ক্যালেন্ডার`}>
        {WD.map((w) => <span key={w} className="mc-h">{w}</span>)}
        {Array.from({ length: firstDow }, (_, i) => <span key={'b' + i} />)}
        {dates.map((d) => {
          const k = dayKind(d, hmap)
          const n = count[d] ?? 0
          return (
            <span key={d} className={`mc-d k-${k}`} title={`${fmtDayMonth(d)}: ${hmap[d] ?? KIND_LABEL[k]}${n ? ` · ${bn(n)}টি গ্রুপ` : ''}`}>
              <b>{bn(Number(d.slice(8)))}</b>
              {n > 0 && <i>{bn(n)}</i>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// নতুন মাসিক সূচি: দুই পক্ষ একসাথে তৈরি, পূরণ শেষে মাসে একবার জমা
export default function NewSchedule() {
  const { profile } = useAuth()
  const { toast } = useFeedback()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const today = todayISO()
  const [month, setMonth] = useState<Month>(parseMonth(params.get('m'), params.get('p')) ?? planningMonth(today))
  const [mine, setMine] = useState<Schedule[]>([])
  const [charges, setCharges] = useState<BlockCharge[]>([])
  const [block, setBlock] = useState<string>(params.get('b') ?? '')
  const [taken, setTaken] = useState<[Set<string>, Set<string>]>([new Set(), new Set()])
  const [fgs, setFgs] = useState<FarmerGroup[]>([])
  const [prefill, setPrefill] = useState(true)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [daysBefore, setDaysBefore] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // বাছাইয়ের জন্য: চলতি মাস থেকে সামনের ৩ মাস
  const options = useMemo(() => {
    let m = prevMonth(planningMonth(today))
    const out: Month[] = []
    for (let i = 0; i < 4; i++) { out.push(m); m = nextMonth(m) }
    return out
  }, [today])

  useEffect(() => {
    if (!profile) return
    listMySchedules(profile.id).then((l) => {
      setMine(l)
      // লিংকে মাস না থাকলে: সামনের প্রথম যে মাসের সূচি এখনো হয়নি
      if (!params.get('m') && !params.get('p')) {
        const b = params.get('b') ?? profile.block_name ?? ''
        const has = (m: Month) => l.some((s) => s.start_date === monthStart(m) && (s.block_name ?? '') === b)
        let m = planningMonth(today)
        for (let i = 0; i < 3 && has(m); i++) m = nextMonth(m)
        if (!has(m)) setMonth(m)
      }
    }).catch(() => undefined)
    listFarmerGroups(profile.id).then((l) => setFgs(l.filter((f) => f.active))).catch(() => undefined)
    listCharges(profile.id).then(setCharges).catch(() => setCharges([]))
    getSubmitDaysBefore().then(setDaysBefore).catch(() => undefined)
    if (!params.get('b')) setBlock(profile.block_name ?? '')
  }, [profile])

  useEffect(() => {
    listHolidays(monthStart(month), monthEnd(month)).then(setHolidays).catch(() => setHolidays([]))
  }, [month])

  const ps = monthPeriods(month)
  const hmap = holidayMap(holidays)
  const blocks = blocksFor(profile, charges, ps[0])
  const cur = blocks.find((b) => b.name === block) ?? blocks[0]
  const ownBlock = profile?.block_name ?? ''
  const blockFgs = fgs.filter((f) => (f.block_name || ownBlock) === cur.name)
  const have = new Set(mine.map((s) => ek(s.start_date, s.block_name ?? '')))
  const existing = ps.map((p) => mine.find((s) => s.start_date === periodStart(p) && (s.block_name ?? '') === cur.name) ?? null)
  const both = existing[0] && existing[1]
  const visitDays = ps.flatMap((p) => periodDates(p)).filter((d) => dayKind(d, hmap) === 'visit').length
  const dl = monthDeadline(month, daysBefore)

  // অন্য ব্লকের সূচিতে নেওয়া বেলা (দুই পক্ষ)
  useEffect(() => {
    if (!profile) return
    Promise.all(ps.map((p) => takenPlaces(profile.id, periodStart(p), undefined, cur.name).catch(() => new Set<string>())))
      .then((t) => setTaken([t[0], t[1]]))
  }, [profile, month.year, month.month, cur.name])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!profile) return
    if (both) { nav(`/schedules/${existing[0]!.id}`); return }
    setBusy(true)
    try {
      const s = await createMonth(profile.id, month, hmap, prefill ? blockFgs : [], cur.name, taken, existing)
      toast(existing.some(Boolean) ? 'বাকি পক্ষের সূচি তৈরি হয়েছে' : 'মাসের সূচি তৈরি হয়েছে')
      nav(`/schedules/${s.id}`, { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '23505' ? 'এই মাসের সূচি আগেই তৈরি করা আছে।' : errMsg(err, 'সূচি তৈরি করা যায়নি। আবার চেষ্টা করুন।'))
      setBusy(false)
    }
  }

  return (
    <div className="page narrow new-sched">
      <header className="page-head">
        <div>
          <h1>নতুন মাসিক সূচি</h1>
          <p className="muted small">মাস বাছুন। দুই পক্ষের (১-১৫ ও ১৬-শেষ) সূচি একসাথে তৈরি হবে, দুটো পূরণ করে মাসে একবার জমা দেবেন।</p>
        </div>
      </header>
      <form onSubmit={onSubmit} className="ns-form">
        {blocks.length > 1 && (
          <section className="card">
            <h2><Icon name="map" size={18} /> কোন ব্লকের সূচি?</h2>
            <p className="muted small" style={{ margin: '0 0 10px' }}>প্রতিটি ব্লকের সূচি আলাদা জমা ও প্রিন্ট হয়।</p>
            <div className="periods">
              {blocks.map((b) => (
                <label key={b.name} className={'pcard' + (cur.name === b.name ? ' on' : '')}>
                  <input type="radio" name="block" checked={cur.name === b.name} onChange={() => setBlock(b.name)} />
                  <span className="pc-badge"><Icon name="map" size={20} /></span>
                  <span className="pc-text">
                    <span className="pt">{b.name || 'নিজ'} ব্লক</span>
                    <span className="muted small">{b.extra ? 'অতিরিক্ত দায়িত্ব' : 'নিজ ব্লক'}</span>
                  </span>
                  {cur.name === b.name && <Icon name="check" size={18} className="pc-check" />}
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2><span className="stepno">১</span> কোন মাসের সূচি?</h2>
          <fieldset className="periods">
            <legend className="sr-only">মাস</legend>
            {options.map((m) => {
              const n = monthPeriods(m).filter((p) => have.has(ek(periodStart(p), cur.name))).length
              const on = sameMonth(m, month)
              return (
                <label key={mkey(m)} className={'pcard' + (on ? ' on' : '') + (n === 2 ? ' has' : '')}>
                  <input type="radio" name="month" checked={on} onChange={() => setMonth(m)} />
                  <span className="pc-badge"><Icon name="calendar" size={20} /></span>
                  <span className="pc-text">
                    <span className="pt">{monthTitle(m)}</span>
                    <span className="muted small">দুই পক্ষ{sameMonth(m, planningMonth(today)) ? ' · পরের মাস' : ''}</span>
                  </span>
                  {n === 2 ? <span className="badge st-approved">তৈরি আছে</span>
                    : n === 1 ? <span className="badge st-submitted">এক পক্ষ আছে</span>
                      : on ? <Icon name="check" size={18} className="pc-check" /> : null}
                </label>
              )
            })}
          </fieldset>
          <p className="muted small" style={{ margin: '10px 0 0' }}>জমার শেষ সময়: {fmtDayMonth(dl)} (মাস শুরুর {bn(daysBefore)} দিন আগে)</p>
        </section>

        <section className="card">
          <h2><span className="stepno">২</span> এই মাসের দিনগুলো</h2>
          <div className="pinfo">
            <div><b>{bn(ps.flatMap((p) => periodDates(p)).length)}</b><span>দিন</span></div>
            <div><b>{bn(visitDays)}</b><span>ভিজিটের দিন</span></div>
            <div className={holidays.length ? 'hl' : ''}><b>{bn(holidays.length)}</b><span>সরকারি ছুটি</span></div>
          </div>
          <div className="mc-two">
            {ps.map((p, i) => <MiniCal key={p.fortnight} p={p} hmap={hmap} taken={taken[i]} />)}
          </div>
          <div className="mc-legend">
            <span><i className="k-visit" />ভিজিট (গ্রুপ সংখ্যা)</span>
            <span><i className="k-meeting" />বুধবার সভা</span>
            <span><i className="k-weekend" />শুক্র-শনি</span>
            <span><i className="k-sunday" />রবিবার</span>
            <span><i className="k-holiday" />সরকারি ছুটি</span>
          </div>
          {holidays.length > 0 && (
            <ul className="hlist">
              {holidays.map((h) => <li key={h.holiday_date}><Icon name="sun" size={16} /> {fmtDayMonth(h.holiday_date)}: {h.name}</li>)}
            </ul>
          )}
          {(taken[0].size > 0 || taken[1].size > 0) && (
            <p className="note-soft">অন্য ব্লকের সূচিতে নেওয়া বেলাগুলো বাদ দিয়ে এই ব্লকের গ্রুপ বসবে। জায়গা কম পড়লে বাকি গ্রুপের তারিখ পরে নিজে বাছবেন।</p>
          )}
        </section>

        <section className="card">
          <h2><span className="stepno">৩</span> গ্রুপের তথ্য</h2>
          <label className={'prefill' + (prefill && blockFgs.length ? ' on' : '')}>
            <input type="checkbox" checked={prefill && blockFgs.length > 0} disabled={!blockFgs.length} onChange={(e) => setPrefill(e.target.checked)} />
            <span className="pf-ico"><Icon name="groups" /></span>
            <span>
              {blockFgs.length
                ? blockFgs.length > 12
                  ? <>আমার গ্রুপ তালিকার প্রথম <b>১২</b>টি ১ম পক্ষে, পরের <b>{bn(Math.min(12, blockFgs.length - 12))}</b>টি{blockFgs.length < 24 ? ' (আর প্রথম থেকে বাকিগুলো)' : ''} ২য় পক্ষে নিজে বসুক</>
                  : <>আমার গ্রুপ তালিকার <b>{bn(blockFgs.length)}</b>টি গ্রুপ দুই পক্ষেই নাম, ঠিকানা ও মোবাইলসহ নিজে বসুক</>
                : 'আপনার গ্রুপ তালিকা খালি। '}
              {!blockFgs.length && <Link to={`/groups?b=${encodeURIComponent(cur.name)}`}>আগে {cur.extra ? `${cur.name} ব্লকের ` : ''}গ্রুপ তালিকা তৈরি করুন</Link>}
            </span>
          </label>
        </section>

        {both && <p className="note-soft">এই মাসের দুই পক্ষের সূচিই তৈরি আছে। নিচের বোতাম চাপলে খুলবে।</p>}
        {!both && existing.some(Boolean) && <p className="note-soft warn">এই মাসের এক পক্ষের সূচি আগে থেকে আছে। বাকি পক্ষেরটা তৈরি হবে।</p>}
        {error && <p className="form-err">{error}</p>}
        <div className="sticky-cta">
          <button className="btn-lg" disabled={busy}>
            {busy ? 'তৈরি হচ্ছে…' : both ? <>সূচি খুলুন <Icon name="right" size={18} /></> : <>মাসের সূচি তৈরি করুন <Icon name="right" size={18} /></>}
          </button>
        </div>
      </form>
    </div>
  )
}
