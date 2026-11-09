import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { bn } from '../lib/period'
import { loadReminders, markSeen } from '../lib/reminders'
import type { Reminder } from '../lib/reminders'
import Icon from './Icon'

// বার্তার তালিকা: পেজ বদলালে, অ্যাপে ফিরলে আর প্রতি ৫ মিনিটে নতুন করে আনা
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
  // দেখা হয়ে গেলে তালিকা থেকে সরানো ও সার্ভারে লেখা (অন্য ডিভাইসেও আর দেখাবে না)
  const seen = useCallback((ids: string[]) => {
    if (!profile || !ids.length) return
    setItems((l) => l.filter((r) => !ids.includes(r.id)))
    void markSeen(profile.id, ids).catch(() => undefined)
  }, [profile])
  return { items, seen }
}

const Item = ({ r, onGo }: { r: Reminder; onGo?: () => void }) => (
  <Link to={r.to} className={`rem-item lv-${r.level}`} onClick={onGo}>
    <span className="rem-dot" aria-hidden="true">{r.level === 'good' && <Icon name="check" size={12} />}</span>
    <span className="rem-text">
      <b>{r.text}</b>
      {r.sub && <small>{r.sub}</small>}
    </span>
    <Icon name="right" size={16} />
  </Link>
)

// হেডারের ঘণ্টা: খুললে বার্তাগুলো দেখায়, বন্ধ করলে সেগুলো "দেখা হয়েছে" হয়ে ঘণ্টা থেকে সরে যায়
export function ReminderBell({ items, onSeen }: { items: Reminder[]; onSeen: (ids: string[]) => void }) {
  const [shown, setShown] = useState<Reminder[] | null>(null) // খোলা থাকাকালীন তালিকা
  const box = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setShown((cur) => {
      if (cur) onSeen(cur.map((r) => r.id))
      return null
    })
  }, [onSeen])
  useEffect(() => {
    if (!shown) return
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [shown, close])
  const urgent = items.some((r) => r.level === 'urgent')
  return (
    <div className="bell-wrap" ref={box}>
      <button type="button" className={'bell' + (urgent ? ' urgent' : '')} aria-expanded={!!shown} aria-haspopup="true"
        aria-label={items.length ? `${bn(items.length)}টি নতুন বার্তা` : 'নতুন বার্তা নেই'}
        onClick={() => (shown ? close() : setShown(items))}>
        <Icon name="bell" size={20} />
        {items.length > 0 && <span className="bell-n">{bn(items.length)}</span>}
      </button>
      {shown && (
        <div className="bell-pop" role="dialog" aria-label="বার্তা">
          <div className="bell-head">বার্তা</div>
          {shown.length === 0
            ? <p className="bell-empty"><Icon name="check" size={18} /> নতুন কোনো বার্তা নেই</p>
            : <>
                {shown.map((r) => <Item key={r.id} r={r} onGo={close} />)}
                <p className="bell-foot">দেখা হয়ে গেলে বার্তাগুলো এখান থেকে সরে যাবে। বাকি কাজের বার্তা পরদিন আবার আসবে।</p>
              </>}
        </div>
      )}
    </div>
  )
}

// জরুরি হলে পেজের উপরে ফিতা; ✕ চাপলে "দেখা হয়েছে"
export function ReminderBanner({ items, onSeen }: { items: Reminder[]; onSeen: (ids: string[]) => void }) {
  const urgent = items.filter((r) => r.level === 'urgent')
  if (!urgent.length) return null
  const r = urgent[0]
  return (
    <div className="rem-banner noprint" role="alert">
      <Icon name="alert" size={20} />
      <Link to={r.to} className="rb-text" onClick={() => onSeen([r.id])}>
        <b>{r.text}</b>
        {r.sub && <span>{r.sub}</span>}
        {urgent.length > 1 && <span className="rb-more">আরও {bn(urgent.length - 1)}টি জরুরি বার্তা, উপরের ঘণ্টায় দেখুন</span>}
      </Link>
      <button type="button" className="icon-btn" aria-label="দেখা হয়েছে" title="দেখা হয়েছে" onClick={() => onSeen([r.id])}>
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}
