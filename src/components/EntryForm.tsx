import { useState } from 'react'
import type { FarmerGroup } from '../lib/catalog'
import { mobileError } from '../lib/mobile'
import { WEEKDAYS, badPlace, bn, canHostGroups, dow, fmtDayMonth, periodDates } from '../lib/period'
import type { HolidayMap, Period } from '../lib/period'
import { GROUP_COUNT, emptyGroup, g2, groupOrder, isFilled } from '../lib/schedules'
import type { GroupInfo, GroupMap, NoteMap } from '../lib/schedules'
import TopicPicker from './TopicPicker'

// মোবাইলে সহজে তথ্য পূরণ: প্রতিটি ভিজিটের দিন একটি কার্ড, প্রতিটি গ্রুপ তালিকা থেকে বাছাই
interface Props {
  period: Period
  holidays: HolidayMap
  groups: GroupMap
  displayNo: Record<number, number>
  notes: NoteMap
  readOnly: boolean
  farmerGroups: FarmerGroup[]
  topicChoices: string[]
  onGroup: (no: number, patch: Partial<GroupInfo>) => void
  onMove: (no: number, place: { visit_date: string; slot: 1 | 2 } | null) => void
  onNote: (date: string, value: string) => void
  onNewFarmerGroup: (g: { group_name: string; address: string; mobile: string }) => Promise<FarmerGroup | null>
}

const SLOT = { 1: 'সকাল ৯.০০-১১.৩০', 2: 'দুপুর ১২.৩০-৩.০০' } as const
const shortDay = (d: string) => `${WEEKDAYS[dow(d)]}, ${fmtDayMonth(d)}`

