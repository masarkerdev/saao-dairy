import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../lib/auth'
import { holidayMap, listFarmerGroups, listHolidays } from '../lib/catalog'
import type { FarmerGroup, Holiday } from '../lib/catalog'
import {
  MONTHS, bn, dayKind, defaultPlaces, fmtDayMonth, nextPeriod, periodDates, periodEnd, periodRange, periodStart, planningPeriod, prevPeriod, toISO, todayISO,
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
    listMySchedules(profile.id).then((l) => setExisting(new Set(l.map((s) => s.start_date)))).catch(() => undefined)
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

  return (
    <div className="page narrow">
      <p className="crumb"><Link to="/">← হোম</Link></p>
      <div className="card">
        <h1>নতুন পাক্ষিক সূচি</h1>
        <form onSubmit={onSubmit}>
          <fieldset className="periods">
            <legend>কোন পক্ষের সূচি?</legend>
            {options.map((p) => {
              const k = key(p)
              const has = existing.has(periodStart(p))
              return (
                <label key={k} className={'pcard' + (key(period) === k ? ' on' : '')}>
                  <input type="radio" name="period" checked={key(period) === k} onChange={() => setPeriod(p)} />
                  <span className="pt">{MONTHS[p.month - 1]} {bn(p.year)}, {p.fortnight === 1 ? '১ম' : '২য়'} পক্ষ</span>
                  <span className="muted small">{periodRange(p)}{has ? ' · তৈরি আছে' : ''}</span>
                </label>
              )
            })}
          </fieldset>

          <div className="pinfo">
            <div><b>{bn(dates.length)}</b> দিন</div>
            <div><b>{bn(visitDays)}</b> ভিজিটের দিন (সোম, মঙ্গল, বৃহস্পতি)</div>
            <div><b>{bn(holidays.length)}</b> সরকারি ছুটি</div>
          </div>
          {holidays.length > 0 && (
            <ul className="hlist">
              {holidays.map((h) => <li key={h.holiday_date}>{fmtDayMonth(h.holiday_date)}: {h.name}</li>)}
            </ul>
          )}
          {usesSunday && (
            <p className="warn-text small">ছুটির কারণে ভিজিটের দিন কম, তাই কিছু গ্রুপ রবিবারে বসবে। পরে নিজে তারিখ বদলাতে পারবেন।</p>
          )}

          <label className="check">
            <input type="checkbox" checked={prefill && fgs.length > 0} disabled={!fgs.length} onChange={(e) => setPrefill(e.target.checked)} />
            <span>
              {fgs.length
                ? `আমার গ্রুপ তালিকার প্রথম ${bn(Math.min(12, fgs.length))}টি গ্রুপ নাম, ঠিকানা ও মোবাইলসহ নিজে বসুক`
                : 'আপনার গ্রুপ তালিকা খালি। '}
              {!fgs.length && <Link to="/groups">আগে গ্রুপ তালিকা তৈরি করুন</Link>}
            </span>
          </label>

          {already && <p className="err">এই পক্ষের সূচি আগেই তৈরি করা আছে। হোম থেকে খুলুন।</p>}
          {error && <p className="err">{error}</p>}
          <button disabled={busy || already}>{busy ? 'তৈরি হচ্ছে…' : 'সূচি তৈরি করুন'}</button>
        </form>
      </div>
    </div>
  )
}
