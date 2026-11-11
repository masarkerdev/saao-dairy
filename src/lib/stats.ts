// পরিসংখ্যান: কয়েক মাসের জমা, অনুমোদন, আলোচ্য বিষয় ও ইউনিয়নভিত্তিক ভিজিট
import { supabase } from './supabase'
import { chargeActive } from './blocks'
import type { BlockCharge } from './blocks'
import { getSubmitDaysBefore } from './catalog'
import { daysBetween, monthDeadline, monthEnd, monthStart, prevMonth, toISO, todayISO } from './period'
import type { Month } from './period'
import { groupByMonth, monthKeyOf } from './schedules'
import type { Schedule } from './schedules'
import type { Profile } from '../types'

export type SubmitState = 'onTime' | 'late' | 'missing' | 'pending'
export const STATE_TEXT: Record<SubmitState, string> = {
  onTime: 'সময়মতো জমা', late: 'দেরিতে জমা', missing: 'জমা হয়নি', pending: 'এখনো সময় আছে',
}

export interface MonthStat { month: Month; expected: number; onTime: number; late: number; missing: number; pending: number; approved: number }
export interface SaaoStat {
  key: string; profile: Profile; block: string; extra: boolean
  expected: number; onTime: number; late: number; missing: number; approved: number
  filledAvg: number | null // প্রতি মাসে গড় কয়টি গ্রুপ পূরণ (২৪-এর মধ্যে)
  approveDaysAvg: number | null
}
export interface Stats {
  months: MonthStat[]
  saaos: SaaoStat[]
  topics: [string, number][]
  unions: [string, number][]
  visits: number
  onTimeRate: number | null
  approveDaysAvg: number | null
  activeSaao: number
}

const dayOf = (ts: string) => toISO(new Date(ts)) // স্থানীয় (বাংলাদেশ) তারিখ
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const unionFromAddress = (a: string) => a.match(/ইউনিয়ন\s*[:ঃ]\s*([^,]+)/)?.[1]?.trim() ?? ''

// end মাস পর্যন্ত count মাস (পুরোনো থেকে নতুন)
export function monthRange(end: Month, count: number): Month[] {
  const out: Month[] = []
  let m = end
  for (let i = 0; i < count; i++) { out.unshift(m); m = prevMonth(m) }
  return out
}

