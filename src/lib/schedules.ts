import { supabase } from './supabase'
import type { Profile } from '../types'

export type Status = 'draft' | 'submitted' | 'approved' | 'returned'

export interface Schedule {
  id: string
  saao_id: string
  start_date: string // YYYY-MM-DD (বুধবার)
  month_label: string
  fortnight: 1 | 2
  status: Status
  approver_note: string | null
  submitted_at: string | null
  approved_at: string | null
}

export interface Entry { f: string; t: string }
export type EntryMap = Record<string, Entry> // key: `${group}-${line}`
export type NoteMap = Record<string, string> // key: `${week}-${day}`

export const STATUS_LABEL: Record<Status, string> = {
  draft: 'খসড়া',
  submitted: 'জমা দেওয়া হয়েছে',
  approved: 'অনুমোদিত',
  returned: 'ফেরত এসেছে',
}

const BN = '০১২৩৪৫৬৭৮৯'
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[Number(d)])

export const DAYS = ['বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার']
export const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const isWednesday = (iso: string) => !!iso && parseDate(iso).getDay() === 3
export const monthOf = (iso: string) => MONTHS[parseDate(iso).getMonth()]

export function nextWednesday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7))
  return toISO(d)
}

// সপ্তাহ (0/1) ও দিনের ক্রম (0=বুধ ... 6=মঙ্গল) অনুযায়ী তারিখ, বাংলা অঙ্কে
export function dateFor(startIso: string, week: number, dayIdx: number): string {
  const d = parseDate(startIso)
  d.setDate(d.getDate() + week * 7 + dayIdx)
  const p = (n: number) => String(n).padStart(2, '0')
  return bn(`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`)
}

export async function listMySchedules(userId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('saao_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Schedule[]
}

export async function createSchedule(userId: string, start: string, fortnight: 1 | 2): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({ saao_id: userId, start_date: start, month_label: monthOf(start), fortnight, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  return data as Schedule
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) throw error
}

export interface LoadedSchedule {
  schedule: Schedule
  owner: Profile | null
  entries: EntryMap
  notes: NoteMap
}

export async function loadSchedule(id: string): Promise<LoadedSchedule | null> {
  const { data: s, error } = await supabase.from('schedules').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!s) return null
  const schedule = s as Schedule

  const [e, n, o] = await Promise.all([
    supabase.from('schedule_entries').select('group_no,line_no,farmer_info,topic').eq('schedule_id', id),
    supabase.from('schedule_day_notes').select('week_no,day_index,advisory_note').eq('schedule_id', id),
    supabase.from('profiles').select('*').eq('id', schedule.saao_id).maybeSingle(),
  ])
  if (e.error) throw e.error
  if (n.error) throw n.error

  const entries: EntryMap = {}
  for (const r of e.data ?? []) entries[`${r.group_no}-${r.line_no}`] = { f: r.farmer_info, t: r.topic }
  const notes: NoteMap = {}
  for (const r of n.data ?? []) notes[`${r.week_no}-${r.day_index}`] = r.advisory_note

  return { schedule, owner: (o.data as Profile | null) ?? null, entries, notes }
}

export async function saveEntries(scheduleId: string, keys: string[], entries: EntryMap) {
  if (!keys.length) return
  const rows = keys.map((k) => {
    const [g, l] = k.split('-').map(Number)
    return {
      schedule_id: scheduleId,
      group_no: g,
      line_no: l,
      farmer_info: entries[k]?.f ?? '',
      topic: entries[k]?.t ?? '',
    }
  })
  const { error } = await supabase.from('schedule_entries').upsert(rows, { onConflict: 'schedule_id,group_no,line_no' })
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

export async function submitSchedule(id: string) {
  const { error } = await supabase
    .from('schedules')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
