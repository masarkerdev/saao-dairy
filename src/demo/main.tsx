import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import App from '../App'
import ErrorBoundary from '../components/ErrorBoundary'
import { FeedbackProvider, useFeedback } from '../components/Feedback'
import { AuthProvider } from '../lib/auth'
import { setTodayForDemo } from '../lib/period'
import { demoAuth, resetDemo, supabase } from './mockSupabase'

// নমুনা তথ্য অক্টোবর ২০২৬-এর; ডেমোতে "আজ" ১৩ অক্টোবর ধরা হয়
setTodayForDemo('2026-10-13')

const PERSONAS = [
  {
    id: 'u_rahim', label: 'এসএএও', who: 'মোঃ রহিম উদ্দিন, নোয়াপাড়া ব্লক',
    hint: 'হোমে "পরের পক্ষ" কার্ড থেকে ১৬-৩১ অক্টোবরের সূচি খুলুন। ২২ অক্টোবর (নমুনা ছুটি) পড়ায় সতর্কবার্তা আসবে, "ছুটি অনুযায়ী আবার সাজান" চাপুন। তারপর বাকি গ্রুপে চিপ থেকে বিষয় বেছে জমা দিন। "আমার গ্রুপ" মেনুতে গ্রুপ তালিকা আছে।',
  },
  {
    id: 'u_aao', label: 'কো-এডমিন', who: 'মাহফুজ আহমেদ সরকার, অতিরিক্ত কৃষি অফিসার',
    hint: 'হোমে এই পক্ষে কে জমা দেননি দেখুন। সুমি দাশের সূচি খুলে উপজেলা কৃষি অফিসারের কাছে পাঠান। "ইউজার" থেকে তানভীর হাসানকে সক্রিয় করুন, "সেটিংস"-এ ছুটি ও আলোচ্য বিষয় যোগ করুন।',
  },
  {
    id: 'u_uao', label: 'উপজেলা কৃষি অফিসার', who: 'মোঃ আবদুল করিম, এডমিন',
    hint: 'হোমে "আপনার অনুমোদনের অপেক্ষায়" টাইলে চাপুন, কামাল হোসেনের সূচি খুলে অনুমোদন দিন।',
  },
]

function DemoBar() {
  const nav = useNavigate()
  const { toast } = useFeedback()
  const [cur, setCur] = useState<string | null>(demoAuth.current())
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setCur(s?.user.id ?? null))
    return () => { data.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    window.print = () => toast('ডেমোতে প্রিন্ট বন্ধ। আসল সাইটে এই ফর্মটাই A4 আড়াআড়ি দুই পৃষ্ঠায় ছাপা হবে।')
  }, [toast])

  const go = (id: string | null, path = '/') => {
    demoAuth.signInAs(id)
    setCur(id)
    nav(path)
  }
  const persona = PERSONAS.find((p) => p.id === cur)

  return (
    <div className="demo-bar">
      <div className="demo-row">
        <span className="demo-tag">ডেমো · নমুনা তথ্য · আজ ১৩ অক্টোবর ২০২৬</span>
        <span className="demo-as">যাঁর চোখে দেখবেন:</span>
        <div className="demo-btns">
          {PERSONAS.map((p) => (
            <button key={p.id} type="button" className={cur === p.id ? 'on' : ''} onClick={() => go(p.id)}>{p.label}</button>
          ))}
          <button type="button" className={cur && !persona ? 'on' : ''} onClick={() => go(null, '/signup')}>নতুন সাইনআপ</button>
          <button type="button" className="reset" onClick={() => { resetDemo(); go(persona ? persona.id : 'u_rahim'); toast('ডেমোর তথ্য শুরুর অবস্থায় ফেরানো হয়েছে') }}>
            শুরু থেকে
          </button>
        </div>
      </div>
      {persona && <p className="demo-hint"><b>{persona.who}:</b> {persona.hint}</p>}
      {!cur && <p className="demo-hint">একটি ভূমিকা বেছে নিন, অথবা নতুন এসএএও হিসেবে সাইনআপ করে দেখুন। সাইনআপের পর কো-এডমিন সক্রিয় না করা পর্যন্ত অপেক্ষার পেজ আসে।</p>}
    </div>
  )
}

demoAuth.signInAs('u_rahim')
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <FeedbackProvider>
          <DemoBar />
          <App />
        </FeedbackProvider>
      </AuthProvider>
    </MemoryRouter>
  </ErrorBoundary>,
)
