// মাসের প্রিন্ট: একই এসএএও-র ১ম পক্ষ (১-১৫) ও ২য় পক্ষ (১৬-শেষ) দুই পাতায়
import { supabase } from './supabase'
import { holidayMap, listHolidays } from './catalog'
import { MONTHS, defaultPlaces, periodDates, periodEnd, periodStart } from './period'
import type { HolidayMap, Period } from './period'
import { GROUP_COUNT, emptyGroup, loadSchedule } from './schedules'
import type { GroupMap, NoteMap, Schedule } from './schedules'
import type { Profile } from '../types'

export interface PokkhoPage {
  period: Period
  label: string // "১ম পক্ষ" / "২য় পক্ষ"
  dates: string[]
  schedule: Schedule | null
  groups: GroupMap
  notes: NoteMap
}

export interface MonthData {
  year: number
  month: number
  monthName: string
  owner: Profile | null
  holidays: HolidayMap
  pages: [PokkhoPage, PokkhoPage]
}

// সূচি তৈরি হয়নি এমন পক্ষ: খালি ফর্ম, তবে গ্রুপের ঘরগুলো ভিজিটের দিনে বসানো (হাতে পূরণের জন্য)
export function blankGroups(p: Period, holidays: HolidayMap): GroupMap {
  const places = defaultPlaces(p, holidays, GROUP_COUNT)
  const g: GroupMap = {}
  for (let i = 1; i <= GROUP_COUNT; i++) {
    g[i] = { ...emptyGroup(), visit_date: places[i - 1]?.visit_date ?? null, slot: places[i - 1]?.slot ?? null }
  }
  return g
}

// সইয়ের নিচের লেখা:
// {নাম}
// উপসহকারী কৃষি কর্মকর্তা,
// {ব্লক} ব্লক, {উপজেলা}
// অতিরিক্ত দায়িত্বের ব্লকে: {ব্লক} ব্লক (অতিরিক্ত দায়িত্ব), {উপজেলা}
export function signerLines(owner: Profile | null, block?: { block_name?: string | null; extra_charge?: boolean } | null): string[] {
  if (!owner) return []
  const b = block?.block_name || owner.block_name
  const place = [b && `${b} ব্লক${block?.extra_charge ? ' (অতিরিক্ত দায়িত্ব)' : ''}`, owner.upazila].filter(Boolean).join(', ')
  return [owner.full_name, 'উপসহকারী কৃষি কর্মকর্তা,', place].filter(Boolean)
}

// ফর্মের উপরের বাঁ দিকের লেখা: {নাম} (SAAO), ব্লকের নামঃ {ব্লক}
export function sheetTitle(owner: Profile | null, block?: { block_name?: string | null; extra_charge?: boolean } | null): string {
  if (!owner) return 'উপসহকারী কৃষি কর্মকর্তাগণের পাক্ষিক ভ্রমণসূচী'
  const b = block?.block_name || owner.block_name
  return [`${owner.full_name} (SAAO)`, b && `ব্লকের নামঃ ${b}${block?.extra_charge ? ' (অতিরিক্ত দায়িত্ব)' : ''}`].filter(Boolean).join(', ')
}

// live: যে পক্ষটি এখন সম্পাদনা হচ্ছে তার সেভ না হওয়া সর্বশেষ তথ্য
export async function loadMonth(
  ownerId: string,
  year: number,
  month: number,
  live?: { schedule: Schedule; groups: GroupMap; notes: NoteMap },
): Promise<MonthData> {
  const periods: [Period, Period] = [{ year, month, fortnight: 1 }, { year, month, fortnight: 2 }]
  const [hol, own, sch] = await Promise.all([
    listHolidays(periodStart(periods[0]), periodEnd(periods[1])).catch(() => []),
    supabase.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
    supabase.from('schedules').select('id,start_date,block_name').eq('saao_id', ownerId).in('start_date', periods.map(periodStart)),
  ])
  const holidays = holidayMap(hol)
  // একই মাসে একাধিক ব্লকের সূচি থাকতে পারে: শুধু এই ব্লকেরগুলো
  const blk = live?.schedule.block_name
  const byStart = new Map(((sch.data ?? []) as { id: string; start_date: string; block_name?: string }[])
    .filter((s) => blk === undefined || (s.block_name ?? '') === blk)
    .map((s) => [s.start_date, s.id]))

  const pages = await Promise.all(periods.map(async (p, i): Promise<PokkhoPage> => {
    const base = { period: p, label: i === 0 ? '১ম পক্ষ' : '২য় পক্ষ', dates: periodDates(p) }
    if (live && live.schedule.start_date === periodStart(p)) {
      return { ...base, schedule: live.schedule, groups: live.groups, notes: live.notes }
    }
    const id = byStart.get(periodStart(p))
    const d = id ? await loadSchedule(id).catch(() => null) : null
    return { ...base, schedule: d?.schedule ?? null, groups: d?.groups ?? blankGroups(p, holidays), notes: d?.notes ?? {} }
  }))

  return {
    year, month, monthName: MONTHS[month - 1], owner: (own.data as Profile | null) ?? null,
    holidays, pages: pages as [PokkhoPage, PokkhoPage],
  }
}
