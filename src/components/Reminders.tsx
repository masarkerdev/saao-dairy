import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { bn, todayISO } from '../lib/period'
import { loadReminders } from '../lib/reminders'
import type { Reminder } from '../lib/reminders'
import Icon from './Icon'

// মনে করিয়ে দেওয়ার তালিকা: পেজ বদলালে, অ্যাপে ফিরলে আর প্রতি ৫ মিনিটে নতুন করে আনা
export function useReminders() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const [items, setItems] = useState<Reminder[]>([])
  const refresh = useCallback(() => {
    if (!profile?.active) return
    loadReminders(profile).then(setItems).catch(() => undefined)
  }, [profile])
  useEffect(() => { refresh() }, [refresh, pathname])
  useEffect(() => {
    const t = window.setInterval(refresh, 5 * 60 * 1000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [refresh])
  return items
}

const Item = ({ r, onGo }: { r: Reminder; onGo?: () => void }) => (
  <Link to={r.to} className={`rem-item lv-${r.level}`} onClick={onGo}>
    <span className="rem-dot" aria-hidden="true" />
    <span className="rem-text">
      <b>{r.text}</b>
      {r.sub && <small>{r.sub}</small>}
    </span>
    <Icon name="right" size={16} />
  </Link>
)

// হেডারের ঘণ্টা-আইকন: সংখ্যাসহ, চাপলে তালিকা
export function ReminderBell({ items }: { items: Reminder[] }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  const urgent = items.some((r) => r.level === 'urgent')
  return (
    <div className="bell-wrap" ref={box}>
      <button type="button" className={'bell' + (urgent ? ' urgent' : '')} aria-expanded={open} aria-haspopup="true"
        aria-label={items.length ? `${bn(items.length)}টি মনে করিয়ে দেওয়া` : 'মনে করিয়ে দেওয়া নেই'} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" size={20} />
        {items.length > 0 && <span className="bell-n">{bn(items.length)}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="মনে করিয়ে দেওয়া">
          <div className="bell-head">মনে করিয়ে দেওয়া</div>
          {items.length === 0
            ? <p className="bell-empty"><Icon name="check" size={18} /> এখন কিছু বাকি নেই</p>
            : items.map((r) => <Item key={r.id} r={r} onGo={() => setOpen(false)} />)}
        </div>
      )}
    </div>
  )
}

// জরুরি হলে পেজের উপরে ফিতা; "আজ আর দেখাবেন না" চাপলে সেদিনের মতো লুকায়
const KEY = 'saao-reminder-hidden'
const readHidden = (): string => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
const writeHidden = (v: string) => { try { localStorage.setItem(KEY, v) } catch { /* ঐচ্ছিক */ } }

export function ReminderBanner({ items }: { items: Reminder[] }) {
  const urgent = items.filter((r) => r.level === 'urgent')
  const stamp = `${todayISO()}|${urgent.map((r) => r.id).join(',')}`
  const [hidden, setHidden] = useState(readHidden())
  if (!urgent.length || hidden === stamp) return null
  const r = urgent[0]
  return (
    <div className="rem-banner noprint" role="alert">
      <Icon name="alert" size={20} />
      <Link to={r.to} className="rb-text">
        <b>{r.text}</b>
        {r.sub && <span>{r.sub}</span>}
        {urgent.length > 1 && <span className="rb-more">আরও {bn(urgent.length - 1)}টি জরুরি বিষয়, উপরের ঘণ্টায় দেখুন</span>}
      </Link>
      <button type="button" className="icon-btn" aria-label="আজ আর দেখাবেন না" title="আজ আর দেখাবেন না"
        onClick={() => { writeHidden(stamp); setHidden(stamp) }}>
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}
