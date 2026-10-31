import { useEffect, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import Icon from './Icon'

// লগইন/সাইনআপ/অপেক্ষার পেজ: বাঁয়ে পরিচিতি (মোবাইলে উপরে), ডানে ফর্ম
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0) }, [title])
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <div className="auth-brand">
          <span className="mark lg"><Icon name="leaf" size={26} /></span>
          <div>
            <div className="bname">পাক্ষিক ভ্রমণসূচী</div>
            <div className="bsub">রাউজান উপজেলা কৃষি অফিস</div>
          </div>
        </div>
        <ul className="auth-points">
          <li><Icon name="calendar" size={18} /> ১-১৫ ও ১৬-শেষ পক্ষের ভিজিট সূচি, সরকারি ছুটি মেনে</li>
          <li><Icon name="review" size={18} /> জমা, যাচাই ও অনুমোদন এক জায়গায়</li>
          <li><Icon name="file" size={18} /> ফর্মটি PDF ও Word-এ এক ক্লিকে</li>
        </ul>
        <svg className="auth-field" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 90 Q100 60 200 85 T400 75 V120 H0z" />
          <path d="M0 105 Q120 80 230 100 T400 95 V120 H0z" />
        </svg>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </section>
    </div>
  )
}

// আইকনসহ ইনপুট; পাসওয়ার্ডে দেখানো/লুকানোর বোতাম
export function Field({ label, icon, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; icon?: string; hint?: string; error?: string | null
}) {
  const [show, setShow] = useState(false)
  const isPw = input.type === 'password'
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      <span className={'finput' + (error ? ' bad' : '')}>
        {icon && <Icon name={icon} size={18} />}
        <input {...input} type={isPw && show ? 'text' : input.type} aria-invalid={!!error} />
        {isPw && (
          <button type="button" className="peek" aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'} onClick={() => setShow((v) => !v)}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </span>
      {error ? <span className="ferr">{error}</span> : hint ? <span className="fhint">{hint}</span> : null}
    </label>
  )
}
