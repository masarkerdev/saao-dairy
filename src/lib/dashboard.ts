// কো-এডমিন ও উপজেলা কৃষি অফিসারের জন্য: একটি মাসে সব এসএএও (প্রতিটি ব্লক) কে কোন অবস্থায়
// জমা মাসে একবার (দুই পক্ষ একসাথে), তাই সারিও মাস ধরে
import { supabase } from './supabase'
import { monthEnd, monthPeriods, monthStart, periodStart } from './period'
import type { Month } from './period'
import { groupByMonth } from './schedules'
import type { Schedule, Status } from './schedules'
import type { Profile } from '../types'
import { chargeActive } from './blocks'
import type { BlockCharge } from './blocks'

export type RowState = Status | 'none'
export interface SaaoRow {
  key: string
  block: string // কোন ব্লকের সারি
  extra: boolean // অতিরিক্ত দায়িত্ব
  profile: Profile
  schedule: Schedule | null // মাসের ১ম পক্ষ (না থাকলে ২য়)
  pokkhos: number // কয়টি পক্ষ তৈরি (০-২)
  state: RowState
  filled: number // দুই পক্ষ মিলিয়ে পূরণ (২৪-এর মধ্যে)
}

// কাজের ক্রম: যাঁদের নিয়ে কিছু করার আছে তাঁরা আগে
const RANK: Record<RowState, number> = { none: 0, draft: 1, returned: 2, submitted: 3, forwarded: 4, approved: 5 }

export async function monthOverview(m: Month): Promise<SaaoRow[]> {
  const starts = monthPeriods(m).map(periodStart)
  const [pr, sc, ch] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'saao').eq('active', true).order('full_name'),
    supabase.from('schedules').select('*').in('start_date', starts),
    supabase.from('block_charges').select('*'),
  ])
  if (pr.error) throw pr.error
  if (sc.error) throw sc.error
  const schedules = (sc.data ?? []) as Schedule[]
  const ids = schedules.map((s) => s.id)
  const filled = new Map<string, number>()
  if (ids.length) {
    const g = await supabase.from('schedule_groups').select('schedule_id,group_name,topics,visit_date').in('schedule_id', ids)
    for (const r of g.data ?? []) {
      const ok = String(r.group_name ?? '').trim() && r.visit_date && ((r.topics as string[] | null) ?? []).some((t) => t.trim())
      if (ok) filled.set(r.schedule_id, (filled.get(r.schedule_id) ?? 0) + 1)
    }
  }
  const months = groupByMonth(schedules)
  // প্রতিটি এসএএও-র নিজ ব্লক + এই মাসে চালু থাকা অতিরিক্ত দায়িত্বের ব্লক: প্রতিটি আলাদা সারি
  const charges = ((ch.data ?? []) as BlockCharge[]).filter((c) => chargeActive(c, monthStart(m), monthEnd(m)))
  const rows: SaaoRow[] = []
  for (const profile of (pr.data ?? []) as Profile[]) {
    const own = profile.block_name ?? ''
    const blocks = [{ name: own, extra: false }, ...charges.filter((c) => c.saao_id === profile.id && c.block_name !== own).map((c) => ({ name: c.block_name, extra: true }))]
    for (const b of blocks) {
      const g = months.find((x) => x.main.saao_id === profile.id && (b.extra ? x.block === b.name : !x.extra))
      const parts = g ? [g.first, g.second].filter(Boolean) as Schedule[] : []
      rows.push({
        key: `${profile.id}|${b.name}`, block: b.name, extra: b.extra, profile,
        schedule: g?.main ?? null, pokkhos: parts.length,
        state: g ? g.status : 'none',
        filled: parts.reduce((n, s) => n + (filled.get(s.id) ?? 0), 0),
      })
    }
  }
  return rows.sort((a, b) => RANK[a.state] - RANK[b.state] || a.profile.full_name.localeCompare(b.profile.full_name, 'bn'))
}
