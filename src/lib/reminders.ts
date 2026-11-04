// অ্যাপের ভেতরের মনে করিয়ে দেওয়া (ঘণ্টা-আইকন ও হোমের উপরের সতর্কবার্তা)
//  • এসএএও: পরের পক্ষের সূচি জমার শেষ তারিখ কাছে/পার হয়েছে (প্রতিটি ব্লকের আলাদা), ফেরত আসা সূচি
//  • কো-এডমিন/এডমিন: যাচাই/অনুমোদন বাকি, শেষ তারিখ কাছে অথচ জমা দেননি এমন এসএএও
//  • ডেভেলপার ও যাচাইকারী: অনুমোদনের অপেক্ষায় নতুন সাইনআপ
import { pendingUsersCount } from './admin'
import { blocksFor, listCharges } from './blocks'
import { getSubmitDaysBefore } from './catalog'
import { periodOverview } from './dashboard'
import { bn, daysBetween, deadlineFor, fmtDayMonth, periodStart, periodTitle, planningPeriod, todayISO } from './period'
import { countByStatus } from './review'
import { listMySchedules, schedulePeriod } from './schedules'
import type { Profile } from '../types'
import { isDeveloper, isReviewer } from '../types'

export type Level = 'urgent' | 'soon' | 'info'
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

export async function loadReminders(profile: Profile): Promise<Reminder[]> {
  const today = todayISO()
  const out: Reminder[] = []
  const daysBefore = await getSubmitDaysBefore().catch(() => 2)
  const p = planningPeriod(today)
  const dl = deadlineFor(p, daysBefore)
  const left = daysBetween(today, dl)
  // পক্ষ শুরু হয়ে গেলে ওই পক্ষের জমার কথা আর বলা হয় না
  const stillRelevant = today < periodStart(p)

  if (profile.role === 'saao') {
    const [list, charges] = await Promise.all([listMySchedules(profile.id), listCharges(profile.id).catch(() => [])])
    for (const s of list.filter((x) => x.status === 'returned')) {
      out.push({
        id: `ret-${s.id}`, level: 'urgent', to: `/schedules/${s.id}`,
        text: `${periodTitle(schedulePeriod(s))}${s.extra_charge ? ` (${s.block_name} ব্লক)` : ''} সংশোধনের জন্য ফেরত এসেছে`,
        sub: s.approver_note ? `মন্তব্য: ${s.approver_note}` : 'ঠিক করে আবার জমা দিন',
      })
    }
    if (stillRelevant && left <= REMIND_DAYS) {
      for (const b of blocksFor(profile, charges, p)) {
        const s = list.find((x) => x.start_date === periodStart(p) && (b.extra ? x.block_name === b.name : !x.extra_charge))
        if (s && s.status !== 'draft') continue // জমা হয়ে গেছে (ফেরত আসাগুলো উপরে)
        const blk = b.extra ? ` · ${b.name} ব্লক (অতিরিক্ত দায়িত্ব)` : ''
        out.push({
          id: `due-${periodStart(p)}-${b.name}`,
          level: left <= 1 ? 'urgent' : 'soon',
          to: s ? `/schedules/${s.id}` : `/schedules/new?p=${p.year}-${p.month}-${p.fortnight}${b.extra ? `&b=${encodeURIComponent(b.name)}` : ''}`,
          text: `${periodTitle(p)}${blk}: সূচি ${s ? 'জমা দেওয়া হয়নি' : 'এখনো তৈরি হয়নি'}`,
          sub: when(left, dl),
        })
      }
    }
  }

  if (isReviewer(profile.role)) {
    const mine = profile.role === 'admin' ? 'forwarded' : 'submitted'
    const [n, rows] = await Promise.all([
      countByStatus(mine, profile.id).catch(() => 0),
      stillRelevant && left <= REMIND_DAYS ? periodOverview(p).catch(() => []) : Promise.resolve([]),
    ])
    if (n > 0) {
      out.push({
        id: `review-${mine}-${n}`, level: 'soon', to: '/review',
        text: profile.role === 'admin' ? `${bn(n)}টি সূচি আপনার অনুমোদনের অপেক্ষায়` : `${bn(n)}টি সূচি আপনার যাচাইয়ের অপেক্ষায়`,
        sub: 'পর্যালোচনা পেজে দেখুন',
      })
    }
    const notYet = rows.filter((r) => ['none', 'draft', 'returned'].includes(r.state))
    const names = [...new Set(notYet.map((r) => r.profile.full_name))]
    if (notYet.length) {
      out.push({
        id: `notyet-${periodStart(p)}-${notYet.length}`, level: left <= 0 ? 'urgent' : 'soon', to: '/',
        text: `${periodTitle(p)}: ${bn(notYet.length)}টি ব্লকের সূচি এখনো জমা পড়েনি`,
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

  const rank: Record<Level, number> = { urgent: 0, soon: 1, info: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}
