// সার্ভারের ভাগ (Vercel Functions): ফোনে নোটিফিকেশন পাঠানো
// দরকারি Environment Variables (Vercel → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  Supabase-এর service_role/secret কী (শুধু সার্ভারে, কখনো VITE_ নামে নয়)
//   VAPID_PRIVATE_KEY          নোটিফিকেশনের গোপন কী
//   VITE_VAPID_PUBLIC_KEY      নোটিফিকেশনের প্রকাশ্য কী (অ্যাপও এটা পড়ে)
//   CRON_SECRET                প্রতিদিনের মনে করিয়ে দেওয়ার জন্য (Vercel Cron নিজে পাঠায়)
//   VITE_SUPABASE_URL          আগে থেকেই আছে
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
export interface Res { status: (n: number) => Res; json: (b: unknown) => void; end: () => void; setHeader: (k: string, v: string) => void }

export const env = (k: string) => (process.env[k] ?? '').trim()
export const header = (req: Req, k: string) => { const v = req.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? '' }

export function admin() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY বা VITE_SUPABASE_URL সেট করা নেই')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

let vapidReady = false
function setupVapid(siteUrl: string) {
  if (vapidReady) return
  const pub = env('VAPID_PUBLIC_KEY') || env('VITE_VAPID_PUBLIC_KEY')
  const priv = env('VAPID_PRIVATE_KEY')
  if (!pub || !priv) throw new Error('VAPID কী সেট করা নেই')
  webpush.setVapidDetails(env('VAPID_SUBJECT') || siteUrl || 'https://saao-dairy.vercel.app', pub, priv)
  vapidReady = true
}

export interface Payload { title: string; body: string; url: string; tag?: string }

// কিছু ইউজারের সব ফোনে পাঠানো; মেয়াদ শেষ হওয়া ঠিকানা মুছে ফেলা
export async function sendTo(db: ReturnType<typeof admin>, userIds: string[], p: Payload, siteUrl: string) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return { sent: 0, failed: 0 }
  setupVapid(siteUrl)
  const { data } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', ids)
  let sent = 0, failed = 0
  await Promise.all(((data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 60 * 60 * 24, urgency: 'normal' })
      sent++
      await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id)
    } catch (e) {
      failed++
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return { sent, failed }
}

// ---- তারিখ (বাংলাদেশ সময়) ----
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
const BN = '০১২৩৪৫৬৭৮৯'
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[Number(d)])
export const todayDhaka = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10)
export const monthTitleOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${bn(iso.slice(0, 4))}`
export const fmtDayMonth = (iso: string) => `${bn(Number(iso.slice(8, 10)))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
export function nextMonthStart(iso: string) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7))
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}
export const siteOf = (req: Req) => { const h = header(req, 'x-forwarded-host') || header(req, 'host'); return h ? `https://${h}` : '' }
