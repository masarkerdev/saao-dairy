import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import {
  addHoliday, addLocation, addTopic, deleteHoliday, deleteLocation, deleteTopic, getSubmitDaysBefore, listHolidays, listLocations,
  listTopics, setSubmitDaysBefore,
} from '../lib/catalog'
import type { Holiday, Location, Topic } from '../lib/catalog'
import { MONTHS, WEEKDAYS, bn, dow, fmtDate, toISO, todayISO } from '../lib/period'
import { errMsg } from '../lib/schedules'

// উপজেলার তালিকা: সরকারি ছুটি, জমার শেষ সময়, আলোচ্য বিষয়, ব্লক ও ইউনিয়ন (কো-এডমিন ও এডমিন)
export default function Settings() {
  const { confirm, toast } = useFeedback()
  const thisYear = Number(todayISO().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const [hol, setHol] = useState<Holiday[] | null>(null)
  const [hForm, setHForm] = useState({ date: todayISO(), name: '' })
  const [days, setDays] = useState<number | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [tForm, setTForm] = useState({ topic: '', months: [] as number[] })
  const [locs, setLocs] = useState<Location[]>([])
  const [lForm, setLForm] = useState({ kind: 'block' as 'union' | 'block', name: '' })

  useEffect(() => {
    setHol(null)
    listHolidays(`${year}-01-01`, `${year}-12-31`).then(setHol).catch(() => setHol([]))
  }, [year])
  useEffect(() => {
    getSubmitDaysBefore().then(setDays).catch(() => setDays(2))
    listTopics().then(setTopics).catch(() => undefined)
    listLocations().then(setLocs).catch(() => undefined)
  }, [])

  const fail = (e: unknown, m: string) => toast(errMsg(e, m), 'err')

  async function addH(e: FormEvent) {
    e.preventDefault()
    if (!hForm.name.trim()) return toast('ছুটির নাম লিখুন', 'err')
    try {
      await addHoliday(hForm.date, hForm.name)
      if (Number(hForm.date.slice(0, 4)) === year) setHol((l) => [...(l ?? []), { holiday_date: hForm.date, name: hForm.name.trim() }].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
      toast(`${fmtDate(hForm.date)} ছুটি যোগ হয়েছে। এই তারিখে যাদের গ্রুপ আছে তাদের সূচিতে সতর্কবার্তা দেখাবে।`)
      setHForm({ ...hForm, name: '' })
    } catch (err) {
      fail(err, (err as { code?: string }).code === '23505' ? 'এই তারিখে ছুটি আগেই আছে।' : 'ছুটি যোগ করা যায়নি।')
    }
  }
  async function delH(h: Holiday) {
    if (!(await confirm(`${fmtDate(h.holiday_date)} (${h.name}) ছুটির তালিকা থেকে মুছবেন?`, { ok: 'মুছুন', danger: true }))) return
    try { await deleteHoliday(h.holiday_date); setHol((l) => (l ?? []).filter((x) => x.holiday_date !== h.holiday_date)) } catch (err) { fail(err, 'মোছা যায়নি।') }
  }
  async function saveDays() {
    if (days === null || days < 0 || days > 15) return toast('০ থেকে ১৫ দিনের মধ্যে দিন', 'err')
    try { await setSubmitDaysBefore(days); toast('জমার শেষ সময় সেভ হয়েছে') } catch (err) { fail(err, 'সেভ করা যায়নি।') }
  }
  async function addT(e: FormEvent) {
    e.preventDefault()
    if (!tForm.topic.trim()) return toast('বিষয় লিখুন', 'err')
    try {
      await addTopic(tForm.topic, tForm.months, topics.length + 1)
      setTopics(await listTopics())
      setTForm({ topic: '', months: [] })
      toast('বিষয় যোগ হয়েছে')
    } catch (err) { fail(err, 'বিষয় যোগ করা যায়নি।') }
  }
  async function delT(t: Topic) {
    if (!(await confirm(`"${t.topic}" প্রস্তাবের তালিকা থেকে মুছবেন?`, { ok: 'মুছুন', danger: true }))) return
    try { await deleteTopic(t.id); setTopics((l) => l.filter((x) => x.id !== t.id)) } catch (err) { fail(err, 'মোছা যায়নি।') }
  }
  async function addL(e: FormEvent) {
    e.preventDefault()
    if (!lForm.name.trim()) return toast('নাম লিখুন', 'err')
    try {
      await addLocation(lForm.kind, lForm.name, locs.filter((l) => l.kind === lForm.kind).length + 1)
      setLocs(await listLocations())
      setLForm({ ...lForm, name: '' })
    } catch (err) { fail(err, 'যোগ করা যায়নি।') }
  }
  async function delL(l: Location) {
    if (!(await confirm(`"${l.name}" তালিকা থেকে মুছবেন?`, { ok: 'মুছুন', danger: true }))) return
    try { await deleteLocation(l.id); setLocs((x) => x.filter((y) => y.id !== l.id)) } catch (err) { fail(err, 'মোছা যায়নি।') }
  }

  const toggleMonth = (m: number) =>
    setTForm((f) => ({ ...f, months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m].sort((a, b) => a - b) }))

  return (
    <div className="page narrow">
      <p className="crumb"><Link to="/">← হোম</Link></p>
      <h1>সেটিংস</h1>

      <section className="card sec" id="holidays">
        <div className="row between">
          <h2>সরকারি ছুটি</h2>
          <div className="row tight">
            <button type="button" className="ghost sm" onClick={() => setYear(year - 1)} aria-label="আগের বছর">←</button>
            <b>{bn(year)}</b>
            <button type="button" className="ghost sm" onClick={() => setYear(year + 1)} aria-label="পরের বছর">→</button>
          </div>
        </div>
        <p className="muted small">সরকারি প্রজ্ঞাপন দেখে তারিখগুলো একবার তুলুন। সব এসএএও-র সূচিতে এই দিনে গ্রুপ ভিজিট বসবে না।</p>
        <form className="inline-form" onSubmit={addH}>
          <input type="date" value={hForm.date} onChange={(e) => setHForm({ ...hForm, date: e.target.value })} aria-label="তারিখ" />
          <input value={hForm.name} placeholder="ছুটির নাম, যেমন: বিজয় দিবস" onChange={(e) => setHForm({ ...hForm, name: e.target.value })} aria-label="ছুটির নাম" />
          <button>যোগ করুন</button>
        </form>
        {!hol && <p className="muted">লোড হচ্ছে…</p>}
        {hol && hol.length === 0 && <p className="muted">{bn(year)} সালের কোনো ছুটি এখনো তোলা হয়নি।</p>}
        {hol && hol.length > 0 && (
          <ul className="list">
            {hol.map((h) => (
              <li key={h.holiday_date}>
                <span className="grow"><b>{fmtDate(h.holiday_date)}</b> <span className="muted">{WEEKDAYS[dow(h.holiday_date)]}</span> · {h.name}</span>
                <button type="button" className="ghost sm danger-text" onClick={() => void delH(h)}>মুছুন</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card sec">
        <h2>জমার শেষ সময়</h2>
        <div className="row" style={{ alignItems: 'center' }}>
          <span>পক্ষ শুরুর</span>
          <input type="number" min={0} max={15} style={{ width: '5em' }} value={days ?? ''} onChange={(e) => setDays(Number(e.target.value))} aria-label="দিন" />
          <span>দিন আগে</span>
          <button type="button" className="ghost" onClick={() => void saveDays()}>সেভ করুন</button>
        </div>
        <p className="muted small">যেমন ২ দিলে ১৬ তারিখের পক্ষের সূচি ১৪ তারিখের মধ্যে জমা দিতে হবে। হোমে বাকি দিন দেখাবে।</p>
      </section>

      <section className="card sec">
        <h2>আলোচ্য বিষয়ের প্রস্তাব</h2>
        <p className="muted small">এসএএও-রা তথ্য পূরণের সময় এগুলো এক ট্যাপে বাছতে পারেন। মাস বাছলে শুধু সেই মাসের পক্ষে আগে দেখাবে; মাস না বাছলে সারা বছর।</p>
        <form onSubmit={addT} className="tform">
          <input value={tForm.topic} placeholder="নতুন বিষয়" onChange={(e) => setTForm({ ...tForm, topic: e.target.value })} aria-label="নতুন বিষয়" />
          <div className="chips">
            {MONTHS.map((m, i) => (
              <button type="button" key={m} className={'chip' + (tForm.months.includes(i + 1) ? ' on' : '')} onClick={() => toggleMonth(i + 1)}>{m}</button>
            ))}
          </div>
          <button>বিষয় যোগ করুন</button>
        </form>
        <ul className="list">
          {topics.map((t) => (
            <li key={t.id}>
              <span className="grow">{t.topic}
                <span className="muted small"> · {t.months.length ? t.months.map((m) => MONTHS[m - 1]).join(', ') : 'সারা বছর'}</span>
              </span>
              <button type="button" className="ghost sm danger-text" onClick={() => void delT(t)}>মুছুন</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card sec">
        <h2>ব্লক ও ইউনিয়ন</h2>
        <p className="muted small">সাইনআপের সময় এসএএও-রা এই তালিকা থেকে বাছবেন, তাই নামগুলো সবার এক রকম থাকবে। ইউনিয়নের তালিকা মিলিয়ে নিন।</p>
        <form className="inline-form" onSubmit={addL}>
          <select value={lForm.kind} onChange={(e) => setLForm({ ...lForm, kind: e.target.value as 'union' | 'block' })} aria-label="ধরন">
            <option value="block">ব্লক</option>
            <option value="union">ইউনিয়ন</option>
          </select>
          <input value={lForm.name} placeholder="নাম" onChange={(e) => setLForm({ ...lForm, name: e.target.value })} aria-label="নাম" />
          <button>যোগ করুন</button>
        </form>
        <div className="two">
          {(['block', 'union'] as const).map((k) => (
            <div key={k}>
              <h3>{k === 'block' ? 'ব্লক' : 'ইউনিয়ন'}</h3>
              {locs.filter((l) => l.kind === k).length === 0 && <p className="muted small">এখনো নেই।{k === 'block' ? ' না থাকলে সাইনআপে ব্লকের নাম লিখে দিতে হবে।' : ''}</p>}
              <ul className="list compact">
                {locs.filter((l) => l.kind === k).map((l) => (
                  <li key={l.id}><span className="grow">{l.name}</span><button type="button" className="ghost sm danger-text" onClick={() => void delL(l)}>মুছুন</button></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