export async function loadStats(months: Month[]): Promise<Stats> {
  const from = monthStart(months[0])
  const to = monthEnd(months[months.length - 1])
  const today = todayISO()
  const [daysBefore, pr, sc, ch] = await Promise.all([
    getSubmitDaysBefore().catch(() => 2),
    supabase.from('profiles').select('*').eq('role', 'saao').eq('active', true).order('full_name'),
    supabase.from('schedules').select('*').gte('start_date', from).lte('start_date', to),
    supabase.from('block_charges').select('*'),
  ])
  if (pr.error) throw pr.error
  if (sc.error) throw sc.error
  const profiles = (pr.data ?? []) as Profile[]
  const schedules = (sc.data ?? []) as Schedule[]
  const charges = (ch.data ?? []) as BlockCharge[]
  const ids = schedules.map((s) => s.id)

  // গ্রুপ ও ঘটনা (অনেক সূচি হলে ভাগে ভাগে আনা)
  const chunks = <T,>(a: T[], n = 150) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
  type G = { schedule_id: string; group_name: string | null; topics: string[] | null; visit_date: string | null; farmer_group_id: string | null; address: string | null }
  type E = { schedule_id: string; to_status: string; created_at: string }
  const groups: G[] = []
  const events: E[] = []
  for (const part of chunks(ids)) {
    const [g, e] = await Promise.all([
      supabase.from('schedule_groups').select('schedule_id,group_name,topics,visit_date,farmer_group_id,address').in('schedule_id', part),
      supabase.from('schedule_events').select('schedule_id,to_status,created_at').in('schedule_id', part).in('to_status', ['submitted', 'approved']).order('created_at'),
    ])
    groups.push(...((g.data ?? []) as G[]))
    events.push(...((e.data ?? []) as E[]))
  }
  const fgIds = [...new Set(groups.map((g) => g.farmer_group_id).filter(Boolean))] as string[]
  const fgUnion = new Map<string, string>()
  for (const part of chunks(fgIds)) {
    const { data } = await supabase.from('farmer_groups').select('id,union_name').in('id', part)
    for (const r of (data ?? []) as { id: string; union_name: string | null }[]) if (r.union_name) fgUnion.set(r.id, r.union_name)
  }

  const filledBy = new Map<string, number>()
  const topicCount = new Map<string, number>()
  const unionCount = new Map<string, number>()
  let visits = 0
  for (const g of groups) {
    if (!String(g.group_name ?? '').trim() || !g.visit_date) continue
    visits++
    if ((g.topics ?? []).some((t) => t.trim())) filledBy.set(g.schedule_id, (filledBy.get(g.schedule_id) ?? 0) + 1)
    for (const t of g.topics ?? []) { const k = t.trim(); if (k) topicCount.set(k, (topicCount.get(k) ?? 0) + 1) }
    const u = (g.farmer_group_id && fgUnion.get(g.farmer_group_id)) || unionFromAddress(g.address ?? '') || 'ইউনিয়ন লেখা নেই'
    unionCount.set(u, (unionCount.get(u) ?? 0) + 1)
  }
  const firstEvent = (sids: string[], st: string) => events.filter((e) => sids.includes(e.schedule_id) && e.to_status === st).map((e) => e.created_at).sort()[0]

  const byMonthKey = new Map(groupByMonth(schedules).map((g) => [monthKeyOf(g.main), g]))
  const monthStats: MonthStat[] = months.map((m) => ({ month: m, expected: 0, onTime: 0, late: 0, missing: 0, pending: 0, approved: 0 }))
  const saaoStats = new Map<string, SaaoStat & { _filled: number[]; _days: number[] }>()
  const approveDaysAll: number[] = []

  months.forEach((m, mi) => {
    const start = monthStart(m)
    const deadline = monthDeadline(m, daysBefore)
    for (const p of profiles) {
      if (p.created_at && dayOf(p.created_at) > deadline) continue // জমার শেষ তারিখের পরে একাউন্ট খোলা হয়েছে
      const own = p.block_name ?? ''
      const blocks = [{ name: own, extra: false }, ...charges
        .filter((c) => c.saao_id === p.id && c.block_name !== own && chargeActive(c, start, monthEnd(m)))
        .map((c) => ({ name: c.block_name, extra: true }))]
      for (const b of blocks) {
        const key = `${p.id}|${b.name}`
        const st = saaoStats.get(key) ?? { key, profile: p, block: b.name, extra: b.extra, expected: 0, onTime: 0, late: 0, missing: 0, approved: 0, filledAvg: null, approveDaysAvg: null, _filled: [], _days: [] }
        const g = byMonthKey.get(`${p.id}|${b.name}|${start.slice(0, 7)}`)
        const parts = g ? ([g.first, g.second].filter(Boolean) as Schedule[]) : []
        const sids = parts.map((s) => s.id)
        const submittedAt = g && g.status !== 'draft' ? firstEvent(sids, 'submitted') ?? g.main.submitted_at ?? null : null
        let state: SubmitState
        if (submittedAt) state = dayOf(submittedAt) <= deadline ? 'onTime' : 'late'
        else state = today > deadline ? 'missing' : 'pending'
        const ms = monthStats[mi]
        ms.expected++; ms[state]++
        if (state !== 'pending') { st.expected++; if (state !== 'missing') st[state]++; else st.missing++ }
        if (g?.status === 'approved') {
          ms.approved++; st.approved++
          const ap = firstEvent(sids, 'approved')
          if (submittedAt && ap) { const d = Math.max(0, daysBetween(dayOf(submittedAt), dayOf(ap))); st._days.push(d); approveDaysAll.push(d) }
        }
        if (parts.length) st._filled.push(parts.reduce((n, s) => n + (filledBy.get(s.id) ?? 0), 0))
        saaoStats.set(key, st)
      }
    }
  })

  const saaos = [...saaoStats.values()].map(({ _filled, _days, ...s }) => ({ ...s, filledAvg: avg(_filled), approveDaysAvg: avg(_days) }))
    .sort((a, b) => b.missing - a.missing || b.late - a.late || a.profile.full_name.localeCompare(b.profile.full_name, 'bn'))
  const decided = monthStats.reduce((n, m) => n + m.onTime + m.late + m.missing, 0)
  return {
    months: monthStats,
    saaos,
    topics: [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    unions: [...unionCount.entries()].sort((a, b) => b[1] - a[1]),
    visits,
    onTimeRate: decided ? monthStats.reduce((n, m) => n + m.onTime, 0) / decided : null,
    approveDaysAvg: avg(approveDaysAll),
    activeSaao: profiles.length,
  }
}
