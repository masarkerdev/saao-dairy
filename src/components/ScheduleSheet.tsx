import { DAYS, GROUP_DAYS, dateFor, g2 } from '../lib/schedules'
import type { GroupMap, NoteMap } from '../lib/schedules'

// ছবির ফর্মের হুবহু কাঠামো: শুধু দেখানো ও প্রিন্টের জন্য (লেখা হয় "তথ্য পূরণ" অংশে)
interface Props {
  week: 0 | 1
  start: string
  month: string
  fortnight: number
  signer: string[]
  approvedNote?: string
  groups: GroupMap
  notes: NoteMap
}

const LINES = [0, 1, 2, 3, 4]

export default function ScheduleSheet(p: Props) {
  const off = p.week * 6

  const dayCell = (day: number, rowSpan?: number) => (
    <td className="dy" rowSpan={rowSpan}>
      <b>{DAYS[day]}</b>
      <small>{dateFor(p.start, p.week, day)}</small>
    </td>
  )

  const info = (no: number) => {
    const g = p.groups[no]
    return (
      <td rowSpan={5} className="gi">
        <div className="gno">গ্রুপ নং -{g2(no)}</div>
        {g?.group_name && <div>{g.group_name}</div>}
        {g?.address && <div>{g.address}</div>}
        {g?.mobile && <div>মোবাইল: {g.mobile}</div>}
      </td>
    )
  }

  const topic = (no: number, l: number) => (
    <td className={'tp' + (l === 4 ? ' last' : '')}>
      <span className="tn">{'১২৩৪৫'[l]}।</span> {p.groups[no]?.topics[l] ?? ''}
    </td>
  )

  const groupDay = (day: number, first: number) => {
    const a = off + first
    const b = a + 1
    return LINES.map((l) => (
      <tr key={`${day}-${l}`} className="grow5">
        {l === 0 && dayCell(day, 5)}
        {l === 0 && info(a)}
        {topic(a, l)}
        {l === 0 && info(b)}
        {topic(b, l)}
        {l === 0 && (
          <td rowSpan={5} className="aicc">{p.notes[`${p.week}-${day}`] ?? ''}</td>
        )}
      </tr>
    ))
  }

  const holiday = (day: number) => (
    <tr>
      {dayCell(day)}
      <td>সাপ্তাহিক ছুটি</td>
      <td /><td /><td /><td />
    </tr>
  )

  const fullRow = (day: number, text: string) => (
    <tr>
      {dayCell(day)}
      <td colSpan={5} className="mid">{text}</td>
    </tr>
  )

  const [g1, g2nd, g3] = GROUP_DAYS

  return (
    <div className="sheet">
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
            <th colSpan={5}>{p.week ? '২য়' : '১ম'} সপ্তাহ</th>
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
          {fullRow(0, 'উপজেলা অফিসে সাপ্তাহিক সভা')}
          {groupDay(g1.day, g1.first)}
          {holiday(2)}
          {holiday(3)}
          {fullRow(4, 'কৃষক সভা, প্রকল্প কাজ, প্রদর্শনী স্থাপন ও অন্যান্য কাজ')}
          {groupDay(g2nd.day, g2nd.first)}
          {groupDay(g3.day, g3.first)}
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
          {p.signer.map((s) => (
            <div key={s} className="who">{s}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
