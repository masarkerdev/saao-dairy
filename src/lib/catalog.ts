// উপজেলার সাধারণ তালিকা: সরকারি ছুটি, ব্লক/ইউনিয়ন, আলোচ্য বিষয়, সেটিং; আর এসএএও-র নিজের কৃষক গ্রুপ
import { supabase } from './supabase'
import { normalizeMobile } from './mobile'
import type { HolidayMap } from './period'

export interface Holiday { holiday_date: string; name: string }
export interface Location { id: number; kind: 'union' | 'block'; name: string; sort: number }
export interface Topic { id: number; topic: string; months: number[]; sort: number; active: boolean }
export interface FarmerGroup { id: string; saao_id: string; group_name: string; address: string; mobile: string; sort: number; active: boolean }

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw r.error
  return (r.data ?? ([] as unknown as T)) as T
}

// ---- সরকারি ছুটি ----
export async function listHolidays(from?: string, to?: string): Promise<Holiday[]> {
  let q = supabase.from('holidays').select('holiday_date,name').order('holiday_date')
  if (from) q = q.gte('holiday_date', from)
  if (to) q = q.lte('holiday_date', to)
  return must(await q) as Holiday[]
}
export const holidayMap = (list: Holiday[]): HolidayMap => Object.fromEntries(list.map((h) => [h.holiday_date, h.name]))
export async function addHoliday(date: string, name: string) {
  must(await supabase.from('holidays').insert({ holiday_date: date, name: name.trim() }).select('holiday_date'))
}
export async function deleteHoliday(date: string) {
  must(await supabase.from('holidays').delete().eq('holiday_date', date))
}

// ---- ব্লক ও ইউনিয়ন ----
export async function listLocations(): Promise<Location[]> {
  return must(await supabase.from('locations').select('*').order('sort').order('name')) as Location[]
}
export async function addLocation(kind: 'union' | 'block', name: string, sort: number) {
  must(await supabase.from('locations').insert({ kind, name: name.trim(), sort }).select('id'))
}
export async function deleteLocation(id: number) {
  must(await supabase.from('locations').delete().eq('id', id))
}

// ---- আলোচ্য বিষয় ----
export async function listTopics(): Promise<Topic[]> {
  return must(await supabase.from('topic_suggestions').select('*').order('sort')) as Topic[]
}
export async function addTopic(topic: string, months: number[], sort: number) {
  must(await supabase.from('topic_suggestions').insert({ topic: topic.trim(), months, sort }).select('id'))
}
export async function deleteTopic(id: number) {
  must(await supabase.from('topic_suggestions').delete().eq('id', id))
}
// এই মাসের বিষয় আগে, তারপর সারা বছরের
export function topicsForMonth(all: Topic[], month: number): string[] {
  const act = all.filter((t) => t.active)
  const seasonal = act.filter((t) => t.months.includes(month))
  const always = act.filter((t) => !t.months.length)
  return [...seasonal, ...always].map((t) => t.topic)
}

// ---- সেটিং ----
export async function getSubmitDaysBefore(): Promise<number> {
  const r = await supabase.from('app_settings').select('value').eq('key', 'submit_days_before').maybeSingle()
  const v = Number((r.data as { value?: unknown } | null)?.value)
  return Number.isFinite(v) && v >= 0 ? v : 2
}
export async function setSubmitDaysBefore(n: number) {
  must(await supabase.from('app_settings').update({ value: n }).eq('key', 'submit_days_before').select('key'))
}

// ---- আমার কৃষক গ্রুপ ----
export async function listFarmerGroups(saaoId: string): Promise<FarmerGroup[]> {
  return must(await supabase.from('farmer_groups').select('*').eq('saao_id', saaoId).order('sort').order('created_at')) as FarmerGroup[]
}
export async function saveFarmerGroup(g: Partial<FarmerGroup> & { saao_id: string; group_name: string }): Promise<FarmerGroup> {
  const row = { ...g, group_name: g.group_name.trim(), address: (g.address ?? '').trim(), mobile: normalizeMobile(g.mobile ?? '') }
  if (g.id) {
    const r = await supabase.from('farmer_groups').update(row).eq('id', g.id).select('*')
    const d = must(r) as FarmerGroup[]
    if (!d.length) throw new Error('গ্রুপটি সেভ করা যায়নি।')
    return d[0]
  }
  const d = must(await supabase.from('farmer_groups').insert(row).select('*')) as FarmerGroup[]
  return d[0]
}
export async function deleteFarmerGroup(id: string) {
  must(await supabase.from('farmer_groups').delete().eq('id', id))
}
