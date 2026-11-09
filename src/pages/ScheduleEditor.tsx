import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EntryForm from '../components/EntryForm'
import Icon from '../components/Icon'
import { useFeedback } from '../components/Feedback'
import ScheduleSheet, { printSizeAll, screenSizeAll } from '../components/ScheduleSheet'
import StatusSteps from '../components/StatusSteps'
import { useAuth } from '../lib/auth'
import { holidayMap, listFarmerGroups, listHolidays, listTopics, saveFarmerGroup, topicsForMonth } from '../lib/catalog'
import type { FarmerGroup } from '../lib/catalog'
import { mobileError } from '../lib/mobile'
import { badPlace, bn, monthTitle, periodEnd, periodRange, periodStart } from '../lib/period'
import type { Period } from '../lib/period'
import { fileBase, saveBlob } from '../lib/download'
import { loadMonth, sheetTitle, signerLines } from '../lib/month'
import type { MonthData } from '../lib/month'
import type { HolidayMap } from '../lib/period'
import {
  GROUP_COUNT, STATUS_LABEL, changeMonthStatus, countFilled, createSchedule, loadSibling, takenPlaces, displayNumbers, emptyGroup, errMsg, filledCount, fmtTs, groupOrder, isFilled,
  listEvents, loadSchedule, myPastTopics, rearranged, saveGroups, saveNotes, schedulePeriod,
} from '../lib/schedules'
import type { GroupInfo, GroupMap, LoadedSchedule, NoteMap, Schedule, ScheduleEvent, Status } from '../lib/schedules'

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
  const nav = useNavigate()
  const [data, setData] = useState<LoadedSchedule | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [groups, setGroups] = useState<GroupMap>({})
  const [notes, setNotes] = useState<NoteMap>({})
  const [devStatus, setDevStatus] = useState<Status | ''>('')
  const [otherTaken, setOtherTaken] = useState<Set<string>>(new Set())
  // একই মাসের অন্য পক্ষ (undefined = লোড হচ্ছে, null = তৈরি হয়নি)
  const [sibling, setSibling] = useState<Schedule | null | undefined>(undefined)
  const [sibFilled, setSibFilled] = useState<number | null>(null)
  const [holidays, setHolidays] = useState<HolidayMap>({})
  const [farmerGroups, setFarmerGroups] = useState<FarmerGroup[]>([])
  const [topicChoices, setTopicChoices] = useState<string[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [view, setView] = useState<'entry' | 'sheet'>('entry')
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [month, setMonth] = useState<MonthData | null>(null)
  const [exporting, setExporting] = useState<'' | 'pdf' | 'docx'>('')
  const sheetsRef = useRef<HTMLDivElement>(null)

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
    setSibling(undefined)
    setSibFilled(null)
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
          ? await Promise.all([listFarmerGroups(profile.id).then((l) => l.filter((f) => (f.block_name ?? '') === '' || f.block_name === d.schedule.block_name)).catch(() => []), myPastTopics(profile.id, d.schedule.id).catch(() => [])])
          : [[], []]
        if (!alive) return
        groupsRef.current = d.groups
        notesRef.current = d.notes
        setData(d)
        setGroups(d.groups)
        setNotes(d.notes)
        setHolidays(holidayMap(hol))
        setFarmerGroups(fgs)
        loadSibling(d.schedule).then(async (x) => {
          if (!alive) return
          setSibling(x)
          setSibFilled(x ? await countFilled(x.id).catch(() => null) : null)
        }).catch(() => alive && setSibling(null))
        if (canEdit) takenPlaces(d.schedule.saao_id, d.schedule.start_date, d.schedule.id).then((t) => alive && setOtherTaken(t)).catch(() => undefined)
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
    const next = rearranged(groupsRef.current, period, holidays, otherTaken)
    await applyPlaces(next, Array.from({ length: GROUP_COUNT }, (_, i) => i + 1))
    toast('তারিখগুলো ছুটি অনুযায়ী সাজানো হয়েছে')
  }

  async function onNewFarmerGroup(g: { group_name: string; president: string; address: string; mobile: string }) {
    if (!profile) return null
    try {
      const fg = await saveFarmerGroup({ ...g, saao_id: profile.id, sort: farmerGroups.length + 1, block_name: data?.schedule.block_name || null })
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

  // মাসের দুই পক্ষ (এই সূচির সর্বশেষ লেখাসহ) লোড
  const refreshMonth = useCallback(async () => {
    if (!data) return null
    const p = schedulePeriod(data.schedule)
    const m = await loadMonth(data.schedule.saao_id, p.year, p.month, { schedule: data.schedule, groups: groupsRef.current, notes: notesRef.current })
    setMonth(m)
    return m
  }, [data])

  useEffect(() => {
    if (view === 'sheet') void refreshMonth()
  }, [view, refreshMonth])

  // পর্দার এই পক্ষের পাতাটি সবসময় সর্বশেষ লেখা দেখায়
  const monthView = useMemo(() => {
    if (!month || !data) return null
    return { ...month, pages: month.pages.map((pg) => pg.schedule?.id === data.schedule.id ? { ...pg, schedule: data.schedule, groups, notes } : pg) as MonthData['pages'] }
  }, [month, data, groups, notes])

  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  async function showSheets() {
    await flush()
    setView('sheet')
    const m = await refreshMonth()
    await nextFrame()
    await nextFrame()
    return m
  }

  function print() {
    void showSheets().then(() => window.print())
  }

  async function download(kind: 'pdf' | 'docx') {
    setExporting(kind)
    try {
      const m = await showSheets()
      if (!m) throw new Error('তথ্য লোড হয়নি')
      const name = fileBase(m.monthName, m.year, [m.owner?.full_name, data?.schedule.extra_charge ? data.schedule.block_name : ''].filter(Boolean).join(' '))
      if (kind === 'pdf') {
        const { sheetsToPdf } = await import('../lib/exportPdf')
        const els = Array.from(sheetsRef.current?.querySelectorAll<HTMLElement>('.sheet') ?? [])
        if (els.length !== 2) throw new Error('ফর্ম এখনো তৈরি হয়নি, আবার চেষ্টা করুন')
        // PDF-এ লেখা ১১px, তারপর পর্দায় আবার ১৩px
        if (sheetsRef.current) printSizeAll(sheetsRef.current)
        await nextFrame()
        try {
          await saveBlob(await sheetsToPdf(els), `${name}.pdf`)
        } finally {
          if (sheetsRef.current) screenSizeAll(sheetsRef.current)
        }
      } else {
        const { monthToDocx } = await import('../lib/exportDocx')
        const live = { ...m, pages: m.pages.map((pg) => pg.schedule?.id === data?.schedule.id ? { ...pg, groups: groupsRef.current, notes: notesRef.current } : pg) as MonthData['pages'] }
        await saveBlob(await monthToDocx(live, signerLines(m.owner, data?.schedule), sheetTitle(m.owner, data?.schedule)), `${name}.docx`)
      }
      toast(kind === 'pdf' ? 'PDF তৈরি হয়েছে' : 'Word ফাইল তৈরি হয়েছে')
    } catch (e) {
      toast(errMsg(e, 'ফাইল তৈরি করা যায়নি।'), 'err')
    }
    setExporting('')
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
      if (!sibling) return toast(`এই মাসের ${period?.fortnight === 1 ? '২য়' : '১ম'} পক্ষের সূচি এখনো তৈরি হয়নি। উপরে "তৈরি করুন" চেপে দুই পক্ষ পূরণ করে জমা দিন।`, 'err')
      const total = filled + (sibFilled ?? 0)
      if (total < GROUP_COUNT * 2) question = `দুই পক্ষ মিলিয়ে ২৪টির মধ্যে ${bn(total)}টি গ্রুপ পূরণ হয়েছে (এই পক্ষে ${bn(filled)}, অন্য পক্ষে ${bn(sibFilled ?? 0)})। তবুও পুরো মাস জমা দেবেন? জমা দিলে আর সম্পাদনা করা যাবে না।`
    }
    if (!(await confirm(question, { ok: to === 'returned' ? 'ফেরত দিন' : 'হ্যাঁ, এগিয়ে যান', danger: to === 'returned' }))) return
    setBusy(true)
    try {
      const updated = await changeMonthStatus(id, from, to, to === 'submitted' ? undefined : note)
      setData({ ...data, schedule: updated })
      if (sibling) loadSibling(updated).then(setSibling).catch(() => undefined)
      setReviewNote('')
      if (to === 'submitted') setView('sheet')
      toast(
        to === 'submitted' ? 'পুরো মাসের সূচি জমা হয়েছে। কো-এডমিন যাচাই করবেন।'
          : to === 'forwarded' ? 'পুরো মাসের সূচি উপজেলা কৃষি অফিসারের কাছে পাঠানো হয়েছে'
            : to === 'approved' ? 'পুরো মাসের সূচি অনুমোদিত হয়েছে' : 'মন্তব্যসহ পুরো মাসের সূচি ফেরত পাঠানো হয়েছে',
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
  const signer = signerLines(owner, s)
  const canForward = profile.role === 'coadmin' && !own && s.status === 'submitted'
  const canDecide = profile.role === 'admin' && (s.status === 'submitted' || s.status === 'forwarded')

  return (
    <div className="page wide">
      <div className="noprint narrow">
        <p className="crumb"><Link to={own ? '/' : '/review'}>← {own ? 'হোম' : 'পর্যালোচনার তালিকা'}</Link></p>

        <div className="card head-card">
          <div className="hc-top">
            <div>
              <h1>{monthTitle(period)} · মাসিক সূচি</h1>
              {s.extra_charge && <span className="badge xc">অতিরিক্ত দায়িত্ব · {s.block_name} ব্লক</span>}
              <div className="muted">{periodRange(period)}{owner ? ` · ${signer.map((x) => x.replace(/,$/, '')).join(', ')}` : ''}</div>
            </div>
            <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
          </div>
          <div className="pk-switch" role="tablist" aria-label="পক্ষ">
            {([1, 2] as const).map((f) => {
              const here = period.fortnight === f
              const other = !here ? sibling : null
              const p: Period = { year: period.year, month: period.month, fortnight: f }
              const n = here ? filled : sibFilled
              if (here) return (
                <span key={f} className="pk on" role="tab" aria-selected="true">
                  <b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>{periodRange(p)} · {bn(n ?? 0)}/১২</small>
                </span>
              )
              if (other) return (
                <Link key={f} to={`/schedules/${other.id}`} className="pk" role="tab" aria-selected="false">
                  <b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>{periodRange(p)} · {n === null ? '…' : `${bn(n)}/১২`}</small>
                </Link>
              )
              if (sibling === undefined) return <span key={f} className="pk muted"><b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>লোড হচ্ছে…</small></span>
              return own && editable ? (
                <button key={f} type="button" className="pk missing" disabled={busy} onClick={async () => {
                  setBusy(true)
                  try {
                    const t = await takenPlaces(s.saao_id, periodStart(p), undefined, s.block_name ?? '').catch(() => new Set<string>())
                    const made = await createSchedule(s.saao_id, p, holidays, farmerGroups.filter((x) => x.active).slice(0, GROUP_COUNT), s.block_name ?? '', t)
                    toast(`${f === 1 ? '১ম' : '২য়'} পক্ষের সূচি তৈরি হয়েছে`)
                    nav(`/schedules/${made.id}`)
                  } catch (e) {
                    toast(errMsg(e, 'তৈরি করা যায়নি।'), 'err')
                  }
                  setBusy(false)
                }}>
                  <b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>তৈরি হয়নি · তৈরি করুন</small>
                </button>
              ) : <span key={f} className="pk muted"><b>{f === 1 ? '১ম' : '২য়'} পক্ষ</b><small>তৈরি হয়নি</small></span>
            })}
          </div>
          <StatusSteps status={s.status} />
          <div className="progress" aria-label={`১২টির মধ্যে ${bn(filled)}টি গ্রুপ পূরণ`}>
            <div className="pbar"><span style={{ width: `${(filled / GROUP_COUNT) * 100}%` }} /></div>
            <span>এই পক্ষে {bn(filled)}/১২{sibFilled !== null && sibling ? ` · পুরো মাসে ${bn(filled + sibFilled)}/২৪` : ''}</span>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            {editable && firstIncomplete && (
              <button type="button" className="ghost" onClick={() => jump(firstIncomplete)}>বাকি গ্রুপে যান</button>
            )}
            <button type="button" className="ghost" disabled={!!exporting} onClick={() => void download('pdf')}>{exporting === 'pdf' ? 'PDF তৈরি হচ্ছে…' : 'PDF ডাউনলোড'}</button>
            <button type="button" className="ghost" disabled={!!exporting} onClick={() => void download('docx')}>{exporting === 'docx' ? 'Word তৈরি হচ্ছে…' : 'Word ডাউনলোড'}</button>
            <button type="button" className="ghost" onClick={print}>প্রিন্ট</button>
            {editable && (
              <button type="button" disabled={busy} onClick={() => void act('submitted', ['draft', 'returned'], 'দুই পক্ষের সূচি একসাথে কো-এডমিনের কাছে যাবে এবং আর সম্পাদনা করা যাবে না। পুরো মাস জমা দেবেন?')}>
                মাস জমা দিন (দুই পক্ষ)
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

        {profile.role === 'developer' && (
          <div className="card review dev-fix">
            <strong><Icon name="settings" size={16} /> ডেভেলপার: অবস্থা ঠিক করুন</strong>
            <p className="muted small" style={{ margin: 0 }}>ভুলে অনুমোদন বা ফেরত হলে এখান থেকে যেকোনো অবস্থায় নিতে পারবেন। ইতিহাসে লেখা থাকবে।</p>
            <div className="row">
              <select value={devStatus || s.status} onChange={(e) => setDevStatus(e.target.value as Status)} aria-label="নতুন অবস্থা">
                {(Object.keys(STATUS_LABEL) as Status[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
              <button type="button" disabled={busy || !devStatus || devStatus === s.status} onClick={async () => {
                if (!devStatus || !(await confirm(`অবস্থা "${STATUS_LABEL[s.status]}" থেকে "${STATUS_LABEL[devStatus]}" করবেন?`))) return
                setBusy(true)
                try {
                  const updated = await changeMonthStatus(id!, [...new Set([s.status, ...(sibling ? [sibling.status] : [])])], devStatus, reviewNote.trim() || 'ডেভেলপার সংশোধন')
                  setData({ ...data, schedule: updated })
                  if (sibling) loadSibling(updated).then(setSibling).catch(() => undefined)
                  setDevStatus('')
                  setReviewNote('')
                  refreshEvents()
                  toast('অবস্থা বদলানো হয়েছে')
                } catch (e) {
                  toast(errMsg(e, 'বদলানো যায়নি।'), 'err')
                }
                setBusy(false)
              }}>অবস্থা বদলান</button>
            </div>
          </div>
        )}

        {(canForward || canDecide) && (
          <div className="card review">
            <strong>{canForward ? 'যাচাই (কো-এডমিন)' : 'সিদ্ধান্ত (উপজেলা কৃষি অফিসার)'} · পুরো মাস</strong>
            <p className="muted small" style={{ margin: 0 }}>সিদ্ধান্ত দুই পক্ষেই একসাথে প্রযোজ্য হবে। অন্য পক্ষ দেখতে উপরের পক্ষ বোতাম চাপুন বা "ফর্ম" ট্যাবে পুরো মাস দেখুন।</p>
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
              আপনার কৃষক গ্রুপের তালিকা এখনো খালি। <Link to="/groups">আমার কৃষক গ্রুপ</Link> পেজে একবার গ্রুপগুলো লিখে রাখলে প্রতি মাসে শুধু বাছাই করলেই হবে।
            </div>
          )}
          <EntryForm period={period} holidays={holidays} groups={groups} displayNo={displayNo} notes={notes} readOnly={!editable}
            farmerGroups={farmerGroups} topicChoices={topicChoices} onGroup={onGroup} onMove={onMove} onNote={onNote}
            onNewFarmerGroup={onNewFarmerGroup} otherTaken={otherTaken} />
        </div>
      )}

      {view === 'sheet' && (
        <p className="noprint narrow muted small" style={{ marginTop: 0 }}>
          পুরো মাস: ১ম পাতা ১ম পক্ষ, ২য় পাতা ২য় পক্ষ। যে পক্ষের সূচি এখনো তৈরি হয়নি সেটি খালি ফর্ম হিসেবে আসে।
        </p>
      )}
      <div ref={sheetsRef} className={view === 'sheet' ? 'wrap' : 'wrap print-only'}>
        {monthView
          ? monthView.pages.map((pg) => (
            <ScheduleSheet key={pg.label} page={pg} title={sheetTitle(owner, s)} monthName={monthView.monthName} holidays={monthView.holidays} signer={signer} />
          ))
          : view === 'sheet' && <p className="center">ফর্ম তৈরি হচ্ছে…</p>}
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
