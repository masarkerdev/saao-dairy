// ঘণ্টা-আইকনের বার্তা (অ্যাপের ভেতরে)
//  • এসএএও: পরের মাসের সূচি জমার শেষ তারিখ কাছে/পার (প্রতিটি ব্লক আলাদা), সূচি ফেরত এসেছে,
//    সূচি যাচাই হয়ে উপজেলা কৃষি অফিসারের কাছে গেছে, সূচি অনুমোদিত হয়েছে
//  • কো-এডমিন/এডমিন: যাচাই/অনুমোদন বাকি, শেষ তারিখ কাছে অথচ জমা পড়েনি এমন ব্লক, নতুন এসএএও সাইনআপ
//  • ডেভেলপার: কর্মকর্তাদের নতুন সাইনআপ
// একবার দেখলে (ঘণ্টা খুললে বা ফিতা বন্ধ করলে) বার্তাটি আর দেখায় না (sql/12: reminder_seen)।
// শেষ তারিখ ও বাকি কাজের বার্তা প্রতিদিন নতুন করে আসে, যতক্ষণ কাজটি বাকি থাকে।
import { pendingUsersCount } from './admin'
import { blocksFor, listCharges } from './blocks'
import { getSubmitDaysBefore } from './catalog'
import { monthOverview } from './dashboard'
import { bn, daysBetween, fmtDayMonth, monthDeadline, monthPeriods, monthStart, monthTitle, planningMonth, sameMonth, todayISO } from './period'
import { listForReview } from './review'
import { groupByMonth, listMySchedules, monthKeyOf, schedulePeriod } from './schedules'
import type { Schedule } from './schedules'
import { supabase } from './supabase'
import type { Profile } from '../types'
import { isDeveloper, isReviewer } from '../types'

export type Level = 'urgent' | 'soon' | 'info' | 'good'
export interface Reminder {
  id: string
  level: Level
  text: string
  sub?: string
  to: string
}

// শেষ তারিখের কত দিন আগে থেকে মনে করানো শুরু
export const REMIND_DAYS = 3

const when = (left: number, dl: string) =>
  left < 0 ? `শেষ সময় ছিল ${fmtDayMonth(dl)}, ${bn(-left)} দিন পার হয়েছে`
    : left === 0 ? `আজই শেষ দিন (${fmtDayMonth(dl)})`
      : `শেষ সময় ${fmtDayMonth(dl)}, ${bn(left)} দিন বাকি`

// ---- দেখা হয়েছে ----
export async function listSeen(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('reminder_seen').select('item_id').eq('user_id', userId)
  return new Set(((data ?? []) as { item_id: string }[]).map((r) => r.item_id))
}
export async function markSeen(userId: string, ids: string[]) {
  if (!ids.length) return
  await supabase.from('reminder_seen').upsert(ids.map((item_id) => ({ user_id: userId, item_id })), { onConflict: 'user_id,item_id' })
}

// এসএএও-র সূচিতে কর্মকর্তাদের সিদ্ধান্ত (গত ৬০ দিন); দুই পক্ষের একই সিদ্ধান্ত একটি বার্তা
interface Ev { id: number; schedule_id: string; to_status: string; note: string | null; created_at: string; actor_id: string | null; actor: { full_name: string; designation: string | null } | null }
async function decisionNotices(profile: Profile, list: Schedule[]): Promise<Reminder[]> {
  if (!list.length) return []
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data } = await supabase.from('schedule_events')
    .select('id,schedule_id,to_status,note,created_at,actor_id,actor:profiles!actor_id(full_name,designation)')
    .in('schedule_id', list.map((s) => s.id))
    .in('to_status', ['forwarded', 'approved', 'returned'])
    .gte('created_at', since)
    .order('id', { ascending: false })
  const byId = new Map(list.map((s) => [s.id, s]))
  const out: Reminder[] = []
  const done = new Set<string>()
  for (const e of (data ?? []) as unknown as Ev[]) {
    if (e.actor_id === profile.id) continue
    const s = byId.get(e.schedule_id)
    if (!s) continue
    const k = `${monthKeyOf(s)}|${e.to_status}|${e.created_at.slice(0, 16)}`
    if (done.has(k)) continue
    done.add(k)
    const title = `${monthTitle(schedulePeriod(s))}${s.extra_charge ? ` (${s.block_name} ব্লক)` : ''}`
    const who = e.actor?.full_name ? `${e.actor.full_name}${e.actor.designation ? `, ${e.actor.designation}` : ''}` : ''
    const at = fmtDayMonth(e.created_at.slice(0, 10))
    if (e.to_status === 'forwarded') {
      out.push({ id: `ev-${e.id}`, level: 'good', to: `/schedules/${s.id}`,
        text: `${title}-এর সূচি যাচাই হয়ে উপজেলা কৃষি অফিসারের কাছে পাঠানো হয়েছে`,
        sub: [who && `পাঠিয়েছেন ${who}`, at, e.note && `মন্তব্য: ${e.note}`].filter(Boolean).join(' · ') })
    } else if (e.to_status === 'approved') {
      out.push({ id: `ev-${e.id}`, level: 'good', to: `/schedules/${s.id}`,
        text: `${title}-এর সূচি অনুমোদিত হয়েছে`,
        sub: [who && `অনুমোদন দিয়েছেন ${who}`, at, e.note && `মন্তব্য: ${e.note}`].filter(Boolean).join(' · ') })
    } else {
      out.push({ id: `ev-${e.id}`, level: 'urgent', to: `/schedules/${s.id}`,
        text: `${title}-এর সূচি সংশোধনের জন্য ফেরত এসেছে`,
        sub: [who && `ফেরত দিয়েছেন ${who}`, e.note && `মন্তব্য: ${e.note}`].filter(Boolean).join(' · ') })
    }
  }
  return out
}

