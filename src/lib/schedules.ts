import { supabase } from './supabase'
import type { FarmerGroup } from './catalog'
import { normalizeMobile } from './mobile'
import { MONTHS, bn, defaultPlaces, periodOf, periodStart } from './period'
import type { HolidayMap, Period, Place } from './period'
import type { Profile } from '../types'

export { bn } from './period'

export type Status = 'draft' | 'submitted' | 'forwarded' | 'approved' | 'returned'

export interface Schedule {
  id: string
  saao_id: string
  start_date: string // পক্ষের প্রথম দিন: ১ বা ১৬ তারিখ
  month_label: string
  fortnight: 1 | 2
  status: Status
  approver_note: string | null
  submitted_at: string | null
  forwarded_at: string | null
  approved_at: string | null
  returned_at: string | null
}

// একটি কৃষক গ্রুপের ভিজিট (ছবির ফর্মের এক ঘর + পাশের ৫টি আলোচ্য বিষয়)
export interface GroupInfo {
  group_name: string
  address: string
  mobile: string
  topics: string[] // ঠিক ৫টি ঘর
  visit_date: string | null
  slot: 1 | 2 | null
  farmer_group_id: string | null
}
export type GroupMap = Record<number, GroupInfo> // key: গ্রুপ নং ১-১২
export type NoteMap = Record<string, string> // key: তারিখ (বিকাল ৩.০০-৫.০০ ঘর)

export interface ScheduleEvent {
  id: number
  from_status: Status | null
  to_status: Status
  note: string | null
  created_at: string
  actor: { full_name: string; role: string } | null
}

export const STATUS_LABEL: Record<Status, string> = {
  draft: 'খসড়া',
  submitted: 'কো-এডমিনের যাচাইয়ের অপেক্ষায়',
  forwarded: 'উপজেলা কৃষি অফিসারের কাছে',
  approved: 'অনুমোদিত',
  returned: 'সংশোধনের জন্য ফেরত',
}
export const STATUS_SHORT: Record<Status, string> = {
  draft: 'খসড়া', submitted: 'যাচাই বাকি', forwarded: 'উপজেলায়', approved: 'অনুমোদিত', returned: 'ফেরত',
}

export const GROUP_COUNT = 12
export const g2 = (n: number) => bn(String(n).padStart(2, '0'))
export const emptyGroup = (): GroupInfo => ({
  group_name: '', address: '', mobile: '', topics: ['', '', '', '', ''], visit_date: null, slot: null, farmer_group_id: null,
})
export const schedulePeriod = (s: Pick<Schedule, 'start_date'>): Period => periodOf(s.start_date)

export const fmtTs = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return bn(`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`)
}

export const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string' && (e as { message: string }).message
    ? (e as { message: string }).message
    : fallback

// একটি গ্রুপ "পূরণ হয়েছে" ধরা হয় যখন নাম আছে, তারিখ আছে এবং অন্তত একটি আলোচ্য বিষয় আছে
export const isFilled = (g?: GroupInfo) => !!g && !!g.group_name.trim() && !!g.visit_date && g.topics.some((t) => t.trim())
export const filledCount = (groups: GroupMap) =>
  Array.from({ length: GROUP_COUNT }, (_, i) => groups[i + 1]).filter(isFilled).length

// ফর্মে গ্রুপ নং তারিখের ক্রমে (তারিখ, তারপর সকাল/দুপুর); তারিখ নেই এমন গ্রুপ শেষে
export function groupOrder(groups: GroupMap): number[] {
  return Array.from({ length: GROUP_COUNT }, (_, i) => i + 1).sort((a, b) => {
    const x = groups[a], y = groups[b]
    const kx = x?.visit_date ? `${x.visit_date}-${x.slot}` : `9999-${a}`
    const ky = y?.visit_date ? `${y.visit_date}-${y.slot}` : `9999-${b}`
    return kx < ky ? -1 : kx > ky ? 1 : a - b
  })
}
export function displayNumbers(groups: GroupMap): Record<number, number> {
  const out: Record<number, number> = {}
  groupOrder(groups).forEach((no, i) => { out[no] = i + 1 })
  return out
}

// ছুটি অনুযায়ী আবার সাজানো: গ্রুপের তথ্য ঠিক থাকে, শুধু তারিখ নতুন করে বসে (আগের ক্রম বজায় রেখে)
export function rearranged(groups: GroupMap, p: Period, holidays: HolidayMap): GroupMap {
  const places = defaultPlaces(p, holidays, GROUP_COUNT)
  const out: GroupMap = {}
  groupOrder(groups).forEach((no, i) => {
    const pl: Place | undefined = places[i]
    out[no] = { ...(groups[no] ?? emptyGroup()), visit_date: pl?.visit_date ?? null, slot: pl?.slot ?? null }
  })
  return out
}

export async function listMySchedules(userId: string): Promise<Schedule[]> {
  const { data, error } = await supabase.from('schedules').select('*').eq('saao_id', userId).order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Schedule[]
}

const rowOf = (scheduleId: string, no: number, g: GroupInfo) => ({
  schedule_id: scheduleId, group_no: no, group_name: g.group_name, address: g.address, mobile: normalizeMobile(g.mobile),
  topics: g.topics, visit_date: g.visit_date, slot: g.slot, farmer_group_id: g.farmer_group_id,
})

