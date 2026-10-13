import { supabase } from './supabase'
import type { Profile } from '../types'

export type Status = 'draft' | 'submitted' | 'forwarded' | 'approved' | 'returned'

export interface Schedule {
  id: string
  saao_id: string
  start_date: string // YYYY-MM-DD (বুধবার)
  month_label: string
  fortnight: 1 | 2
  status: Status
  approver_note: string | null // সর্বশেষ সিদ্ধান্তের মন্তব্য
  submitted_at: string | null
  forwarded_at: string | null
  approved_at: string | null
  returned_at: string | null
}

// একটি কৃষক গ্রুপের তথ্য (ছবির ফর্মের এক ঘর + পাশের ৫টি আলোচ্য বিষয়)
export interface GroupInfo {
  group_name: string
  address: string
  mobile: string
  topics: string[] // ঠিক ৫টি
}
export type GroupMap = Record<number, GroupInfo> // key: গ্রুপ নং ১-১২
export type NoteMap = Record<string, string> // key: `${week}-${day}` (৩.০০-৫.০০ ঘর)

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

const BN = '০১২৩৪৫৬৭৮৯'
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[Number(d)])
export const g2 = (n: number) => bn(String(n).padStart(2, '0'))

export const DAYS = ['বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার']
export const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']

// ফর্মের স্থির কাঠামো: কোন বারে কোন দুটি গ্রুপ (সপ্তাহ অনুযায়ী +৬)
export const GROUP_DAYS: { day: number; first: number }[] = [
  { day: 1, first: 1 }, // বৃহস্পতিবার: গ্রুপ ১, ২
  { day: 5, first: 3 }, // সোমবার: গ্রুপ ৩, ৪
  { day: 6, first: 5 }, // মঙ্গলবার: গ্রুপ ৫, ৬
]

export const emptyGroup = (): GroupInfo => ({ group_name: '', address: '', mobile: '', topics: ['', '', '', '', ''] })

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const fmtDate = (d: Date) => bn(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
export const fmtTs = (iso: string) => {
  const d = new Date(iso)
  return `${fmtDate(d)}, ${bn(String(d.getHours()).padStart(2, '0'))}:${bn(String(d.getMinutes()).padStart(2, '0'))}`
}

export const isWednesday = (iso: string) => !!iso && parseDate(iso).getDay() === 3
export const monthOf = (iso: string) => MONTHS[parseDate(iso).getMonth()]

export function nextWednesday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7))
  return toISO(d)
}

export function dateFor(startIso: string, week: number, dayIdx: number): string {
  const d = parseDate(startIso)
  d.setDate(d.getDate() + week * 7 + dayIdx)
  return fmtDate(d)
}

export const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string' && (e as { message: string }).message
    ? (e as { message: string }).message
    : fallback

export async function listMySchedules(userId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('saao_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Schedule[]
}

export async function createSchedule(userId: string, start: string, fortnight: 1 | 2, copyGroups: boolean): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({ saao_id: userId, start_date: start, month_label: monthOf(start), fortnight, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  const created = data as Schedule

  if (copyGroups) {
    // সবচেয়ে সাম্প্রতিক আগের সূচি থেকে গ্রুপের নাম-ঠিকানা-মোবাইল কপি (আলোচ্য বিষয় নয়)
    const { data: prev } = await supabase
      .from('schedules')
      .select('id')
      .eq('saao_id', userId)
      .neq('id', created.id)
      .order('start_date', { ascending: false })
      .limit(1)
    const prevId = prev?.[0]?.id
    if (prevId) {
      const { data: groups } = await supabase
        .from('schedule_groups')
        .select('group_no,group_name,address,mobile')
        .eq('schedule_id', prevId)
      const rows = (groups ?? []).map((g) => ({ ...g, schedule_id: created.id, topics: ['', '', '', '', ''] }))
      if (rows.length) await supabase.from('schedule_groups').insert(rows)
    }
  }
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
    supabase.from('schedule_groups').select('group_no,group_name,address,mobile,topics').eq('schedule_id', id),
    supabase.from('schedule_day_notes').select('week_no,day_index,advisory_note').eq('schedule_id', id),
    supabase.from('profiles').select('*').eq('id', schedule.saao_id).maybeSingle(),
  ])
  if (g.error) throw g.error
  if (n.error) throw n.error

  const groups: GroupMap = {}
  for (const r of g.data ?? []) {
    const t = [...((r.topics as string[] | null) ?? [])]
    while (t.length < 5) t.push('')
    groups[r.group_no] = { group_name: r.group_name, address: r.address, mobile: r.mobile, topics: t.slice(0, 5) }
  }
  const notes: NoteMap = {}
  for (const r of n.data ?? []) notes[`${r.week_no}-${r.day_index}`] = r.advisory_note

  return { schedule, owner: (o.data as Profile | null) ?? null, groups, notes }
}

export async function saveGroups(scheduleId: string, nums: number[], groups: GroupMap) {
  if (!nums.length) return
  const rows = nums.map((no) => ({ schedule_id: scheduleId, group_no: no, ...(groups[no] ?? emptyGroup()) }))
  const { error } = await supabase.from('schedule_groups').upsert(rows, { onConflict: 'schedule_id,group_no' })
  if (error) throw error
}

export async function saveNotes(scheduleId: string, keys: string[], notes: NoteMap) {
  if (!keys.length) return
  const rows = keys.map((k) => {
    const [w, d] = k.split('-').map(Number)
    return { schedule_id: scheduleId, week_no: w, day_index: d, advisory_note: notes[k] ?? '' }
  })
  const { error } = await supabase.from('schedule_day_notes').upsert(rows, { onConflict: 'schedule_id,week_no,day_index' })
  if (error) throw error
}

// অবস্থা বদল: শুধু প্রত্যাশিত অবস্থায় থাকলে বদলায় (দুজন একসাথে চাপলে দ্বিতীয়জন বার্তা পান)
export async function changeStatus(id: string, from: Status[], to: Status, note?: string) {
  const patch: Record<string, unknown> = { status: to }
  if (note !== undefined) patch.approver_note = note
  const { data, error } = await supabase.from('schedules').update(patch).eq('id', id).in('status', from).select('*')
  if (error) throw error
  if (!data?.length) throw new Error('সূচিটি আর এই অবস্থায় নেই — পেজ রিফ্রেশ করে দেখুন।')
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
