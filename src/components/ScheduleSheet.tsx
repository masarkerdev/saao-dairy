import { WEEKDAYS, dayKind, dow, fmtDate } from '../lib/period'
import type { HolidayMap } from '../lib/period'
import { g2 } from '../lib/schedules'
import type { GroupMap, NoteMap } from '../lib/schedules'

// ছবির ফর্মের কাঠামো: শুধু দেখানো ও প্রিন্টের জন্য। সারি = পক্ষের প্রতিটি তারিখ।
interface Props {
  label: string // "১ম সপ্তাহ" / "২য় সপ্তাহ"
  dates: string[]
  month: string
  fortnight: 1 | 2
  holidays: HolidayMap
  groups: GroupMap
  displayNo: Record<number, number>
  notes: NoteMap
  signer: string[]
  approvedNote?: string
}

const LINES = [0, 1, 2, 3, 4]
const SUNDAY_WORK = 'কৃষক সভা, প্রকল্প কাজ, প্রদর্শনী স্থাপন ও অন্যান্য কাজ'

export default function ScheduleSheet(p: Props) {
  // কোন তারিখে কোন গ্রুপ (সকাল/দুপুর)
  const at: Record<string, { 1?: number; 2?: number }> = {}
  for (const [k, g] of Object.entries(p.groups)) {
    if (!g.visit_date || !g.slot) continue
    at[g.visit_date] = { ...(at[g.visit_date] ?? {}), [g.slot]: Number(k) }
  }
  const groupDays = p.dates.filter((d) => at[d])
  // ভিজিটের দিন বেশি হলে লাইনের উচ্চতা কমিয়ে এক পৃষ্ঠায় রাখা
  const other = p.dates.length - groupDays.length
  const lh = Math.max(4.2, Math.min(6.6, (150 - other * 7.5) / Math.max(1, groupDays.length * 5)))

  const dayCell = (d: string, rowSpan?: number) => (
    <td className="dy" rowSpan={rowSpan}>
      <b>{WEEKDAYS[dow(d)]}</b>
      <small>{fmtDate(d)}</small>
      {p.holidays[d] && at[d] && <small className="hol">({p.holidays[d]})</small>}
    </td>
  )

  const info = (no?: number) => {
    const g = no ? p.groups[no] : undefined
    return (
      <td rowSpan={5} className="gi">
        {no && g && (g.group_name || g.address || g.mobile) ? (
          <>
            <div className="gno">গ্রুপ নং -{g2(p.displayNo[no] ?? no)}</div>
            {g.group_name && <div>{g.group_name}</div>}
            {g.address && <div>{g.address}</div>}
            {g.mobile && <div>মোবাইল: {g.mobile.replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)])}</div>}
          </>
        ) : no ? <div className="gno">গ্রুপ নং -{g2(p.displayNo[no] ?? no)}</div> : null}
      </td>
    )
  }

  const topic = (no: number | undefined, l: number) => (
    <td className={'tp' + (l === 4 ? ' last' : '')}>
      <span className="tn">{'১২৩৪৫'[l]}।</span> {no ? p.groups[no]?.topics[l] ?? '' : ''}
    </td>
  )

  const groupRows = (d: string) => {
    const a = at[d]?.[1]
    const b = at[d]?.[2]
    return LINES.map((l) => (
      <tr key={`${d}-${l}`} className="grow5">
        {l === 0 && dayCell(d, 5)}
        {l === 0 && info(a)}
        {topic(a, l)}
        {l === 0 && info(b)}
        {topic(b, l)}
        {l === 0 && <td rowSpan={5} className="aicc">{p.notes[d] ?? ''}</td>}
      </tr>
    ))
  }

  const full = (d: string, text: string) => (
    <tr key={d}>
      {dayCell(d)}
      <td colSpan={5} className="mid">{text}</td>
    </tr>
  )

  const weekend = (d: string) => (
    <tr key={d}>
      {dayCell(d)}
      <td>সাপ্তাহিক ছুটি</td>
      <td /><td /><td /><td />
    </tr>
  )

  const row = (d: string) => {
    if (at[d]) return groupRows(d)
    switch (dayKind(d, p.holidays)) {
      case 'holiday': return full(d, `সরকারি ছুটি (${p.holidays[d]})`)
      case 'meeting': return full(d, 'উপজেলা অফিসে সাপ্তাহিক সভা')
      case 'weekend': return weekend(d)
      case 'sunday': return full(d, SUNDAY_WORK)
      default: return full(d, 'মাঠ পরিদর্শন ও অন্যান্য কাজ')
    }
  }

  return (
    <div className="sheet" style={{ ['--lh' as string]: `${lh.toFixed(2)}mm` }}>
      <div className="top">
        <span>উপসহকারী কৃষি কর্মকর্তাগণের পাক্ষিক ভ্রমণসূচী</span>
        <span>মাসের নামঃ {p.month}</span>
        <span>
          পক্ষঃ <s className={p.fortnight === 1 ? 'keep' : ''}>১ম পক্ষ</s>/{' '}
          <s className={p.fortnight === 2 ? 'keep' : ''}>২য় পক্ষ</s>
        </span>
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
            <th colSpan={5}>{p.label}</th>
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
          {p.dates.map(row)}
        </tbody>
      </table>
      <div className="note">নামাজ ও মধ্যাহ্ন বিরতিসহ</div>
      <div className="sg">
        <div>
          অনুমোদনকারী কর্মকর্তার স্বাক্ষর ও সীল
          {p.approvedNote && <div className="appr">{p.approvedNote}</div>}
        </div>
        <div>
          দাখিলকারী এসএএও এর স্বাক্ষর ও সীল
          {p.signer.map((s) => <div key={s} className="who">{s}</div>)}
        </div>
      </div>
    </div>
  )
}
