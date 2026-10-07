import { DAYS, bn, dateFor } from '../lib/schedules'
import type { EntryMap, NoteMap } from '../lib/schedules'

interface Props {
  week: 0 | 1
  start: string
  month: string
  fortnight: number
  signer: string
  entries: EntryMap
  notes: NoteMap
  readOnly: boolean
  onEntry: (group: number, line: number, field: 'f' | 't', value: string) => void
  onNote: (week: number, day: number, value: string) => void
}

const LINES = [0, 1, 2, 3, 4]
const g2 = (n: number) => bn(String(n).padStart(2, '0'))

export default function ScheduleSheet(p: Props) {
  const base = p.week * 6

  const dayCell = (day: number, rowSpan?: number) => (
    <td className="dy" rowSpan={rowSpan}>
      <b>{DAYS[day]}</b>
      <small>{dateFor(p.start, p.week, day)}</small>
    </td>
  )

  const fullRow = (day: number, text: string) => (
    <tr>
      {dayCell(day)}
      <td colSpan={7} className="mid">{text}</td>
    </tr>
  )

  const slot = (g: number, l: number) => {
    const e = p.entries[`${g}-${l}`]
    const last = l === 4 ? ' last' : ''
    return (
      <>
        {l === 0 && <td rowSpan={5} className="gl">গ্রুপ নং -{g2(g)}</td>}
        <td className={'l' + last}>
          <div className="ln">
            <b>{bn(l + 1)}।</b>
            <input className="c" readOnly={p.readOnly} value={e?.f ?? ''} onChange={(ev) => p.onEntry(g, l, 'f', ev.target.value)} />
          </div>
        </td>
        <td className={'l' + last}>
          <input className="c" readOnly={p.readOnly} value={e?.t ?? ''} onChange={(ev) => p.onEntry(g, l, 't', ev.target.value)} />
        </td>
      </>
    )
  }

  const groupDay = (day: number, a: number, b: number) =>
    LINES.map((l) => (
      <tr key={`${day}-${l}`}>
        {l === 0 && dayCell(day, 5)}
        {slot(a, l)}
        {slot(b, l)}
        {l === 0 && (
          <td rowSpan={5}>
            <textarea
              className="nt"
              readOnly={p.readOnly}
              value={p.notes[`${p.week}-${day}`] ?? ''}
              onChange={(ev) => p.onNote(p.week, day, ev.target.value)}
            />
          </td>
        )}
      </tr>
    ))

  return (
    <div className="sheet">
      <div className="top">
        <span>উপসহকারী কৃষি কর্মকর্তাগণের পাক্ষিক ভ্রমণসূচী</span>
        <span>মাসের নাম: {p.month}</span>
        <span>
          পক্ষঃ <span style={{ textDecoration: p.fortnight === 1 ? 'none' : 'line-through' }}>১ম পক্ষ</span> /{' '}
          <span style={{ textDecoration: p.fortnight === 2 ? 'none' : 'line-through' }}>২য় পক্ষ</span>
        </span>
      </div>
      <table>
        <colgroup>
          <col style={{ width: '8%' }} /><col style={{ width: '6.5%' }} /><col style={{ width: '20%' }} /><col style={{ width: '14%' }} />
          <col style={{ width: '6.5%' }} /><col style={{ width: '20%' }} /><col style={{ width: '14%' }} /><col style={{ width: '11%' }} />
        </colgroup>
        <tbody>
          <tr><th rowSpan={3}>বার ও তারিখ</th><th colSpan={7}>{p.week ? '২য়' : '১ম'} সপ্তাহ</th></tr>
          <tr><th colSpan={3}>৯.০০-১১.৩০</th><th colSpan={3}>১২.৩০-৩.০০</th><th>৩.০০-৫.০০</th></tr>
          <tr>
            <th colSpan={2}>কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর</th><th>কৃষক গ্রুপে আলোচ্য বিষয়</th>
            <th colSpan={2}>কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর</th><th>কৃষক গ্রুপে আলোচ্য বিষয়</th>
            <th>কৃষি তথ্য ও পরামর্শ কেন্দ্র</th>
          </tr>
          {fullRow(0, 'উপজেলা অফিসে সাপ্তাহিক সভা')}
          {groupDay(1, base + 1, base + 2)}
          {fullRow(2, 'সাপ্তাহিক ছুটি')}
          {fullRow(3, 'সাপ্তাহিক ছুটি')}
          {fullRow(4, 'কৃষক সভা, প্রকল্প কাজ, প্রদর্শনী স্থাপন ও অন্যান্য কাজ')}
          {groupDay(5, base + 3, base + 4)}
          {groupDay(6, base + 5, base + 6)}
        </tbody>
      </table>
      <div className="note">নামাজ ও মধ্যাহ্ন বিরতিসহ</div>
      <div className="sg">
        <div>অনুমোদনকারী কর্মকর্তার স্বাক্ষর ও সীল</div>
        <div>
          দাখিলকারী এসএএও এর স্বাক্ষর ও সীল
          <br />
          <span>{p.signer}</span>
        </div>
      </div>
    </div>
  )
}
