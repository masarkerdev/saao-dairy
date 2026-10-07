import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScheduleSheet from '../components/ScheduleSheet'
import { useAuth } from '../lib/auth'
import { approveSchedule, returnSchedule } from '../lib/review'
import { STATUS_LABEL, loadSchedule, saveEntries, saveNotes, submitSchedule } from '../lib/schedules'
import type { EntryMap, LoadedSchedule, NoteMap } from '../lib/schedules'

type SaveState = 'saved' | 'saving' | 'error'

export default function ScheduleEditor() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [data, setData] = useState<LoadedSchedule | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [entries, setEntries] = useState<EntryMap>({})
  const [notes, setNotes] = useState<NoteMap>({})
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)

  const entriesRef = useRef<EntryMap>({})
  const notesRef = useRef<NoteMap>({})
  const dirtyE = useRef(new Set<string>())
  const dirtyN = useRef(new Set<string>())
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    let alive = true
    loadSchedule(id)
      .then((d) => {
        if (!alive) return
        if (!d) return setStatus('missing')
        entriesRef.current = d.entries
        notesRef.current = d.notes
        setData(d)
        setEntries(d.entries)
        setNotes(d.notes)
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [id])

  const editable = !!data && !!profile && data.schedule.saao_id === profile.id &&
    (data.schedule.status === 'draft' || data.schedule.status === 'returned')

  const flush = useCallback(async (): Promise<boolean> => {
    if (!id) return true
    window.clearTimeout(timer.current)
    const ek = [...dirtyE.current]
    const nk = [...dirtyN.current]
    if (!ek.length && !nk.length) return true
    dirtyE.current.clear()
    dirtyN.current.clear()
    setSaveState('saving')
    try {
      await saveEntries(id, ek, entriesRef.current)
      await saveNotes(id, nk, notesRef.current)
      setSaveState('saved')
      return true
    } catch {
      ek.forEach((k) => dirtyE.current.add(k))
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

  const onEntry = (g: number, l: number, field: 'f' | 't', value: string) => {
    const k = `${g}-${l}`
    const cur = entriesRef.current[k] ?? { f: '', t: '' }
    entriesRef.current = { ...entriesRef.current, [k]: { ...cur, [field]: value } }
    setEntries(entriesRef.current)
    dirtyE.current.add(k)
    queue()
  }

  const onNote = (w: number, d: number, value: string) => {
    const k = `${w}-${d}`
    notesRef.current = { ...notesRef.current, [k]: value }
    setNotes(notesRef.current)
    dirtyN.current.add(k)
    queue()
  }

  // পেজ ছাড়ার সময় বাকি লেখা সেভ ও সতর্কবার্তা
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyE.current.size || dirtyN.current.size) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      void flush()
    }
  }, [flush])

  async function onSubmit() {
    if (!id || !data) return
    if (!(await flush())) return alert('সেভ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।')
    if (!confirm('সূচি জমা দিলে আর সম্পাদনা করা যাবে না। জমা দেবেন?')) return
    try {
      await submitSchedule(id)
      setData({ ...data, schedule: { ...data.schedule, status: 'submitted' } })
    } catch {
      alert('জমা দেওয়া যায়নি। আবার চেষ্টা করুন।')
    }
  }

  if (status === 'loading') return <div className="center">লোড হচ্ছে…</div>
  if (status === 'missing') return <div className="center">সূচি পাওয়া যায়নি। <Link to="/">ফিরে যান</Link></div>
  if (status === 'error' || !data) return <div className="center err">সূচি লোড করা যায়নি।</div>

  const s = data.schedule
  const owner = data.owner
  const signer = owner ? `${owner.full_name}${owner.block_name ? `, ${owner.block_name} ব্লক` : ''}` : ''
  const canReview = !!profile && (profile.role === 'approver' || profile.role === 'admin') && s.status === 'submitted'

  async function decide(kind: 'approved' | 'returned') {
    if (!id || !data || !profile) return
    const note = reviewNote.trim()
    if (kind === 'returned' && !note) return alert('ফেরত দিতে হলে মন্তব্য লিখুন।')
    if (!confirm(kind === 'approved' ? 'এই সূচি অনুমোদন করবেন?' : 'মন্তব্যসহ সূচিটি এসএএও-কে ফেরত দেবেন?')) return
    setReviewBusy(true)
    try {
      if (kind === 'approved') await approveSchedule(id, profile.id)
      else await returnSchedule(id, note)
      setData({
        ...data,
        schedule: {
          ...data.schedule,
          status: kind,
          approver_note: kind === 'returned' ? note : null,
          approved_at: kind === 'approved' ? new Date().toISOString() : null,
        },
      })
      setReviewNote('')
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : 'সিদ্ধান্ত সেভ করা যায়নি।')
    }
    setReviewBusy(false)
  }

  return (
    <div className="page wide">
      <div className="noprint">
        <p><Link to="/">← সূচির তালিকা</Link></p>
        <div className="card bar">
          <div>
            <strong>{s.month_label} · {s.fortnight === 1 ? '১ম' : '২য়'} পক্ষ</strong>
            <span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
            {owner && <div className="muted">{signer}</div>}
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            {editable && (
              <span className="muted">
                {saveState === 'saving' ? 'সেভ হচ্ছে…' : saveState === 'saved' ? '✓ সেভ হয়েছে' : 'সেভ হয়নি — আবার চেষ্টা হবে'}
              </span>
            )}
            <button className="ghost" onClick={() => window.print()}>প্রিন্ট / PDF</button>
            {editable && <button onClick={() => void onSubmit()}>জমা দিন</button>}
          </div>
        </div>
        {s.status === 'returned' && s.approver_note && (
          <div className="card note-box"><strong>অনুমোদনকারীর মন্তব্য:</strong> {s.approver_note}</div>
        )}
        {canReview && (
          <div className="card review">
            <strong>পর্যালোচনা</strong>
            <textarea
              className="rv"
              rows={2}
              placeholder="মন্তব্য (ফেরত দিতে হলে বাধ্যতামূলক)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <div className="row">
              <button disabled={reviewBusy} onClick={() => void decide('approved')}>অনুমোদন দিন</button>
              <button className="ghost" disabled={reviewBusy} onClick={() => void decide('returned')}>মন্তব্যসহ ফেরত দিন</button>
            </div>
          </div>
        )}
        <p className="muted">
          {editable
            ? 'ফর্মের ঘরগুলোতেই সরাসরি লিখুন। লেখা নিজে থেকেই সেভ হয়। এক লাইনে সংক্ষেপে লিখলে প্রিন্টে সুন্দর আসে।'
            : 'এই সূচি এখন শুধু দেখা ও প্রিন্ট করা যাবে।'}
        </p>
      </div>

      <div className="wrap">
        {([0, 1] as const).map((w) => (
          <ScheduleSheet
            key={w}
            week={w}
            start={s.start_date}
            month={s.month_label}
            fortnight={s.fortnight}
            signer={signer}
            entries={entries}
            notes={notes}
            readOnly={!editable}
            onEntry={onEntry}
            onNote={onNote}
          />
        ))}
      </div>
    </div>
  )
}
