import { DAYS, GROUP_DAYS, dateFor, emptyGroup, g2 } from '../lib/schedules'
import type { GroupInfo, GroupMap, NoteMap } from '../lib/schedules'

// মোবাইলে সহজে তথ্য পূরণের জন্য: প্রতিটি ভিজিটের দিন একটি কার্ড
interface Props {
  start: string
  groups: GroupMap
  notes: NoteMap
  readOnly: boolean
  onGroup: (no: number, patch: Partial<GroupInfo>) => void
  onTopic: (no: number, idx: number, value: string) => void
  onNote: (week: number, day: number, value: string) => void
}

const SLOTS = ['সকাল ৯.০০-১১.৩০', 'দুপুর ১২.৩০-৩.০০']

export default function EntryForm(p: Props) {
  const groupBox = (no: number, slot: string) => {
    const g = p.groups[no] ?? emptyGroup()
    const filled = g.topics.filter((t) => t.trim()).length
    return (
      <fieldset className="gbox" key={no}>
        <legend>
          {slot} · গ্রুপ নং {g2(no)}
          <span className="muted"> ({'০১২৩৪৫'[filled]}/৫ বিষয়)</span>
        </legend>
        <label>কৃষক গ্রুপের নাম
          <input readOnly={p.readOnly} value={g.group_name} placeholder="যেমন: নোয়াপাড়া সবুজ কৃষক গ্রুপ"
            onChange={(e) => p.onGroup(no, { group_name: e.target.value })} />
        </label>
        <div className="two">
          <label>ঠিকানা (গ্রাম/ইউনিয়ন)
            <input readOnly={p.readOnly} value={g.address} onChange={(e) => p.onGroup(no, { address: e.target.value })} />
          </label>
          <label>মোবাইল নম্বর
            <input type="tel" inputMode="tel" readOnly={p.readOnly} value={g.mobile}
              onChange={(e) => p.onGroup(no, { mobile: e.target.value })} />
          </label>
        </div>
        <div className="topics">
          <span className="lbl">কৃষক গ্রুপে আলোচ্য বিষয়</span>
          {g.topics.map((t, i) => (
            <div className="trow" key={i}>
              <span>{'১২৩৪৫'[i]}।</span>
              <input readOnly={p.readOnly} value={t} onChange={(e) => p.onTopic(no, i, e.target.value)} />
            </div>
          ))}
        </div>
      </fieldset>
    )
  }

  return (
    <div className="entry">
      {([0, 1] as const).map((w) => (
        <section key={w}>
          <h3 className="wk">{w ? '২য়' : '১ম'} সপ্তাহ</h3>
          {GROUP_DAYS.map(({ day, first }) => {
            const a = w * 6 + first
            return (
              <div className="card dcard" key={day}>
                <div className="dhead">
                  <strong>{DAYS[day]}</strong> <span className="muted">{dateFor(p.start, w, day)}</span>
                </div>
                {groupBox(a, SLOTS[0])}
                {groupBox(a + 1, SLOTS[1])}
                <label className="aicc-in">বিকাল ৩.০০-৫.০০ · কৃষি তথ্য ও পরামর্শ কেন্দ্র
                  <textarea rows={2} readOnly={p.readOnly} value={p.notes[`${w}-${day}`] ?? ''}
                    placeholder="এই সময়ের কাজ (ঐচ্ছিক)"
                    onChange={(e) => p.onNote(w, day, e.target.value)} />
                </label>
              </div>
            )
          })}
        </section>
      ))}
      <p className="muted">বুধবার (সাপ্তাহিক সভা), শুক্র-শনি (ছুটি) ও রবিবার (কৃষক সভা, প্রকল্প কাজ…) ফর্মে নিজে থেকেই বসে যায়।</p>
    </div>
  )
}
