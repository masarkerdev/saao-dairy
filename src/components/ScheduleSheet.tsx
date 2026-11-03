import { useEffect, useLayoutEffect, useRef } from 'react'
import { WEEKDAYS, bn, dayKind, dow, fmtDate, toISO } from '../lib/period'
import type { HolidayMap } from '../lib/period'
import type { PokkhoPage } from '../lib/month'
import { displayNumbers, g2 } from '../lib/schedules'

// ছবির ফর্মের কাঠামো, এক পাতায় এক পক্ষ। শুধু দেখানো, প্রিন্ট ও PDF-এর জন্য।
// পাতার মাপ: A4 আড়াআড়ি, চারদিকে ৮ মিমি মার্জিন → লেখার জায়গা ২৮১ × ১৯৪ মিমি।
export const SHEET_W_MM = 281
export const SHEET_H_MM = 194
const MM = 96 / 25.4 // ১ মিমি = কত পিক্সেল

// পর্দায় লেখা ১৩px। প্রিন্ট ও PDF-এ এক পক্ষ এক পাতায় রাখতে লেখা বেশি হলে আকার কমে (১৩px থেকে ৭px পর্যন্ত)।
export const SCREEN_FS = 13
export function fitSheet(el: HTMLElement) {
  const limit = SHEET_H_MM * MM - 2
  let fs = SCREEN_FS
  el.style.setProperty('--fs', `${fs}px`)
  while (el.scrollHeight > limit && fs > 7) {
    fs -= 0.25
    el.style.setProperty('--fs', `${fs}px`)
  }
  return fs
}
export function unfitSheet(el: HTMLElement) {
  el.style.setProperty('--fs', `${SCREEN_FS}px`)
}
export const fitAll = (root: ParentNode = document) => root.querySelectorAll<HTMLElement>('.sheet').forEach(fitSheet)
export const unfitAll = (root: ParentNode = document) => root.querySelectorAll<HTMLElement>('.sheet').forEach(unfitSheet)

interface Props {
  page: PokkhoPage
  monthName: string
  holidays: HolidayMap
  signer: string[]
}

const SUNDAY_WORK = 'কৃষক সভা, প্রকল্প কাজ, প্রদর্শনী স্থাপন ও অন্যান্য কাজ'
const TOPIC_NO = ['১', '২', '৩', '৪', '৫']

export default function ScheduleSheet({ page, monthName, holidays, signer }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const displayNo = displayNumbers(page.groups)
  const s = page.schedule
  const approvedNote = s?.status === 'approved' && s.approved_at ? `অনলাইনে অনুমোদিত: ${fmtDate(toISO(new Date(s.approved_at)))}` : ''

  // পর্দায় সবসময় ১৩px
  useLayoutEffect(() => {
    if (ref.current) unfitSheet(ref.current)
  })
  // ব্রাউজারের প্রিন্টে (Ctrl+P সহ) এক পাতায় আঁটানো, প্রিন্ট শেষে আবার ১৩px
  useEffect(() => {
    const before = () => { if (ref.current) fitSheet(ref.current) }
    const after = () => { if (ref.current) unfitSheet(ref.current) }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [])

  // কোন তারিখে কোন গ্রুপ (সকাল/দুপুর)
  const at: Record<string, { 1?: number; 2?: number }> = {}
  for (const [k, g] of Object.entries(page.groups)) {
    if (!g.visit_date || !g.slot) continue
    at[g.visit_date] = { ...(at[g.visit_date] ?? {}), [g.slot]: Number(k) }
  }

  const dayCell = (d: string) => (
    <td className="dy">
      <b>{WEEKDAYS[dow(d)]}</b>
      <small>{fmtDate(d)}</small>
      {holidays[d] && at[d] && <small className="hol">({holidays[d]})</small>}
    </td>
  )

  const info = (no?: number) => {
    const g = no ? page.groups[no] : undefined
    if (!no) return <td className="gi" />
    return (
      <td className="gi">
        <div className="gno">গ্রুপ নং -{g2(displayNo[no] ?? no)}</div>
        {g?.group_name && <div>{g.group_name}</div>}
        {g?.president && <div>সভাপতি: {g.president}</div>}
        {g?.address && <div>{g.address}</div>}
        {g?.mobile && <div>মোবাইল: {bn(g.mobile)}</div>}
      </td>
    )
  }

  const topics = (no?: number) => (
    <td className="tp">
      {no !== undefined && TOPIC_NO.map((n, i) => (
        <div key={n} className="tl"><span className="tn">{n}।</span>{page.groups[no]?.topics[i] ?? ''}</div>
      ))}
    </td>
  )

  const row = (d: string) => {
    if (at[d]) {
      const a = at[d][1]
      const b = at[d][2]
      return (
        <tr key={d} className="grp">
          {dayCell(d)}
          {info(a)}
          {topics(a ?? (b !== undefined ? -1 : undefined))}
          {info(b)}
          {topics(b ?? (a !== undefined ? -1 : undefined))}
          <td className="aicc">{page.notes[d] ?? ''}</td>
        </tr>
      )
    }
    const full = (text: string) => (
      <tr key={d}>{dayCell(d)}<td colSpan={5} className="mid">{text}</td></tr>
    )
    switch (dayKind(d, holidays)) {
      case 'holiday': return full(`সরকারি ছুটি (${holidays[d]})`)
      case 'meeting': return full('উপজেলা অফিসে সাপ্তাহিক সভা')
      case 'sunday': return full(SUNDAY_WORK)
      case 'weekend':
        return <tr key={d}>{dayCell(d)}<td>সাপ্তাহিক ছুটি</td><td /><td /><td /><td /></tr>
      default: return full('মাঠ পরিদর্শন ও অন্যান্য কাজ')
    }
  }

  const f = page.period.fortnight
  return (
    <div className="paper">
      <div className="sheet" ref={ref}>
        <div className="top">
          <span>উপসহকারী কৃষি কর্মকর্তাগণের পাক্ষিক ভ্রমণসূচী</span>
          <span>মাসের নামঃ {monthName}</span>
          <span>পক্ষঃ <s className={f === 1 ? 'keep' : ''}>১ম পক্ষ</s>/ <s className={f === 2 ? 'keep' : ''}>২য় পক্ষ</s></span>
        </div>
        <table>
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th rowSpan={3}>বার ও তারিখ</th>
              <th colSpan={5}>{page.label}</th>
            </tr>
            <tr>
              <th rowSpan={2}>কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর</th>
              <th>৯.০০-১১.৩০</th>
              <th rowSpan={2}>কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর</th>
              <th>১২.৩০-৩.০০</th>
              <th>৩.০০-৫.০০</th>
            </tr>
            <tr>
              <th>কৃষক গ্রুপে আলোচ্য বিষয়</th>
              <th>কৃষক গ্রুপে আলোচ্য বিষয়</th>
              <th>কৃষি তথ্য ও পরামর্শ কেন্দ্র</th>
            </tr>
            {page.dates.map(row)}
          </tbody>
        </table>
        <div className="note">নামাজ ও মধ্যাহ্ন বিরতিসহ</div>
        <div className="sg">
          <div>
            অনুমোদনকারী কর্মকর্তার স্বাক্ষর ও সীল
            {approvedNote && <div className="appr">{approvedNote}</div>}
          </div>
          <div>
            দাখিলকারী এসএএও এর স্বাক্ষর ও সীল
            {signer.map((x) => <div key={x} className="sgn">{x}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
