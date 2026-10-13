// কো-এডমিন ও উপজেলা কৃষি অফিসারের জন্য: একটি পক্ষে সব এসএএও কে কোন অবস্থায়
import { supabase } from './supabase'
import { periodStart } from './period'
import type { Period } from './period'
import type { Schedule, Status } from './schedules'
import type { Profile } from '../types'

export type RowState = Status | 'none'
export interface SaaoRow {
  profile: Profile
  schedule: Schedule | null
  state: RowState
  filled: number
}

// কাজের ক্রম: যাঁদের নিয়ে কিছু করার আছে তাঁরা আগে
const RANK: Record<RowState, number> = { none: 0, draft: 1, returned: 2, submitted: 3, forwarded: 4, approved: 5 }

export async function periodOverview(p: Period): Promise<SaaoRow[]> {
  const [pr, sc] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'saao').eq('active', true).order('full_name'),
    supabase.from('schedules').select('*').eq('start_date', periodStart(p)),
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
  const bySaao = new Map(schedules.map((s) => [s.saao_id, s]))
  const rows: SaaoRow[] = ((pr.data ?? []) as Profile[]).map((profile) => {
    const schedule = bySaao.get(profile.id) ?? null
    return { profile, schedule, state: schedule ? schedule.status : 'none', filled: schedule ? filled.get(schedule.id) ?? 0 : 0 }
  })
  return rows.sort((a, b) => RANK[a.state] - RANK[b.state] || a.profile.full_name.localeCompare(b.profile.full_name, 'bn'))
}
