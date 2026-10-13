import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntryForm from '../components/EntryForm'
import { useFeedback } from '../components/Feedback'
import ScheduleSheet from '../components/ScheduleSheet'
import StatusSteps from '../components/StatusSteps'
import { useAuth } from '../lib/auth'
import { holidayMap, listFarmerGroups, listHolidays, listTopics, saveFarmerGroup, topicsForMonth } from '../lib/catalog'
import type { FarmerGroup } from '../lib/catalog'
import { mobileError } from '../lib/mobile'
import { badPlace, bn, fmtDate, periodEnd, periodRange, periodStart, periodTitle, splitWeeks, toISO } from '../lib/period'
import type { HolidayMap } from '../lib/period'
import {
  GROUP_COUNT, STATUS_LABEL, changeStatus, displayNumbers, emptyGroup, errMsg, filledCount, fmtTs, groupOrder, isFilled,
  listEvents, loadSchedule, myPastTopics, rearranged, saveGroups, saveNotes, schedulePeriod,
} from '../lib/schedules'
import type { GroupInfo, GroupMap, LoadedSchedule, NoteMap, ScheduleEvent, Status } from '../lib/schedules'

type SaveState = 'saved' | 'saving' | 'error'

const ACTION_LABEL: Record<Status, string> = {
  draft: 'খসড়া',
  submitted: 'জমা দিয়েছেন',
  forwarded: 'উপজেলা কৃষি অফিসারের কাছে পাঠিয়েছেন',
  approved: 'অনুমোদন দিয়েছেন',
  returned: 'সংশোধনের জন্য ফেরত দিয়েছেন',
}

