// কো-এডমিন ও উপজেলা কৃষি অফিসারের জন্য: একটি পক্ষে সব এসএএও কে কোন অবস্থায়
import { supabase } from './supabase'
import { periodStart } from './period'
import type { Period } from './period'
import type { Schedule, Status } from './schedules'
import type { Profile } from '../types'
import { chargeActive } from './blocks'
import type { BlockCharge } from './blocks'
import { periodEnd } from './period'

export type RowState = Status | 'none'
export interface SaaoRow {
  key: string
  block: string // কোন ব্লকের সারি
  extra: boolean // অতিরিক্ত দায়িত্ব
  profile: Profile
  schedule: Schedule | null
  state: RowState
  filled: number
}

// কাজের ক্রম: যাঁদের নিয়ে কিছু করার আছে তাঁরা আগে
const RANK: Record<RowState, number> = { none: 0, draft: 1, returned: 2, submitted: 3, forwarded: 4, approved: 5 }

export async function periodOverview(p: Period): Promise<SaaoRow[]> {
  const [pr, sc, ch] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'saao').eq('active', true).order('full_name'),
    supabase.from('schedules').select('*').eq('start_date', periodStart(p)),
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
  // প্রতিটি এসএএও-র নিজ ব্লক + এই পক্ষে চালু থাকা অতিরিক্ত দায়িত্বের ব্লক: প্রতিটি আলাদা সারি
  const charges = ((ch.data ?? []) as BlockCharge[]).filter((c) => chargeActive(c, periodStart(p), periodEnd(p)))
  const rows: SaaoRow[] = []
  for (const profile of (pr.data ?? []) as Profile[]) {
    const own = profile.block_name ?? ''
    const blocks = [{ name: own, extra: false }, ...charges.filter((c) => c.saao_id === profile.id && c.block_name !== own).map((c) => ({ name: c.block_name, extra: true }))]
    for (const b of blocks) {
      const schedule = schedules.find((s) => s.saao_id === profile.id && (b.extra ? s.block_name === b.name : !s.extra_charge)) ?? null
      rows.push({
        key: `${profile.id}|${b.name}`, block: b.name, extra: b.extra, profile, schedule,
        state: schedule ? schedule.status : 'none', filled: schedule ? filled.get(schedule.id) ?? 0 : 0,
      })
    }
  }
  return rows.sort((a, b) => RANK[a.state] - RANK[b.state] || a.profile.full_name.localeCompare(b.profile.full_name, 'bn'))
}
