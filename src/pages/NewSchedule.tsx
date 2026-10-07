import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { createSchedule, isWednesday, monthOf, nextWednesday } from '../lib/schedules'

export default function NewSchedule() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [start, setStart] = useState(nextWednesday())
  const [fortnight, setFortnight] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!profile) return
    if (!isWednesday(start)) return setError('১ম সপ্তাহের শুরুর তারিখ অবশ্যই বুধবার হতে হবে।')
    setBusy(true)
    try {
      const s = await createSchedule(profile.id, start, fortnight)
      nav(`/schedules/${s.id}`, { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '23505' ? 'এই তারিখে আপনার সূচি আগেই তৈরি করা আছে।' : 'সূচি তৈরি করা যায়নি। আবার চেষ্টা করুন।')
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <p><Link to="/">← ফিরে যান</Link></p>
      <div className="card auth" style={{ margin: '0 auto' }}>
        <h1>নতুন পাক্ষিক সূচি</h1>
        <form onSubmit={onSubmit}>
          <label>১ম সপ্তাহের বুধবারের তারিখ
            <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>পক্ষ
            <select value={fortnight} onChange={(e) => setFortnight(Number(e.target.value) as 1 | 2)}>
              <option value={1}>১ম পক্ষ</option>
              <option value={2}>২য় পক্ষ</option>
            </select>
          </label>
          {start && <p className="muted">মাস: {monthOf(start)}</p>}
          {error && <p className="err">{error}</p>}
          <button disabled={busy}>{busy ? 'অপেক্ষা করুন…' : 'সূচি তৈরি করুন'}</button>
        </form>
      </div>
    </div>
  )
}
