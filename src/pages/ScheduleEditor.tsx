import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntryForm from '../components/EntryForm'
import ScheduleSheet from '../components/ScheduleSheet'
import { useAuth } from '../lib/auth'
import {
  STATUS_LABEL, bn, changeStatus, emptyGroup, errMsg, fmtDate, fmtTs, listEvents, loadSchedule, saveGroups, saveNotes,
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
const ACTOR_FALLBACK: Record<Status, string> = {
  draft: '', submitted: 'এসএএও', forwarded: 'কো-এডমিন', approved: 'উপজেলা কৃষি অফিসার', returned: 'পর্যালোচনাকারী',
}

export default function ScheduleEditor() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [data, setData] = useState<LoadedSchedule | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [groups, setGroups] = useState<GroupMap>({})
  const [notes, setNotes] = useState<NoteMap>({})
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
    loadSchedule(id)
      .then((d) => {
        if (!alive) return
        if (!d) return setStatus('missing')
        groupsRef.current = d.groups
        notesRef.current = d.notes
        setData(d)
        setGroups(d.groups)
        setNotes(d.notes)
        const canEdit = d.schedule.saao_id === profile.id && ['draft', 'returned'].includes(d.schedule.status)
        setView(canEdit ? 'entry' : 'sheet')
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    refreshEvents()
    return () => {
      alive = false
    }
  }, [id, profile, refreshEvents])

  const s = data?.schedule
  const own = !!s && !!profile && s.saao_id === profile.id
  const editable = own && (s!.status === 'draft' || s!.status === 'returned')

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

  const onTopic = (no: number, idx: number, value: string) => {
    const cur = groupsRef.current[no] ?? emptyGroup()
    const topics = [...cur.topics]
    topics[idx] = value
    onGroup(no, { topics })
  }

  const onNote = (w: number, d: number, value: string) => {
    const k = `${w}-${d}`
    notesRef.current = { ...notesRef.current, [k]: value }
    setNotes(notesRef.current)
    dirtyN.current.add(k)
    queue()
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

  // প্রিন্টের আগে সবসময় ফর্মের ভিউ দেখানো
  function print() {
    void flush().then(() => {
      setView('sheet')
      window.setTimeout(() => window.print(), 50)
    })
  }

  // কতগুলো গ্রুপে অন্তত নাম ও একটি বিষয় আছে
  const filledGroups = Array.from({ length: 12 }, (_, i) => groups[i + 1])
    .filter((g) => g && g.group_name.trim() && g.topics.some((t) => t.trim())).length

  async function act(to: Status, from: Status[], confirmText: string, needNote = false) {
    if (!id || !data) return
    const note = reviewNote.trim()
    if (needNote && !note) return alert('ফেরত দিতে হলে কী সংশোধন করতে হবে তা মন্তব্যে লিখুন।')
    if (to === 'submitted') {
      if (!(await flush())) return alert('সেভ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।')
      if (filledGroups < 12 && !confirm(`১২টি গ্রুপের মধ্যে ${filledGroups}টিতে নাম ও আলোচ্য বিষয় আছে। তবুও জমা দেবেন?`)) return
    }
    if (!confirm(confirmText)) return
    setBusy(true)
    try {
      const updated = await changeStatus(id, from, to, to === 'submitted' ? undefined : note)
      setData({ ...data, schedule: updated })
      setReviewNote('')
      if (to === 'submitted') setView('sheet')
      refreshEvents()
    } catch (e) {
      alert(errMsg(e, 'সিদ্ধান্ত সেভ করা যায়নি।'))
    }
    setBusy(false)
  }

  if (status === 'loading') return <div className="center">লোড হচ্ছে…</div>
  if (status === 'missing') return <div className="center">সূচি পাওয়া যায়নি। <Link to="/">ফিরে যান</Link></div>
  if (status === 'error' || !data || !s || !profile) return <div className="center err">সূচি লোড করা যায়নি।</div>

  const owner = data.owner
  const signer = owner
    ? [owner.full_name, ['উপসহকারী কৃষি কর্মকর্তা', owner.block_name && `${owner.block_name} ব্লক`, owner.upazila].filter(Boolean).join(', ')]
    : []
  const approvedNote = s.status === 'approved' && s.approved_at ? `অনলাইনে অনুমোদিত: ${fmtDate(new Date(s.approved_at))}` : undefined

  const canForward = profile.role === 'coadmin' && !own && s.status === 'submitted'
  const canDecide = profile.role === 'admin' && (s.status === 'submitted' || s.status === 'forwarded')

  return (
    <div className="page wide">
      <div className="noprint">
        <p><Link to={own ? '/' : '/review'}>← {own ? 'আমার সূচি' : 'পর্যালোচনার তালিকা'}</Link></p>

        <div className="card bar">
          <div>
            <strong>{s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ</strong>
            <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
            {owner && <div className="muted">{signer.filter(Boolean).join(' · ')}</div>}
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            {editable && (
              <span className="muted">
                {saveState === 'saving' ? 'সেভ হচ্ছে…' : saveState === 'saved' ? '✓ সেভ হয়েছে' : 'সেভ হয়নি — আবার চেষ্টা হবে'}
              </span>
            )}
            <button className="ghost" onClick={print}>প্রিন্ট / PDF</button>
            {editable && (
              <button disabled={busy} onClick={() => void act('submitted', ['draft', 'returned'],
                'জমা দিলে কো-এডমিনের কাছে যাবে এবং আর সম্পাদনা করা যাবে না। জমা দেবেন?')}>
                জমা দিন
              </button>
            )}
          </div>
        </div>

        {s.status === 'returned' && s.approver_note && (
          <div className="card note-box"><strong>সংশোধনের জন্য মন্তব্য:</strong> {s.approver_note}</div>
        )}

        {(canForward || canDecide) && (
          <div className="card review">
            <strong>{canForward ? 'যাচাই (কো-এডমিন)' : 'সিদ্ধান্ত (উপজেলা কৃষি অফিসার)'}</strong>
            {canDecide && s.status === 'submitted' && (
              <p className="muted" style={{ margin: 0 }}>কো-এডমিন এখনো যাচাই করেননি। চাইলে আপনি সরাসরি সিদ্ধান্ত দিতে পারেন।</p>
            )}
            {canDecide && s.status === 'forwarded' && s.approver_note && (
              <p style={{ margin: 0 }}><span className="muted">কো-এডমিনের মন্তব্য:</span> {s.approver_note}</p>
            )}
            <textarea className="rv" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
              placeholder={canForward ? 'মন্তব্য (ঐচ্ছিক; ফেরত দিতে বাধ্যতামূলক)' : 'মন্তব্য (ফেরত দিতে বাধ্যতামূলক)'} />
            <div className="row">
              {canForward && (
                <button disabled={busy} onClick={() => void act('forwarded', ['submitted'], 'উপজেলা কৃষি অফিসারের কাছে পাঠাবেন?')}>
                  উপজেলা কৃষি অফিসারের কাছে পাঠান
                </button>
              )}
              {canDecide && (
                <button disabled={busy} onClick={() => void act('approved', ['submitted', 'forwarded'], 'এই সূচি অনুমোদন করবেন?')}>
                  অনুমোদন দিন
                </button>
              )}
              <button className="ghost" disabled={busy}
                onClick={() => void act('returned', canForward ? ['submitted'] : ['submitted', 'forwarded'], 'মন্তব্যসহ এসএএও-কে ফেরত দেবেন?', true)}>
                মন্তব্যসহ ফেরত দিন
              </button>
            </div>
          </div>
        )}

        <div className="tabs">
          <button className={view === 'entry' ? 'on' : 'ghost'} onClick={() => setView('entry')}>
            {editable ? 'তথ্য পূরণ' : 'তথ্য'}
          </button>
          <button className={view === 'sheet' ? 'on' : 'ghost'} onClick={() => { void flush(); setView('sheet') }}>
            ফর্ম (প্রিন্টের মতো)
          </button>
          {editable && <span className="muted" style={{ alignSelf: 'center' }}>{bn(filledGroups)}/১২ গ্রুপ পূরণ হয়েছে</span>}
        </div>
      </div>

      {view === 'entry' && (
        <div className="noprint">
          <EntryForm start={s.start_date} groups={groups} notes={notes} readOnly={!editable}
            onGroup={onGroup} onTopic={onTopic} onNote={onNote} />
        </div>
      )}

      <div className={view === 'sheet' ? 'wrap' : 'wrap print-only'}>
        {([0, 1] as const).map((w) => (
          <ScheduleSheet key={w} week={w} start={s.start_date} month={s.month_label} fortnight={s.fortnight}
            signer={signer} approvedNote={approvedNote} groups={groups} notes={notes} />
        ))}
      </div>

      {events.length > 0 && (
        <div className="card noprint" style={{ marginTop: 12 }}>
          <strong>ইতিহাস</strong>
          <ul className="hist">
            {events.map((e) => (
              <li key={e.id}>
                <span className="muted">{fmtTs(e.created_at)}</span>{' '}
                <b>{e.actor?.full_name ?? ACTOR_FALLBACK[e.to_status]}</b> {ACTION_LABEL[e.to_status]}
                {e.note && <div className="hnote">“{e.note}”</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