export async function loadReminders(profile: Profile): Promise<Reminder[]> {
  const today = todayISO()
  const out: Reminder[] = []
  const daysBefore = await getSubmitDaysBefore().catch(() => 2)
  const m = planningMonth(today)
  const dl = monthDeadline(m, daysBefore)
  const left = daysBetween(today, dl)
  // মাস শুরু হয়ে গেলে ওই মাসের জমার কথা আর বলা হয় না
  const stillRelevant = today < monthStart(m)

  if (profile.role === 'saao') {
    const [list, charges] = await Promise.all([listMySchedules(profile.id), listCharges(profile.id).catch(() => [])])
    out.push(...(await decisionNotices(profile, list).catch(() => [])))
    if (stillRelevant && left <= REMIND_DAYS) {
      const months = groupByMonth(list)
      for (const b of blocksFor(profile, charges, monthPeriods(m)[0])) {
        const g = months.find((x) => sameMonth(x.month, m) && (b.extra ? x.block === b.name : !x.extra))
        if (g && g.first && g.second && g.status !== 'draft' && g.status !== 'returned') continue // জমা হয়ে গেছে
        const blk = b.extra ? ` · ${b.name} ব্লক (অতিরিক্ত দায়িত্ব)` : ''
        const what = !g ? 'এখনো তৈরি হয়নি' : !(g.first && g.second) ? 'এক পক্ষ এখনো তৈরি হয়নি' : 'জমা দেওয়া হয়নি'
        out.push({
          id: `due-${monthStart(m)}-${b.name}-${today}`,
          level: left <= 1 ? 'urgent' : 'soon',
          to: g && g.first && g.second ? `/schedules/${g.main.id}` : `/schedules/new?m=${m.year}-${m.month}${b.extra ? `&b=${encodeURIComponent(b.name)}` : ''}`,
          text: `${monthTitle(m)}${blk}: মাসিক সূচি ${what}`,
          sub: when(left, dl),
        })
      }
    }
  }

  if (isReviewer(profile.role)) {
    const mine = profile.role === 'admin' ? 'forwarded' : 'submitted'
    const [pending, rows] = await Promise.all([
      listForReview(mine, profile.id).catch(() => []),
      stillRelevant && left <= REMIND_DAYS ? monthOverview(m).catch(() => []) : Promise.resolve([]),
    ])
    const n = new Set(pending.map(monthKeyOf)).size
    if (n > 0) {
      out.push({
        id: `review-${mine}-${n}-${today}`, level: 'soon', to: '/review',
        text: profile.role === 'admin' ? `${bn(n)}টি মাসিক সূচি আপনার অনুমোদনের অপেক্ষায়` : `${bn(n)}টি মাসিক সূচি আপনার যাচাইয়ের অপেক্ষায়`,
        sub: 'পর্যালোচনা পেজে দেখুন',
      })
    }
    const notYet = rows.filter((r) => ['none', 'draft', 'returned'].includes(r.state))
    const names = [...new Set(notYet.map((r) => r.profile.full_name))]
    if (notYet.length) {
      out.push({
        id: `notyet-${monthStart(m)}-${notYet.length}-${today}`, level: left <= 0 ? 'urgent' : 'soon', to: '/',
        text: `${monthTitle(m)}: ${bn(notYet.length)}টি ব্লকের মাসিক সূচি এখনো জমা পড়েনি`,
        sub: `${when(left, dl)} · ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` সহ ${bn(names.length)} জন` : ''}`,
      })
    }
  }

  if (isReviewer(profile.role) || isDeveloper(profile.role)) {
    const n = await pendingUsersCount(isDeveloper(profile.role) ? 'officer' : 'saao').catch(() => 0)
    if (n > 0) {
      out.push({
        id: `signup-${n}`, level: 'info', to: isDeveloper(profile.role) ? '/' : '/admin',
        text: `${bn(n)}জন নতুন সাইনআপ অনুমোদনের অপেক্ষায়`,
        sub: isDeveloper(profile.role) ? 'কর্মকর্তাদের একাউন্ট' : 'উপসহকারী কৃষি কর্মকর্তা',
      })
    }
  }

  // নতুন নোটিশ (গত ৩০ দিন, নিজের দেওয়া বাদে)
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: nts } = await supabase.from('notices').select('id,title,body,created_by,created_at,expires_on')
    .gte('created_at', since).order('created_at', { ascending: false })
  for (const n of (nts ?? []) as { id: string; title: string; body: string; created_by: string | null; expires_on: string | null }[]) {
    if (n.created_by === profile.id || (n.expires_on && n.expires_on < today)) continue
    out.push({ id: `notice-${n.id}`, level: 'info', to: '/notices', text: `নোটিশ: ${n.title}`, sub: n.body ? (n.body.length > 90 ? `${n.body.slice(0, 90)}…` : n.body) : undefined })
  }

  const seen = await listSeen(profile.id).catch(() => new Set<string>())
  const rank: Record<Level, number> = { urgent: 0, soon: 1, good: 2, info: 3 }
  return out.filter((r) => !seen.has(r.id)).sort((a, b) => rank[a.level] - rank[b.level])
}