export default function ScheduleEditor() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { confirm, toast } = useFeedback()
  const [data, setData] = useState<LoadedSchedule | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [groups, setGroups] = useState<GroupMap>({})
  const [notes, setNotes] = useState<NoteMap>({})
  const [holidays, setHolidays] = useState<HolidayMap>({})
  const [farmerGroups, setFarmerGroups] = useState<FarmerGroup[]>([])
  const [topicChoices, setTopicChoices] = useState<string[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [view, setView] = useState<'entry' | 'sheet'>('entry')
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)

  const groupsRef = useRef<GroupMap>({})
  const notesRef = useRef<NoteMap>({})
  const dirtyG = useRef(new Set<number>())
  const dirtyN = useRef(new Set<string>())
  const timer = useRef<number | undefined>(undefined)

  const refreshEvents = useCallback(() => {
    if (id) listEvents(id).then(setEvents).catch(() => setEvents([]))
  }, [id])

  useEffect(() => {
    if (!id || !profile) return
    let alive = true
    ;(async () => {
      try {
        const d = await loadSchedule(id)
        if (!alive) return
        if (!d) return setStatus('missing')
        const per = schedulePeriod(d.schedule)
        const [hol, topics] = await Promise.all([
          listHolidays(periodStart(per), periodEnd(per)).catch(() => []),
          listTopics().catch(() => []),
        ])
        const own = d.schedule.saao_id === profile.id
        const canEdit = own && ['draft', 'returned'].includes(d.schedule.status)
        const [fgs, past] = canEdit
          ? await Promise.all([listFarmerGroups(profile.id).catch(() => []), myPastTopics(profile.id, d.schedule.id).catch(() => [])])
          : [[], []]
        if (!alive) return
        groupsRef.current = d.groups
        notesRef.current = d.notes
        setData(d)
        setGroups(d.groups)
        setNotes(d.notes)
        setHolidays(holidayMap(hol))
        setFarmerGroups(fgs)
        const seasonal = topicsForMonth(topics, per.month)
        setTopicChoices([...new Set([...past, ...seasonal])])
        setView(canEdit ? 'entry' : 'sheet')
        setStatus('ready')
      } catch {
        if (alive) setStatus('error')
      }
    })()
    refreshEvents()
    return () => { alive = false }
  }, [id, profile, refreshEvents])

  const s = data?.schedule
  const own = !!s && !!profile && s.saao_id === profile.id
  const editable = own && (s!.status === 'draft' || s!.status === 'returned')
  const period = s ? schedulePeriod(s) : null

  const flush = useCallback(async (): Promise<boolean> => {
    if (!id) return true
    window.clearTimeout(timer.current)
    const gk = [...dirtyG.current]
    const nk = [...dirtyN.current]
    if (!gk.length && !nk.length) return true
    dirtyG.current.clear()
    dirtyN.current.clear()
    setSaveState('saving')
    try {
      await saveGroups(id, gk, groupsRef.current)
      await saveNotes(id, nk, notesRef.current)
      setSaveState('saved')
      return true
    } catch {
      gk.forEach((k) => dirtyG.current.add(k))
      nk.forEach((k) => dirtyN.current.add(k))
      setSaveState('error')
      return false
    }
  }, [id])

  const queue = useCallback(() => {
    setSaveState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 1200)
  }, [flush])

  const onGroup = (no: number, patch: Partial<GroupInfo>) => {
    const cur = groupsRef.current[no] ?? emptyGroup()
    groupsRef.current = { ...groupsRef.current, [no]: { ...cur, ...patch } }
    setGroups(groupsRef.current)
    dirtyG.current.add(no)
    queue()
  }

  const onNote = (date: string, value: string) => {
    notesRef.current = { ...notesRef.current, [date]: value }
    setNotes(notesRef.current)
    dirtyN.current.add(date)
    queue()
  }

  // তারিখ বদল সঙ্গে সঙ্গে সেভ (আগে পুরোনো জায়গা খালি করে)
  async function applyPlaces(next: GroupMap, changed: number[]) {
    if (!id) return
    await flush()
    const before = groupsRef.current
    groupsRef.current = next
    setGroups(next)
    setSaveState('saving')
    try {
      await saveGroups(id, changed, next, true)
      setSaveState('saved')
    } catch (e) {
      groupsRef.current = before
      setGroups(before)
      setSaveState('saved')
      toast(errMsg(e, 'তারিখ বদলানো যায়নি।'), 'err')
    }
  }

  const onMove = (no: number, place: { visit_date: string; slot: 1 | 2 } | null) => {
    const next = { ...groupsRef.current, [no]: { ...(groupsRef.current[no] ?? emptyGroup()), visit_date: place?.visit_date ?? null, slot: place?.slot ?? null } }
    void applyPlaces(next, [no])
  }

  async function rearrange() {
    if (!period) return
    const ok = await confirm('ছুটি অনুযায়ী সব গ্রুপের তারিখ নতুন করে বসানো হবে। গ্রুপের নাম ও আলোচ্য বিষয় যেমন আছে তেমনই থাকবে। চালিয়ে যাবেন?', { ok: 'আবার সাজান' })
    if (!ok) return
    const next = rearranged(groupsRef.current, period, holidays)
    await applyPlaces(next, Array.from({ length: GROUP_COUNT }, (_, i) => i + 1))
    toast('তারিখগুলো ছুটি অনুযায়ী সাজানো হয়েছে')
  }

  async function onNewFarmerGroup(g: { group_name: string; address: string; mobile: string }) {
    if (!profile) return null
    try {
      const fg = await saveFarmerGroup({ ...g, saao_id: profile.id, sort: farmerGroups.length + 1 })
      setFarmerGroups((l) => [...l, fg])
      toast('গ্রুপটি আপনার তালিকায় যোগ হয়েছে')
      return fg
    } catch (e) {
      toast(errMsg(e, 'গ্রুপ যোগ করা যায়নি।'), 'err')
      return null
    }
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyG.current.size || dirtyN.current.size) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      void flush()
    }
  }, [flush])

  const displayNo = useMemo(() => displayNumbers(groups), [groups])
  const filled = filledCount(groups)
  const problems = useMemo(() => {
    if (!period) return [] as { no: number; why: string }[]
    return groupOrder(groups)
      .map((no) => ({ no, g: groups[no] }))
      .filter(({ g }) => g && (g.group_name.trim() || g.topics.some((t) => t.trim())))
      .map(({ no, g }) => ({ no, why: badPlace(g, period, holidays) ?? '' }))
      .filter((x) => x.why)
  }, [groups, period, holidays])
  const badMobiles = groupOrder(groups).filter((no) => mobileError(groups[no]?.mobile ?? ''))
  const firstIncomplete = groupOrder(groups).find((no) => !isFilled(groups[no]))

  function jump(no: number) {
    setView('entry')
    window.setTimeout(() => document.getElementById(`g-${no}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  function print() {
    void flush().then(() => {
      setView('sheet')
      window.setTimeout(() => window.print(), 80)
    })
  }

  async function act(to: Status, from: Status[], question: string, needNote = false) {
    if (!id || !data) return
    const note = reviewNote.trim()
    if (needNote && !note) return toast('ফেরত দিতে হলে কী সংশোধন করতে হবে তা মন্তব্যে লিখুন।', 'err')
    if (to === 'submitted') {
      if (!(await flush())) return toast('সেভ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।', 'err')
      if (problems.length) return toast('কিছু গ্রুপের তারিখ ছুটির দিনে পড়েছে। আগে "ছুটি অনুযায়ী আবার সাজান" চাপুন।', 'err')
      if (badMobiles.length) {
        jump(badMobiles[0])
        return toast('একটি মোবাইল নম্বর ঠিক নেই। ঠিক করে আবার জমা দিন।', 'err')
      }
      if (filled < GROUP_COUNT) question = `১২টির মধ্যে ${bn(filled)}টি গ্রুপ পূরণ হয়েছে। তবুও জমা দেবেন? জমা দিলে আর সম্পাদনা করা যাবে না।`
    }
    if (!(await confirm(question, { ok: to === 'returned' ? 'ফেরত দিন' : 'হ্যাঁ, এগিয়ে যান', danger: to === 'returned' }))) return
    setBusy(true)
    try {
      const updated = await changeStatus(id, from, to, to === 'submitted' ? undefined : note)
      setData({ ...data, schedule: updated })
      setReviewNote('')
      if (to === 'submitted') setView('sheet')
      toast(
        to === 'submitted' ? 'জমা হয়েছে। কো-এডমিন যাচাই করবেন।'
          : to === 'forwarded' ? 'উপজেলা কৃষি অফিসারের কাছে পাঠানো হয়েছে'
            : to === 'approved' ? 'অনুমোদিত হয়েছে' : 'মন্তব্যসহ ফেরত পাঠানো হয়েছে',
      )
      refreshEvents()
    } catch (e) {
      toast(errMsg(e, 'সিদ্ধান্ত সেভ করা যায়নি।'), 'err')
    }
    setBusy(false)
  }

  if (status === 'loading') return <div className="center">লোড হচ্ছে…</div>
  if (status === 'missing') return <div className="center">সূচি পাওয়া যায়নি। <Link to="/">ফিরে যান</Link></div>
  if (status === 'error' || !data || !s || !profile || !period) return <div className="center err">সূচি লোড করা যায়নি। পেজ রিফ্রেশ করুন।</div>

  const owner = data.owner
  const signer = owner
    ? [owner.full_name, ['উপসহকারী কৃষি কর্মকর্তা', owner.block_name && `${owner.block_name} ব্লক`, owner.upazila].filter(Boolean).join(', ')]
    : []
  const approvedNote = s.status === 'approved' && s.approved_at ? `অনলাইনে অনুমোদিত: ${fmtDate(toISO(new Date(s.approved_at)))}` : undefined
  const canForward = profile.role === 'coadmin' && !own && s.status === 'submitted'
  const canDecide = profile.role === 'admin' && (s.status === 'submitted' || s.status === 'forwarded')
  const [w1, w2] = splitWeeks(period)

  return (
    <div className="page wide">
      <div className="noprint narrow">
        <p className="crumb"><Link to={own ? '/' : '/review'}>← {own ? 'হোম' : 'পর্যালোচনার তালিকা'}</Link></p>

        <div className="card head-card">
          <div className="hc-top">
            <div>
              <h1>{periodTitle(period)}</h1>
              <div className="muted">{periodRange(period)}{owner ? ` · ${signer.join(', ')}` : ''}</div>
            </div>
            <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
          </div>
          <StatusSteps status={s.status} />
          <div className="progress" aria-label={`১২টির মধ্যে ${bn(filled)}টি গ্রুপ পূরণ`}>
            <div className="pbar"><span style={{ width: `${(filled / GROUP_COUNT) * 100}%` }} /></div>
            <span>{bn(filled)}/১২ গ্রুপ পূরণ</span>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            {editable && firstIncomplete && (
              <button type="button" className="ghost" onClick={() => jump(firstIncomplete)}>বাকি গ্রুপে যান</button>
            )}
            <button type="button" className="ghost" onClick={print}>প্রিন্ট / PDF</button>
            {editable && (
              <button type="button" disabled={busy} onClick={() => void act('submitted', ['draft', 'returned'], 'জমা দিলে কো-এডমিনের কাছে যাবে এবং আর সম্পাদনা করা যাবে না। জমা দেবেন?')}>
                জমা দিন
              </button>
            )}
            {editable && (
              <span className="muted small save">
                {saveState === 'saving' ? 'সেভ হচ্ছে…' : saveState === 'saved' ? '✓ সেভ হয়েছে' : 'সেভ হয়নি, আবার চেষ্টা হবে'}
              </span>
            )}
          </div>
        </div>

        {s.status === 'returned' && s.approver_note && (
          <div className="card note-box"><strong>সংশোধনের জন্য মন্তব্য:</strong> {s.approver_note}</div>
        )}

        {problems.length > 0 && (
          <div className="card warn-box">
            <strong>ছুটির কারণে {bn(problems.length)}টি গ্রুপের তারিখ ঠিক নেই</strong>
            <ul>
              {problems.slice(0, 4).map((x) => (
                <li key={x.no}>গ্রুপ নং {bn(displayNo[x.no] ?? x.no)}: {x.why}</li>
              ))}
            </ul>
            {editable
              ? <button type="button" onClick={() => void rearrange()}>ছুটি অনুযায়ী আবার সাজান</button>
              : <p className="muted small" style={{ margin: 0 }}>এসএএও-কে মন্তব্যসহ ফেরত দিলে তিনি ঠিক করতে পারবেন।</p>}
          </div>
        )}

        {(canForward || canDecide) && (
          <div className="card review">
            <strong>{canForward ? 'যাচাই (কো-এডমিন)' : 'সিদ্ধান্ত (উপজেলা কৃষি অফিসার)'}</strong>
            {canDecide && s.status === 'submitted' && (
              <p className="muted small" style={{ margin: 0 }}>কো-এডমিন এখনো যাচাই করেননি। চাইলে আপনি সরাসরি সিদ্ধান্ত দিতে পারেন।</p>
            )}
            {canDecide && s.status === 'forwarded' && s.approver_note && (
              <p style={{ margin: 0 }}><span className="muted">কো-এডমিনের মন্তব্য:</span> {s.approver_note}</p>
            )}
            <textarea className="rv" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
              placeholder={canForward ? 'মন্তব্য (ঐচ্ছিক; ফেরত দিতে লিখতেই হবে)' : 'মন্তব্য (ফেরত দিতে লিখতেই হবে)'} />
            <div className="row">
              {canForward && (
                <button type="button" disabled={busy} onClick={() => void act('forwarded', ['submitted'], 'উপজেলা কৃষি অফিসারের কাছে পাঠাবেন?')}>
                  উপজেলা কৃষি অফিসারের কাছে পাঠান
                </button>
              )}
              {canDecide && (
                <button type="button" disabled={busy} onClick={() => void act('approved', ['submitted', 'forwarded'], 'এই সূচি অনুমোদন করবেন?')}>
                  অনুমোদন দিন
                </button>
              )}
              <button type="button" className="ghost" disabled={busy}
                onClick={() => void act('returned', canForward ? ['submitted'] : ['submitted', 'forwarded'], 'মন্তব্যসহ এসএএও-কে ফেরত দেবেন?', true)}>
                মন্তব্যসহ ফেরত দিন
              </button>
            </div>
          </div>
        )}

        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'entry'} className={view === 'entry' ? 'on' : 'ghost'} onClick={() => setView('entry')}>
            {editable ? 'তথ্য পূরণ' : 'তথ্য'}
          </button>
          <button type="button" role="tab" aria-selected={view === 'sheet'} className={view === 'sheet' ? 'on' : 'ghost'} onClick={() => { void flush(); setView('sheet') }}>
            ফর্ম (প্রিন্টের মতো)
          </button>
        </div>
      </div>

      {view === 'entry' && (
        <div className="noprint narrow">
          {editable && farmerGroups.length === 0 && (
            <div className="card hint-box">
              আপনার কৃষক গ্রুপের তালিকা এখনো খালি। <Link to="/groups">আমার কৃষক গ্রুপ</Link> পেজে একবার গ্রুপগুলো লিখে রাখলে প্রতি পক্ষে শুধু বাছাই করলেই হবে।
            </div>
          )}
          <EntryForm period={period} holidays={holidays} groups={groups} displayNo={displayNo} notes={notes} readOnly={!editable}
            farmerGroups={farmerGroups} topicChoices={topicChoices} onGroup={onGroup} onMove={onMove} onNote={onNote}
            onNewFarmerGroup={onNewFarmerGroup} />
        </div>
      )}

      <div className={view === 'sheet' ? 'wrap' : 'wrap print-only'}>
        {([[w1, '১ম সপ্তাহ'], [w2, '২য় সপ্তাহ']] as const).map(([dates, label]) => (
          <ScheduleSheet key={label} label={label} dates={[...dates]} month={s.month_label} fortnight={s.fortnight}
            holidays={holidays} groups={groups} displayNo={displayNo} notes={notes} signer={signer} approvedNote={approvedNote} />
        ))}
      </div>

      {events.length > 0 && (
        <div className="card noprint narrow" style={{ marginTop: 12 }}>
          <strong>ইতিহাস</strong>
          <ul className="hist">
            {events.map((e) => (
              <li key={e.id}>
                <span className="muted">{fmtTs(e.created_at)}</span>{' '}
                <b>{e.actor?.full_name ?? 'একজন কর্মকর্তা'}</b> {ACTION_LABEL[e.to_status]}
                {e.note && <div className="hnote">“{e.note}”</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