export default function EntryForm(p: Props) {
  const [adding, setAdding] = useState<number | null>(null)
  const [draft, setDraft] = useState({ group_name: '', address: '', mobile: '' })
  const [addErr, setAddErr] = useState('')

  const order = groupOrder(p.groups)
  const hostDates = periodDates(p.period).filter((d) => canHostGroups(d, p.holidays))
  const taken = new Set(order.map((no) => p.groups[no]).filter((g) => g?.visit_date).map((g) => `${g!.visit_date}|${g!.slot}`))
  const activeFG = p.farmerGroups.filter((f) => f.active)

  // তারিখ অনুযায়ী ভাগ
  const byDate = new Map<string, number[]>()
  const unplaced: number[] = []
  for (const no of order) {
    const g = p.groups[no]
    if (g?.visit_date) byDate.set(g.visit_date, [...(byDate.get(g.visit_date) ?? []), no])
    else unplaced.push(no)
  }

  async function saveNew(no: number) {
    setAddErr('')
    if (!draft.group_name.trim()) return setAddErr('গ্রুপের নাম লিখুন')
    const me = mobileError(draft.mobile)
    if (me) return setAddErr(me)
    const fg = await p.onNewFarmerGroup(draft)
    if (fg) {
      p.onGroup(no, { group_name: fg.group_name, address: fg.address, mobile: fg.mobile, farmer_group_id: fg.id })
      setAdding(null)
      setDraft({ group_name: '', address: '', mobile: '' })
    }
  }

  const groupBox = (no: number) => {
    const g = p.groups[no] ?? emptyGroup()
    const bad = g.visit_date ? badPlace(g, p.period, p.holidays) : null
    const mErr = mobileError(g.mobile)
    const placeKey = g.visit_date ? `${g.visit_date}|${g.slot}` : ''
    return (
      <fieldset className={'gbox' + (bad ? ' warn' : '')} key={no} id={`g-${no}`}>
        <legend>
          <span className={'fill-dot' + (isFilled(g) ? ' ok' : '')} aria-hidden="true" />
          গ্রুপ নং {g2(p.displayNo[no] ?? no)}
          {g.slot && <span className="muted"> · {SLOT[g.slot]}</span>}
        </legend>

        {bad && <p className="err small">এই দিনে ভিজিট রাখা যাবে না: {bad}</p>}

        {!p.readOnly && (
          <label>তারিখ ও সময়
            <select
              value={placeKey}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return p.onMove(no, null)
                const [d, s] = v.split('|')
                p.onMove(no, { visit_date: d, slot: Number(s) as 1 | 2 })
              }}
            >
              {!placeKey && <option value="">তারিখ বাছুন</option>}
              {placeKey && !hostDates.includes(g.visit_date!) && <option value={placeKey}>{shortDay(g.visit_date!)} (ঠিক নয়)</option>}
              {hostDates.flatMap((d) => ([1, 2] as const).map((s) => {
                const k = `${d}|${s}`
                if (taken.has(k) && k !== placeKey) return null
                return <option key={k} value={k}>{shortDay(d)} · {s === 1 ? 'সকাল' : 'দুপুর'}</option>
              }))}
            </select>
          </label>
        )}

        {!p.readOnly && (
          <label>কৃষক গ্রুপ
            <select
              value={g.farmer_group_id ?? ''}
              onChange={(e) => {
                const v = e.target.value
                if (v === '__new') { setAdding(no); setAddErr(''); return }
                const fg = activeFG.find((f) => f.id === v)
                if (fg) p.onGroup(no, { group_name: fg.group_name, address: fg.address, mobile: fg.mobile, farmer_group_id: fg.id })
                else p.onGroup(no, { farmer_group_id: null })
              }}
            >
              <option value="">{activeFG.length ? 'আমার তালিকা থেকে বাছুন' : 'তালিকায় কোনো গ্রুপ নেই'}</option>
              {activeFG.map((f) => <option key={f.id} value={f.id}>{f.group_name}</option>)}
              <option value="__new">+ নতুন গ্রুপ তালিকায় যোগ করুন</option>
            </select>
          </label>
        )}

        {adding === no && (
          <div className="addfg">
            <label>গ্রুপের নাম<input value={draft.group_name} onChange={(e) => setDraft({ ...draft, group_name: e.target.value })} /></label>
            <label>ঠিকানা (গ্রাম, ইউনিয়ন)<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
            <label>মোবাইল<input type="tel" inputMode="tel" value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} /></label>
            {addErr && <p className="err small">{addErr}</p>}
            <div className="row">
              <button type="button" onClick={() => void saveNew(no)}>তালিকায় যোগ করে বসান</button>
              <button type="button" className="ghost" onClick={() => setAdding(null)}>বাতিল</button>
            </div>
          </div>
        )}

        <div className="two">
          <label>গ্রুপের নাম
            <input readOnly={p.readOnly} value={g.group_name} placeholder="যেমন: নোয়াপাড়া সবুজ কৃষক গ্রুপ"
              onChange={(e) => p.onGroup(no, { group_name: e.target.value })} />
          </label>
          <label>মোবাইল নম্বর
            <input type="tel" inputMode="tel" readOnly={p.readOnly} value={g.mobile} aria-invalid={!!mErr}
              onChange={(e) => p.onGroup(no, { mobile: e.target.value })} />
          </label>
        </div>
        {mErr && <p className="err small">{mErr}</p>}
        <label>ঠিকানা (গ্রাম, ইউনিয়ন)
          <input readOnly={p.readOnly} value={g.address} onChange={(e) => p.onGroup(no, { address: e.target.value })} />
        </label>

        <TopicPicker idBase={`t${no}`} value={g.topics} suggestions={p.topicChoices} readOnly={p.readOnly}
          onChange={(topics) => p.onGroup(no, { topics })} />
      </fieldset>
    )
  }

  return (
    <div className="entry">
      {[...byDate.entries()].map(([d, nos]) => (
        <section className="card dcard" key={d}>
          <div className="dhead">
            <strong>{WEEKDAYS[dow(d)]}</strong> <span className="muted">{fmtDayMonth(d)}</span>
            {p.holidays[d] && <span className="badge st-returned">সরকারি ছুটি: {p.holidays[d]}</span>}
            {dow(d) === 0 && !p.holidays[d] && <span className="badge">রবিবার (ছুটির কারণে)</span>}
          </div>
          {nos.sort((a, b) => (p.groups[a].slot ?? 0) - (p.groups[b].slot ?? 0)).map(groupBox)}
          <label className="aicc-in">বিকাল ৩.০০-৫.০০ · কৃষি তথ্য ও পরামর্শ কেন্দ্র (ঐচ্ছিক)
            <textarea rows={2} readOnly={p.readOnly} value={p.notes[d] ?? ''} onChange={(e) => p.onNote(d, e.target.value)} />
          </label>
        </section>
      ))}
      {unplaced.length > 0 && (
        <section className="card dcard">
          <div className="dhead"><strong>তারিখ ঠিক হয়নি</strong> <span className="muted">({bn(unplaced.length)}টি গ্রুপ)</span></div>
          <p className="muted small" style={{ margin: 0 }}>
            এই পক্ষে ছুটির কারণে জায়গা কম। নিচের প্রতিটি গ্রুপের জন্য একটি খালি দিন বাছুন, অথবা গ্রুপের তথ্য খালি রাখলে এই পক্ষে ভিজিট হবে না।
          </p>
          {unplaced.map(groupBox)}
        </section>
      )}
      <p className="muted small">
        বুধবার সাপ্তাহিক সভা, শুক্র-শনি সাপ্তাহিক ছুটি, রবিবার কৃষক সভা ও অন্যান্য কাজ, আর সরকারি ছুটি ফর্মে নিজে থেকেই বসে। মোট {bn(GROUP_COUNT)}টি গ্রুপ।
      </p>
    </div>
  )
}
