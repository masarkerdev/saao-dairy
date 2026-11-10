import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { disablePush, enablePush, isMobile, pushState, useInstall } from '../lib/pwa'
import type { PushState } from '../lib/pwa'
import { useFeedback } from './Feedback'
import Icon from './Icon'

const PUSH_TEXT: Record<PushState, string> = {
  on: 'এই ফোনে নোটিফিকেশন চালু আছে',
  off: 'নোটিফিকেশন বন্ধ',
  denied: 'ব্রাউজারে নোটিফিকেশন আটকানো আছে',
  'needs-install': 'আইফোনে আগে অ্যাপটি হোম স্ক্রিনে যোগ করতে হবে',
  unsupported: 'এই ব্রাউজারে নোটিফিকেশন চলে না',
  'not-configured': 'নোটিফিকেশন এখনো চালু করা হয়নি (সার্ভার সেটআপ বাকি)',
}

// প্রোফাইল পেজের অংশ: অ্যাপ ইন্সটল ও ফোনে নোটিফিকেশন
export default function AppSetup() {
  const { toast } = useFeedback()
  const inst = useInstall()
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { pushState().then(setPush).catch(() => setPush('unsupported')) }, [])

  async function togglePush() {
    setBusy(true)
    try {
      const st = push === 'on' ? await disablePush() : await enablePush()
      setPush(st)
      if (st === 'on') toast('নোটিফিকেশন চালু হয়েছে। সূচি জমা, যাচাই, অনুমোদন ও শেষ তারিখের বার্তা ফোনে আসবে।')
      else if (st === 'denied') toast('নোটিফিকেশনের অনুমতি দেওয়া হয়নি। ব্রাউজারের সাইট সেটিংস থেকে অনুমতি দিন।', 'err')
      else if (push === 'on') toast('এই ফোনে নোটিফিকেশন বন্ধ হয়েছে')
    } catch {
      toast('নোটিফিকেশন চালু করা যায়নি। আবার চেষ্টা করুন।', 'err')
    }
    setBusy(false)
  }

  return (
    <section className="card app-setup">
      <h2><Icon name="phone" size={18} /> মোবাইল অ্যাপ ও নোটিফিকেশন</h2>

      <div className="as-row">
        <span className={'as-ico' + (inst.installed ? ' ok' : '')}><Icon name={inst.installed ? 'check' : 'leaf'} size={20} /></span>
        <div className="as-text">
          <b>অ্যাপ হিসেবে ইন্সটল</b>
          {inst.installed ? <span className="muted small">এখন অ্যাপ হিসেবে খোলা আছে।</span>
            : inst.canPrompt ? <span className="muted small">ফোনের হোম স্ক্রিনে আইকন থাকবে, অ্যাপের মতো পুরো পর্দায় খুলবে।</span>
              : inst.ios ? <span className="muted small">Safari-তে নিচের <b>শেয়ার</b> বোতাম (□↑) চাপুন, তারপর <b>Add to Home Screen</b> বা <b>হোম স্ক্রিনে যোগ করুন</b>।</span>
                : <span className="muted small">Chrome-এর উপরের ⋮ মেনু থেকে <b>Install app</b> বা <b>Add to Home screen</b> চাপুন।</span>}
        </div>
        {!inst.installed && inst.canPrompt && (
          <button type="button" onClick={() => void inst.install()}>ইন্সটল করুন</button>
        )}
      </div>

      <div className="as-row">
        <span className={'as-ico' + (push === 'on' ? ' ok' : '')}><Icon name="bell" size={20} /></span>
        <div className="as-text">
          <b>ফোনে নোটিফিকেশন</b>
          <span className="muted small">{push ? PUSH_TEXT[push] : 'দেখা হচ্ছে…'}</span>
          {push === 'needs-install' && <span className="muted small">উপরের মতো হোম স্ক্রিনে যোগ করে সেখান থেকে অ্যাপ খুলুন, তারপর এখানে আবার আসুন।</span>}
          {push === 'denied' && <span className="muted small">ঠিকানা-বারের 🔒 চিহ্ন বা ফোনের Settings → Apps → Chrome → Notifications থেকে অনুমতি দিন।</span>}
        </div>
        {(push === 'off' || push === 'on') && (
          <button type="button" className={push === 'on' ? 'ghost' : ''} disabled={busy} onClick={() => void togglePush()}>
            {busy ? 'অপেক্ষা করুন…' : push === 'on' ? 'বন্ধ করুন' : 'চালু করুন'}
          </button>
        )}
      </div>
      <p className="muted small" style={{ margin: 0 }}>নোটিফিকেশন প্রতিটি ফোন বা কম্পিউটারে আলাদা করে চালু করতে হয়। লগআউট করলে ওই ফোনে বন্ধ হয়ে যায়।</p>
    </section>
  )
}

// হোমের উপরে ছোট পরামর্শ (মোবাইলে, ইন্সটল বা নোটিফিকেশন বাকি থাকলে); বন্ধ করলে আর দেখায় না
const KEY = 'saao-app-tip-hidden'
export function AppTip() {
  const inst = useInstall()
  const [push, setPush] = useState<PushState | null>(null)
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  useEffect(() => { pushState().then(setPush).catch(() => setPush('unsupported')) }, [])
  if (hidden || !isMobile() || push === null) return null
  const needInstall = !inst.installed
  const needPush = push === 'off' || push === 'needs-install'
  if (!needInstall && !needPush) return null
  return (
    <div className="app-tip noprint">
      <Icon name="bell" size={20} />
      <Link to="/profile" className="at-text">
        <b>{needInstall ? 'ফোনে অ্যাপ হিসেবে রাখুন' : 'ফোনে নোটিফিকেশন চালু করুন'}</b>
        <span>{needInstall ? 'হোম স্ক্রিনে আইকন, আর সূচির খবর সরাসরি ফোনে। প্রোফাইল পেজে দেখুন →' : 'জমা, যাচাই, অনুমোদন ও শেষ তারিখের বার্তা ফোনে আসবে →'}</span>
      </Link>
      <button type="button" className="icon-btn" aria-label="বন্ধ করুন" onClick={() => { try { localStorage.setItem(KEY, '1') } catch { /* ঐচ্ছিক */ } setHidden(true) }}>
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}