// নতুন সূচি: ১২টি গ্রুপের জায়গা ছুটি মেনে বসে; চাইলে নিজের গ্রুপ তালিকার প্রথম ১২টি নাম-ঠিকানা-মোবাইলসহ বসে
export async function createSchedule(userId: string, p: Period, holidays: HolidayMap, prefill: FarmerGroup[]): Promise<Schedule> {
  const start = periodStart(p)
  const { data, error } = await supabase
    .from('schedules')
    .insert({ saao_id: userId, start_date: start, month_label: MONTHS[p.month - 1], fortnight: p.fortnight, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  const created = data as Schedule
  const places = defaultPlaces(p, holidays, GROUP_COUNT)
  const rows = Array.from({ length: GROUP_COUNT }, (_, i) => {
    const fg = prefill[i]
    const g: GroupInfo = {
      ...emptyGroup(),
      group_name: fg?.group_name ?? '', address: fg?.address ?? '', mobile: fg?.mobile ?? '', farmer_group_id: fg?.id ?? null,
      visit_date: places[i]?.visit_date ?? null, slot: places[i]?.slot ?? null,
    }
    return rowOf(created.id, i + 1, g)
  })
  const r = await supabase.from('schedule_groups').insert(rows).select('group_no')
  if (r.error) throw r.error
  return created
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) throw error
}

export interface LoadedSchedule {
  schedule: Schedule
  owner: Profile | null
  groups: GroupMap
  notes: NoteMap
}

export async function loadSchedule(id: string): Promise<LoadedSchedule | null> {
  const { data: s, error } = await supabase.from('schedules').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!s) return null
  const schedule = s as Schedule
  const [g, n, o] = await Promise.all([
    supabase.from('schedule_groups').select('group_no,group_name,address,mobile,topics,visit_date,slot,farmer_group_id').eq('schedule_id', id),
    supabase.from('schedule_day_notes').select('note_date,advisory_note').eq('schedule_id', id),
    supabase.from('profiles').select('*').eq('id', schedule.saao_id).maybeSingle(),
  ])
  if (g.error) throw g.error
  if (n.error) throw n.error
  const groups: GroupMap = {}
  for (let i = 1; i <= GROUP_COUNT; i++) groups[i] = emptyGroup()
  for (const r of g.data ?? []) {
    const t = [...((r.topics as string[] | null) ?? [])]
    while (t.length < 5) t.push('')
    groups[r.group_no] = {
      group_name: r.group_name ?? '', address: r.address ?? '', mobile: r.mobile ?? '', topics: t.slice(0, 5),
      visit_date: r.visit_date ?? null, slot: (r.slot as 1 | 2 | null) ?? null, farmer_group_id: r.farmer_group_id ?? null,
    }
  }
  const notes: NoteMap = {}
  for (const r of n.data ?? []) if (r.note_date) notes[r.note_date] = r.advisory_note
  return { schedule, owner: (o.data as Profile | null) ?? null, groups, notes }
}

// গ্রুপের তথ্য সেভ; তারিখ বদলালে আগে পুরোনো জায়গা খালি করে নিতে হয় (একই তারিখ-সময়ে দুই গ্রুপ থাকতে পারে না)
export async function saveGroups(scheduleId: string, nums: number[], groups: GroupMap, clearPlacesFirst = false) {
  if (!nums.length) return
  if (clearPlacesFirst) {
    const cleared = nums.map((no) => ({ ...rowOf(scheduleId, no, groups[no] ?? emptyGroup()), visit_date: null, slot: null }))
    const c = await supabase.from('schedule_groups').upsert(cleared, { onConflict: 'schedule_id,group_no' })
    if (c.error) throw c.error
  }
  const rows = nums.map((no) => rowOf(scheduleId, no, groups[no] ?? emptyGroup()))
  const { error } = await supabase.from('schedule_groups').upsert(rows, { onConflict: 'schedule_id,group_no' })
  if (error) throw error
}

export async function saveNotes(scheduleId: string, dates: string[], notes: NoteMap) {
  if (!dates.length) return
  const rows = dates.map((d) => ({ schedule_id: scheduleId, note_date: d, advisory_note: notes[d] ?? '' }))
  const { error } = await supabase.from('schedule_day_notes').upsert(rows, { onConflict: 'schedule_id,note_date' })
  if (error) throw error
}

export async function changeStatus(id: string, from: Status[], to: Status, note?: string) {
  const patch: Record<string, unknown> = { status: to }
  if (note !== undefined) patch.approver_note = note
  const { data, error } = await supabase.from('schedules').update(patch).eq('id', id).in('status', from).select('*')
  if (error) throw error
  if (!data?.length) throw new Error('সূচিটি আর এই অবস্থায় নেই। পেজ রিফ্রেশ করে দেখুন।')
  return data[0] as Schedule
}

export async function listEvents(scheduleId: string): Promise<ScheduleEvent[]> {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('id,from_status,to_status,note,created_at,actor:profiles!actor_id(full_name,role)')
    .eq('schedule_id', scheduleId)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ScheduleEvent[]
}

// নিজের আগের সূচিতে লেখা বিষয় (সবচেয়ে বেশি ব্যবহৃত আগে)
export async function myPastTopics(userId: string, exceptScheduleId?: string): Promise<string[]> {
  const mine = await listMySchedules(userId)
  const ids = mine.map((s) => s.id).filter((x) => x !== exceptScheduleId)
  if (!ids.length) return []
  const { data } = await supabase.from('schedule_groups').select('topics').in('schedule_id', ids)
  const count = new Map<string, number>()
  for (const r of data ?? []) for (const t of (r.topics as string[] | null) ?? []) {
    const k = t.trim()
    if (k) count.set(k, (count.get(k) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 15)
}

export async function countFilled(scheduleId: string): Promise<number> {
  const { data, error } = await supabase.from('schedule_groups').select('group_name,topics,visit_date').eq('schedule_id', scheduleId)
  if (error) throw error
  return (data ?? []).filter((r) => String(r.group_name ?? '').trim() && r.visit_date && ((r.topics as string[] | null) ?? []).some((t) => t.trim())).length
}
