// পক্ষ (১-১৫ / ১৬-মাসের শেষ), দিনের ধরন আর গ্রুপ বসানোর হিসাব। এখানে কোনো ডেটাবেস নেই, শুধু তারিখের অঙ্ক।

export const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
export const WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'] // getDay() অনুযায়ী

const BN = '০১২৩৪৫৬৭৮৯'
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[Number(d)])
const p2 = (n: number) => String(n).padStart(2, '0')

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const toISO = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

// আজকের তারিখ (ডেমোতে একটি নির্দিষ্ট দিনে আটকে রাখা যায়)
let fixedToday: string | null = null
export const setTodayForDemo = (iso: string | null) => { fixedToday = iso }
export const todayISO = () => fixedToday ?? toISO(new Date())
export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const dow = (iso: string) => parseISO(iso).getDay()
export const fmtDate = (iso: string) => {
  const d = parseISO(iso)
  return bn(`${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`)
}
export const fmtDayMonth = (iso: string) => {
  const d = parseISO(iso)
  return `${bn(d.getDate())} ${MONTHS[d.getMonth()]}`
}

// ---- পক্ষ ----
export interface Period {
  year: number
  month: number // ১-১২
  fortnight: 1 | 2
}

export const periodStart = (p: Period) => `${p.year}-${p2(p.month)}-${p.fortnight === 1 ? '01' : '16'}`
export function periodEnd(p: Period): string {
  if (p.fortnight === 1) return `${p.year}-${p2(p.month)}-15`
  const last = new Date(p.year, p.month, 0).getDate()
  return `${p.year}-${p2(p.month)}-${p2(last)}`
}
export function periodOf(iso: string): Period {
  const d = parseISO(iso)
  return { year: d.getFullYear(), month: d.getMonth() + 1, fortnight: d.getDate() <= 15 ? 1 : 2 }
}
export function periodDates(p: Period): string[] {
  const out: string[] = []
  for (let d = periodStart(p); d <= periodEnd(p); d = addDays(d, 1)) out.push(d)
  return out
}
export const nextPeriod = (p: Period): Period =>
  p.fortnight === 1 ? { ...p, fortnight: 2 } : p.month === 12 ? { year: p.year + 1, month: 1, fortnight: 1 } : { year: p.year, month: p.month + 1, fortnight: 1 }
export const prevPeriod = (p: Period): Period =>
  p.fortnight === 2 ? { ...p, fortnight: 1 } : p.month === 1 ? { year: p.year - 1, month: 12, fortnight: 2 } : { year: p.year, month: p.month - 1, fortnight: 2 }
export const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month && a.fortnight === b.fortnight

// এখন যে পক্ষের সূচি তৈরি ও জমা দেওয়ার কথা: আজকের পরের পক্ষ
export const planningPeriod = (todayIso: string) => nextPeriod(periodOf(todayIso))

export const periodTitle = (p: Period) => `${MONTHS[p.month - 1]} ${bn(p.year)} · ${p.fortnight === 1 ? '১ম' : '২য়'} পক্ষ`
export function periodRange(p: Period) {
  const e = parseISO(periodEnd(p)).getDate()
  return `${bn(p.fortnight === 1 ? 1 : 16)}-${bn(e)} ${MONTHS[p.month - 1]}`
}

// পক্ষ শুরুর কত দিন আগে জমা দিতে হবে
export const deadlineFor = (p: Period, daysBefore: number) => addDays(periodStart(p), -daysBefore)
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)

// ---- দিনের ধরন ----
export type HolidayMap = Record<string, string> // তারিখ → ছুটির নাম
export type DayKind = 'meeting' | 'weekend' | 'sunday' | 'visit' | 'holiday'

export function dayKind(iso: string, holidays: HolidayMap): DayKind {
  if (holidays[iso]) return 'holiday'
  const w = dow(iso)
  if (w === 3) return 'meeting'
  if (w === 5 || w === 6) return 'weekend'
  if (w === 0) return 'sunday'
  return 'visit' // সোম, মঙ্গল, বৃহস্পতি
}

// গ্রুপ রাখা যায় এমন দিন: ভিজিটের দিন, আর দরকার হলে রবিবার
export const canHostGroups = (iso: string, holidays: HolidayMap) => {
  const k = dayKind(iso, holidays)
  return k === 'visit' || k === 'sunday'
}

export interface Place { visit_date: string; slot: 1 | 2 }

// ১২টি গ্রুপের জায়গা: আগে সব ভিজিটের দিন (সকাল, দুপুর), জায়গা কম পড়লে রবিবার যোগ হয়; সব শেষে তারিখের ক্রমে সাজানো
export function defaultPlaces(p: Period, holidays: HolidayMap, count = 12): Place[] {
  const dates = periodDates(p)
  const visit = dates.filter((d) => dayKind(d, holidays) === 'visit')
  const sundays = dates.filter((d) => dayKind(d, holidays) === 'sunday')
  const pick: string[] = [...visit]
  for (const s of sundays) {
    if (pick.length * 2 >= count) break
    pick.push(s)
  }
  pick.sort()
  const places: Place[] = []
  for (const d of pick) {
    places.push({ visit_date: d, slot: 1 }, { visit_date: d, slot: 2 })
  }
  return places.slice(0, count)
}

// কোনো গ্রুপের তারিখ ঠিক না থাকলে (ছুটি, বুধ/শুক্র/শনি, পক্ষের বাইরে) তা ধরা
export function badPlace(place: { visit_date: string | null }, p: Period, holidays: HolidayMap): string | null {
  const d = place.visit_date
  if (!d) return 'তারিখ ঠিক করা হয়নি'
  if (d < periodStart(p) || d > periodEnd(p)) return 'এই পক্ষের বাইরে'
  if (holidays[d]) return `সরকারি ছুটি (${holidays[d]})`
  const k = dayKind(d, holidays)
  if (k === 'meeting') return 'বুধবার সাপ্তাহিক সভা'
  if (k === 'weekend') return 'সাপ্তাহিক ছুটি'
  return null
}

// ফর্মের দুই পাতা: প্রথম ৭ দিন "১ম সপ্তাহ", বাকি দিন "২য় সপ্তাহ"
export function splitWeeks(p: Period): [string[], string[]] {
  const d = periodDates(p)
  return [d.slice(0, 7), d.slice(7)]
}
