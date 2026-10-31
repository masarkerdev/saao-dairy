import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import Icon from '../components/Icon'
import { useAuth } from '../lib/auth'
import { holidayMap, listFarmerGroups, listHolidays } from '../lib/catalog'
import type { FarmerGroup, Holiday } from '../lib/catalog'
import {
  MONTHS, WEEKDAYS, bn, dayKind, defaultPlaces, fmtDayMonth, nextPeriod, periodDates, periodEnd, periodRange, periodStart, planningPeriod, prevPeriod, todayISO,
} from '../lib/period'
import type { Period } from '../lib/period'
import { createSchedule, errMsg, listMySchedules } from '../lib/schedules'

const key = (p: Period) => `${p.year}-${p.month}-${p.fortnight}`
const parseKey = (k: string | null): Period | null => {
  const m = k?.match(/^(\d{4})-(\d{1,2})-([12])$/)
  return m ? { year: Number(m[1]), month: Number(m[2]), fortnight: Number(m[3]) as 1 | 2 } : null
}

export default function NewSchedule() {
  const { profile } = useAuth()
  const { toast } = useFeedback()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const today = todayISO()
  const [period, setPeriod] = useState<Period>(parseKey(params.get('p')) ?? planningPeriod(today))
  const [existing, setExisting] = useState<Set<string>>(new Set())
  const [fgs, setFgs] = useState<FarmerGroup[]>([])
  const [prefill, setPrefill] = useState(true)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // বাছাইয়ের জন্য: আগের পক্ষ থেকে সামনের ৪টি
  const options = useMemo(() => {
    let p = prevPeriod(planningPeriod(today))
    const out: Period[] = []
    for (let i = 0; i < 6; i++) { out.push(p); p = nextPeriod(p) }
    return out
  }, [today])

  useEffect(() => {
    if (!profile) return
    listMySchedules(profile.id).then((l) => {
      const have = new Set(l.map((s) => s.start_date))
      setExisting(have)
      // লিংকে পক্ষ না থাকলে: সামনের প্রথম যে পক্ষের সূচি এখনো হয়নি
      if (!params.get('p')) {
        let p = planningPeriod(today)
        for (let i = 0; i < 4 && have.has(periodStart(p)); i++) p = nextPeriod(p)
        if (!have.has(periodStart(p))) setPeriod(p)
      }
    }).catch(() => undefined)
    listFarmerGroups(profile.id).then((l) => setFgs(l.filter((f) => f.active))).catch(() => undefined)
  }, [profile])

  useEffect(() => {
    listHolidays(periodStart(period), periodEnd(period)).then(setHolidays).catch(() => setHolidays([]))
  }, [period])

  const hmap = holidayMap(holidays)
  const dates = periodDates(period)
  const visitDays = dates.filter((d) => dayKind(d, hmap) === 'visit').length
  const places = defaultPlaces(period, hmap)
  const usesSunday = places.some((pl) => dayKind(pl.visit_date, hmap) === 'sunday')
  const already = existing.has(periodStart(period))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!profile || already) return
    setBusy(true)
    try {
      const s = await createSchedule(profile.id, period, hmap, prefill ? fgs.slice(0, 12) : [])
      toast('সূচি তৈরি হয়েছে')
      nav(`/schedules/${s.id}`, { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '23505' ? 'এই পক্ষের সূচি আগেই তৈরি করা আছে।' : errMsg(err, 'সূচি তৈরি করা যায়নি। আবার চেষ্টা করুন।'))
      setBusy(false)
    }
  }

  // ছোট ক্যালেন্ডার: সপ্তাহ শুরু শনিবার (বাংলাদেশের অফিস-ক্যালেন্ডারের মতো)
  const placeCount: Record<string, number> = {}
  places.forEach((pl) => { placeCount[pl.visit_date] = (placeCount[pl.visit_date] ?? 0) + 1 })
  const firstDow = (new Date(dates[0] + 'T00:00:00').getDay() + 1) % 7
  const KIND_LABEL: Record<string, string> = { visit: 'ভিজিট', sunday: 'রবিবার', meeting: 'সভা (বুধ)', weekend: 'সাপ্তাহিক ছুটি', holiday: 'সরকারি ছুটি' }
  const WD = [6, 0, 1, 2, 3, 4, 5].map((i) => WEEKDAYS[i].slice(0, 2))

  return (
    <div className="page narrow new-sched">
      <header className="page-head">
        <div>
          <h1>নতুন পাক্ষিক সূচি</h1>
          <p className="muted small">পক্ষ বাছুন। ১২টি গ্রুপের তারিখ ও বেলা নিজে থেকে বসবে, পরে বদলাতে পারবেন।</p>
        </div>
      </header>
      <form onSubmit={onSubmit} className="ns-form">
        <section className="card">
          <h2><span className="stepno">১</span> কোন পক্ষের সূচি?</h2>
          <fieldset className="periods">
            <legend className="sr-only">পক্ষ</legend>
            {options.map((p) => {
              const k = key(p)
              const has = existing.has(periodStart(p))
              const on = key(period) === k
              return (
                <label key={k} className={'pcard' + (on ? ' on' : '') + (has ? ' has' : '')}>
                  <input type="radio" name="period" checked={on} onChange={() => setPeriod(p)} />
                  <span className="pc-badge">{p.fortnight === 1 ? '১ম' : '২য়'}<small>পক্ষ</small></span>
                  <span className="pc-text">
                    <span className="pt">{MONTHS[p.month - 1]} {bn(p.year)}</span>
                    <span className="muted small">{periodRange(p)}</span>
                  </span>
                  {has ? <span className="badge st-approved">তৈরি আছে</span> : on ? <Icon name="check" size={18} className="pc-check" /> : null}
                </label>
              )
            })}
          </fieldset>
        </section>

        <section className="card">
          <h2><span className="stepno">২</span> এই পক্ষের দিনগুলো</h2>
          <div className="pinfo">
            <div><b>{bn(dates.length)}</b><span>দিন</span></div>
            <div><b>{bn(visitDays)}</b><span>ভিজিটের দিন</span></div>
            <div className={holidays.length ? 'hl' : ''}><b>{bn(holidays.length)}</b><span>সরকারি ছুটি</span></div>
          </div>
          <div className="minical" role="grid" aria-label="পক্ষের ক্যালেন্ডার">
            {WD.map((w) => <span key={w} className="mc-h">{w}</span>)}
            {Array.from({ length: firstDow }, (_, i) => <span key={'b' + i} />)}
            {dates.map((d) => {
              const k = dayKind(d, hmap)
              const n = placeCount[d] ?? 0
              return (
                <span key={d} className={`mc-d k-${k}`} title={`${fmtDayMonth(d)}: ${hmap[d] ?? KIND_LABEL[k]}${n ? ` · ${bn(n)}টি গ্রুপ` : ''}`}>
                  <b>{bn(Number(d.slice(8)))}</b>
                  {n > 0 && <i>{bn(n)}</i>}
                </span>
              )
            })}
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
          {usesSunday && (
            <p className="note-soft warn">ছুটির কারণে ভিজিটের দিন কম, তাই কিছু গ্রুপ রবিবারে বসবে। পরে নিজে তারিখ বদলাতে পারবেন।</p>
          )}
        </section>

        <section className="card">
          <h2><span className="stepno">৩</span> গ্রুপের তথ্য</h2>
          <label className={'prefill' + (prefill && fgs.length ? ' on' : '')}>
            <input type="checkbox" checked={prefill && fgs.length > 0} disabled={!fgs.length} onChange={(e) => setPrefill(e.target.checked)} />
            <span className="pf-ico"><Icon name="groups" /></span>
            <span>
              {fgs.length
                ? <>আমার গ্রুপ তালিকার প্রথম <b>{bn(Math.min(12, fgs.length))}</b>টি গ্রুপ নাম, ঠিকানা ও মোবাইলসহ নিজে বসুক</>
                : 'আপনার গ্রুপ তালিকা খালি। '}
              {!fgs.length && <Link to="/groups">আগে গ্রুপ তালিকা তৈরি করুন</Link>}
            </span>
          </label>
        </section>

        {already && <p className="form-err">এই পক্ষের সূচি আগেই তৈরি করা আছে। হোম থেকে খুলুন।</p>}
        {error && <p className="form-err">{error}</p>}
        <div className="sticky-cta">
          <button className="btn-lg" disabled={busy || already}>{busy ? 'তৈরি হচ্ছে…' : <>সূচি তৈরি করুন <Icon name="right" size={18} /></>}</button>
        </div>
      </form>
    </div>
  )
}
