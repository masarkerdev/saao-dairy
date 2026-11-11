// ডেমোর নমুনা তথ্য। ছুটির তারিখটি শুধু দেখানোর জন্য, আসল সরকারি ছুটি নয়।
import { defaultPlaces } from '../lib/period'
import type { HolidayMap, Period } from '../lib/period'

type Row = Record<string, any>

const TOPICS: [string, number[]][] = [
  ['আমন ধানে মাজরা পোকা ও বাদামী গাছফড়িং দমন', [8, 9, 10]], ['ধানক্ষেতে পার্চিং ও আলোক ফাঁদ', [8, 9, 10]],
  ['আমন ধান কাটা, মাড়াই ও সংরক্ষণ', [10, 11, 12]], ['শীতকালীন সবজির চারা উৎপাদন', [9, 10, 11]],
  ['আলুর জমি তৈরি ও বীজ শোধন', [10, 11]], ['আলুর নাবি ধসা রোগ দমন', [12, 1, 2]], ['সরিষার উন্নত জাত ও বপন সময়', [10, 11]],
  ['ডাল ও তেল ফসল চাষ', [10, 11, 12]], ['গম বপন ও বীজ শোধন', [11, 12]], ['ভুট্টা চাষ ও পরিচর্যা', [11, 12, 1]],
  ['বোরো বীজতলা তৈরি ও শীতে চারা রক্ষা', [11, 12, 1]], ['বোরো ধানে সুষম সার ও সেচ ব্যবস্থাপনা', [1, 2, 3, 4]],
  ['বোরো ধানে ব্লাস্ট রোগ দমন', [2, 3, 4]], ['আম-লিচুর মুকুল পরিচর্যা ও ফল ঝরা রোধ', [1, 2, 3]], ['আউশ ধানের চাষ', [3, 4, 5]],
  ['পাটের জমি তৈরি ও বপন', [3, 4, 5]], ['ফল বাগান পরিচর্যা ও কলম তৈরি', [5, 6, 7, 8]], ['আমন বীজতলা তৈরি', [6, 7]],
  ['আমন ধান রোপণ ও আগাছা দমন', [7, 8]], ['ইঁদুর দমন', [9, 10, 11]], ['মাটি পরীক্ষা ও সুষম সার প্রয়োগ', []],
  ['সবজিতে ফেরোমন ফাঁদ স্থাপন', []], ['ভার্মিকম্পোস্ট তৈরি ও ব্যবহার', []], ['আইপিএম ও জৈব বালাইনাশক', []],
  ['বালাইনাশকের নিরাপদ ব্যবহার', []], ['বসতবাড়ির আঙিনায় সবজি চাষ', []], ['কৃষি প্রণোদনা কর্মসূচি', []],
]
const UNIONS = ['বাগোয়ান', 'বিনাজুরী', 'চিকদাইর', 'ডাবুয়া', 'গহিরা', 'হলদিয়া', 'কদলপুর', 'নোয়াপাড়া', 'নোয়াজিশপুর', 'পাহাড়তলী', 'পশ্চিম গুজরা', 'পূর্ব গুজরা', 'রাউজান', 'উরকিরচর', 'রাউজান পৌরসভা']
const BLOCKS = ['নোয়াপাড়া', 'গহিরা', 'পাহাড়তলী', 'বিনাজুরী', 'হলদিয়া']

const VILLAGES = ['নোয়াপাড়া', 'পশ্চিম গুজরা', 'হলদিয়া', 'চিকদাইর', 'ডাবুয়া', 'গহিরা', 'বিনাজুরী', 'কদলপুর', 'বাগোয়ান', 'উরকিরচর', 'নোয়াজিশপুর', 'পাহাড়তলী', 'পূর্ব গুজরা', 'রাউজান']
const PRESIDENTS = ['মোঃ আবুল কালাম', 'রফিকুল ইসলাম', 'নুরুল আলম', 'শাহনাজ বেগম', 'জসিম উদ্দিন', 'আবদুর রহমান', 'মনোয়ারা খাতুন', 'সাইফুল ইসলাম', 'বিপ্লব বড়ুয়া', 'কামরুন নাহার']
const KINDS = ['কৃষক গ্রুপ', 'আইপিএম ক্লাব', 'সিআইজি (ধান)', 'মহিলা কৃষক দল', 'সবজি চাষি দল']
const SEASON = ['আমন ধানে মাজরা পোকা ও বাদামী গাছফড়িং দমন', 'ধানক্ষেতে পার্চিং ও আলোক ফাঁদ', 'আমন ধান কাটা, মাড়াই ও সংরক্ষণ', 'শীতকালীন সবজির চারা উৎপাদন', 'আলুর জমি তৈরি ও বীজ শোধন', 'সরিষার উন্নত জাত ও বপন সময়', 'ইঁদুর দমন', 'মাটি পরীক্ষা ও সুষম সার প্রয়োগ', 'সবজিতে ফেরোমন ফাঁদ স্থাপন']
const pick = <T,>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length]

export const DEMO_HOLIDAY = '2026-11-12'
const OCT1: Period = { year: 2026, month: 10, fortnight: 1 }
const OCT2: Period = { year: 2026, month: 10, fortnight: 2 }
const NOV1: Period = { year: 2026, month: 11, fortnight: 1 }
const NOV2: Period = { year: 2026, month: 11, fortnight: 2 }

function farmerGroups(saao: string, offset: number, n: number): Row[] {
  return Array.from({ length: n }, (_, i) => {
    const v = pick(VILLAGES, i + offset)
    return {
      id: `fg_${saao}_${i + 1}`, saao_id: saao, group_name: `${v} ${pick(KINDS, i + offset)}`,
      president: pick(PRESIDENTS, i + offset), village: v, union_name: UNIONS.includes(v) ? v : 'রাউজান', address: `গ্রাম: ${v}, ইউনিয়ন: ${UNIONS.includes(v) ? v : 'রাউজান'}`,
      mobile: `01${7 + (i % 3)}${String(20000000 + (i + 1) * 734521 + offset * 1117).slice(0, 8)}`, sort: i + 1, active: i < 12,
      created_at: '2026-09-01T04:00:00.000Z',
    }
  })
}

// fgs থেকে ১২টি গ্রুপ, জায়গা holidays মেনে; topicsFor(i) = কয়টি বিষয়
function scheduleGroups(sid: string, fgs: Row[], p: Period, holidays: HolidayMap, topicsFor: (i: number) => number, shift: number): Row[] {
  const places = defaultPlaces(p, holidays)
  return Array.from({ length: 12 }, (_, i) => {
    const fg = fgs[i]
    const topics = ['', '', '', '', '']
    for (let k = 0; k < topicsFor(i); k++) topics[k] = pick(SEASON, i * 2 + k + shift)
    return {
      schedule_id: sid, group_no: i + 1, group_name: fg.group_name, president: fg.president, address: fg.address, mobile: fg.mobile, farmer_group_id: fg.id,
      topics, visit_date: places[i]?.visit_date ?? null, slot: places[i]?.slot ?? null,
    }
  })
}

const P = (id: string, full_name: string, role: string, extra: Row = {}): Row => ({
  id, full_name, role, upazila: 'রাউজান', block_name: null, union_name: null, mobile: null,
  email: `${id.slice(2)}@demo.bd`, active: true, created_at: '2026-09-01T04:00:00.000Z', designation: 'উপসহকারী কৃষি কর্মকর্তা', ...extra,
})

const S = (id: string, saao_id: string, start_date: string, fortnight: number, status: string, extra: Row = {}): Row => ({
  id, saao_id, start_date, month_label: 'অক্টোবর', fortnight, status, approver_note: null, submitted_at: null, forwarded_by: null,
  forwarded_at: null, approved_by: null, approved_at: null, returned_by: null, returned_at: null,
  created_at: '2026-09-25T03:00:00.000Z', updated_at: '2026-09-25T03:00:00.000Z', ...extra,
})

let eid = 0
const E = (schedule_id: string, actor_id: string, from_status: string, to_status: string, created_at: string, note: string | null = null) =>
  ({ id: ++eid, schedule_id, actor_id, from_status, to_status, note, created_at })

export function seed(): Record<string, Row[]> {
  eid = 0
  const hol: HolidayMap = { [DEMO_HOLIDAY]: 'নমুনা সরকারি ছুটি' }

  const profiles = [
    P('u_uao', 'মোঃ আবদুল করিম', 'admin', { mobile: '01711000001', designation: 'উপজেলা কৃষি অফিসার' }),
    P('u_aao', 'মাহফুজ আহমেদ সরকার', 'coadmin', { mobile: '01711000002', designation: 'অতিরিক্ত কৃষি অফিসার' }),
    P('u_aeo', 'নাসরিন আক্তার', 'coadmin', { mobile: '01711000003', designation: 'উপসহকারী কৃষি কর্মকর্তা', block_name: 'এয়াছিন নগর' }), // ইচ্ছে করে ভুল: ডেভেলপার ঠিক করবেন
    P('u_rahim', 'মোঃ রহিম উদ্দিন', 'saao', { block_name: 'নোয়াপাড়া', union_name: 'নোয়াপাড়া', mobile: '01815123456' }),
    P('u_sumi', 'সুমি দাশ', 'saao', { block_name: 'গহিরা', union_name: 'গহিরা', mobile: '01819234567' }),
    P('u_kamal', 'কামাল হোসেন', 'saao', { block_name: 'পাহাড়তলী', union_name: 'পাহাড়তলী', mobile: '01712345678' }),
    P('u_ayesha', 'আয়েশা সিদ্দিকা', 'saao', { block_name: 'হলদিয়া', union_name: 'হলদিয়া', mobile: '01718765432' }),
    P('u_dev', 'ডেভেলপার', 'developer', { designation: null }),
    P('u_newaeo', 'শাহানা পারভীন', 'saao', { mobile: '01711000009', designation: 'কৃষি সম্প্রসারণ কর্মকর্তা', active: false, created_at: '2026-10-12T05:10:00.000Z' }),
    P('u_tanvir', 'তানভীর হাসান', 'saao', { block_name: 'বিনাজুরী', union_name: 'বিনাজুরী', mobile: '01913456789', active: false, created_at: '2026-10-11T08:20:00.000Z' }),
  ]

  const fgRahim = farmerGroups('u_rahim', 0, 14)
  const fgSumi = farmerGroups('u_sumi', 5, 12)
  const fgKamal = farmerGroups('u_kamal', 9, 12)

  // অক্টোবর: সবার পুরো মাস অনুমোদিত। নভেম্বর (পরের মাস): রহিম খসড়া, সুমি জমা দিয়েছেন, কামাল উপজেলায়, আয়েশা তৈরি করেননি
  const approved = (by: string, fwd: string) => ({
    submitted_at: '2026-09-27T05:10:00.000Z', forwarded_by: fwd, forwarded_at: '2026-09-28T06:00:00.000Z',
    approved_by: by, approved_at: '2026-09-29T09:30:00.000Z',
  })
  const schedules = [
    S('s_rahim_o1', 'u_rahim', '2026-10-01', 1, 'approved', approved('u_uao', 'u_aao')),
    S('s_rahim_o2', 'u_rahim', '2026-10-16', 2, 'approved', approved('u_uao', 'u_aao')),
    S('s_sumi_o1', 'u_sumi', '2026-10-01', 1, 'approved', approved('u_uao', 'u_aeo')),
    S('s_sumi_o2', 'u_sumi', '2026-10-16', 2, 'approved', approved('u_uao', 'u_aeo')),
    S('s_kamal_o1', 'u_kamal', '2026-10-01', 1, 'approved', approved('u_uao', 'u_aao')),
    S('s_kamal_o2', 'u_kamal', '2026-10-16', 2, 'approved', approved('u_uao', 'u_aao')),
    // ছুটি তোলার আগে তৈরি: কয়েকটি গ্রুপ পড়েছে ১২ নভেম্বর (নমুনা ছুটি), "আবার সাজান" দেখানোর জন্য
    S('s_rahim_n1', 'u_rahim', '2026-11-01', 1, 'draft', { month_label: 'নভেম্বর', created_at: '2026-10-20T03:00:00.000Z' }),
    S('s_rahim_n2', 'u_rahim', '2026-11-16', 2, 'draft', { month_label: 'নভেম্বর', created_at: '2026-10-20T03:00:00.000Z' }),
    S('s_sumi_n1', 'u_sumi', '2026-11-01', 1, 'submitted', { month_label: 'নভেম্বর', submitted_at: '2026-10-26T10:45:00.000Z' }),
    S('s_sumi_n2', 'u_sumi', '2026-11-16', 2, 'submitted', { month_label: 'নভেম্বর', submitted_at: '2026-10-26T10:45:00.000Z' }),
    S('s_kamal_n1', 'u_kamal', '2026-11-01', 1, 'forwarded', {
      month_label: 'নভেম্বর', submitted_at: '2026-10-25T07:00:00.000Z', forwarded_by: 'u_aeo', forwarded_at: '2026-10-26T04:15:00.000Z', approver_note: 'সব গ্রুপের তথ্য ঠিক আছে।',
    }),
    S('s_kamal_n2', 'u_kamal', '2026-11-16', 2, 'forwarded', {
      month_label: 'নভেম্বর', submitted_at: '2026-10-25T07:00:00.000Z', forwarded_by: 'u_aeo', forwarded_at: '2026-10-26T04:15:00.000Z', approver_note: 'সব গ্রুপের তথ্য ঠিক আছে।',
    }),
  ]

  const second = (fgs: Row[]) => fgs.length > 12 ? [...fgs.slice(12), ...fgs].slice(0, 12) : fgs
  const schedule_groups = [
    ...scheduleGroups('s_rahim_o1', fgRahim, OCT1, {}, () => 3, 0),
    ...scheduleGroups('s_rahim_o2', second(fgRahim), OCT2, {}, () => 3, 2),
    ...scheduleGroups('s_sumi_o1', fgSumi, OCT1, {}, () => 3, 1),
    ...scheduleGroups('s_sumi_o2', fgSumi, OCT2, {}, () => 2, 5),
    ...scheduleGroups('s_kamal_o1', fgKamal, OCT1, {}, () => 3, 4),
    ...scheduleGroups('s_kamal_o2', fgKamal, OCT2, {}, () => 2, 6),
    ...scheduleGroups('s_rahim_n1', fgRahim, NOV1, {}, (i) => (i < 9 ? 2 : 0), 3),
    ...scheduleGroups('s_rahim_n2', second(fgRahim), NOV2, {}, (i) => (i < 5 ? 2 : 0), 7),
    ...scheduleGroups('s_sumi_n1', fgSumi, NOV1, hol, (i) => 2 + (i % 3), 1),
    ...scheduleGroups('s_sumi_n2', fgSumi, NOV2, hol, (i) => 2 + (i % 2), 8),
    ...scheduleGroups('s_kamal_n1', fgKamal, NOV1, hol, (i) => 3 + (i % 2), 4),
    ...scheduleGroups('s_kamal_n2', fgKamal, NOV2, hol, () => 3, 9),
  ]

  const schedule_day_notes = [
    { schedule_id: 's_sumi_n1', note_date: '2026-11-02', advisory_note: 'মাটি পরীক্ষার নমুনা গ্রহণ' },
    { schedule_id: 's_kamal_n2', note_date: '2026-11-19', advisory_note: 'বালাইনাশক নিরাপদ ব্যবহারে পরামর্শ' },
  ]

  const flow = (ids: string[], who: string, fwd: string, appr: string | null, sub: string, fw: string, ap: string | null, note: string | null = null) =>
    ids.flatMap((id) => [
      E(id, who, 'draft', 'submitted', sub),
      E(id, fwd, 'submitted', 'forwarded', fw, note),
      ...(appr && ap ? [E(id, appr, 'forwarded', 'approved', ap)] : []),
    ])
  const schedule_events = [
    ...flow(['s_rahim_o1', 's_rahim_o2'], 'u_rahim', 'u_aao', 'u_uao', '2026-09-27T05:10:00.000Z', '2026-09-28T06:00:00.000Z', '2026-09-29T09:30:00.000Z'),
    ...flow(['s_sumi_o1', 's_sumi_o2'], 'u_sumi', 'u_aeo', 'u_uao', '2026-09-27T05:10:00.000Z', '2026-09-28T06:00:00.000Z', '2026-09-29T09:30:00.000Z'),
    ...flow(['s_kamal_o1', 's_kamal_o2'], 'u_kamal', 'u_aao', 'u_uao', '2026-09-27T05:10:00.000Z', '2026-09-28T06:00:00.000Z', '2026-09-29T09:30:00.000Z'),
    E('s_sumi_n1', 'u_sumi', 'draft', 'submitted', '2026-10-26T10:45:00.000Z'),
    E('s_sumi_n2', 'u_sumi', 'draft', 'submitted', '2026-10-26T10:45:00.000Z'),
    ...flow(['s_kamal_n1', 's_kamal_n2'], 'u_kamal', 'u_aeo', null, '2026-10-25T07:00:00.000Z', '2026-10-26T04:15:00.000Z', null, 'সব গ্রুপের তথ্য ঠিক আছে।'),
  ]

  // ব্লক: সূচি ও গ্রুপ নিজ ব্লকের; রহিমকে বিনাজুরী ব্লকের অতিরিক্ত দায়িত্ব (sql/09)
  const blockOf = (id: string) => (profiles.find((p) => p.id === id)?.block_name as string | null) ?? ''
  for (const s of schedules) Object.assign(s, { block_name: blockOf(s.saao_id), extra_charge: false })
  const fgExtra = farmerGroups('u_rahim', 6, 8).map((g, i) => ({ ...g, id: `fg_u_rahim_x${i + 1}`, block_name: 'বিনাজুরী', active: true }))
  const withBlock = (g: Row, b: string) => ({ ...g, block_name: b, address: `${g.address}, ব্লক: ${b}` })
  const farmer_groups = [...fgRahim, ...fgSumi, ...fgKamal].map((g) => withBlock(g, blockOf(g.saao_id))).concat(fgExtra.map((g) => withBlock(g, 'বিনাজুরী')))
  const block_charges = [
    { id: 'bc_1', saao_id: 'u_rahim', block_name: 'বিনাজুরী', union_name: null, from_date: '2026-10-01', to_date: null, created_by: 'u_aao', created_at: '2026-09-30T04:00:00.000Z' },
  ]

  return {
    profiles, schedules, schedule_groups, schedule_day_notes, schedule_events, schedule_entries: [],
    farmer_groups, block_charges, reminder_seen: [],
    notices: [
      { id: 'n_1', title: 'নভেম্বরের মাসিক সূচি ২৯ অক্টোবরের মধ্যে জমা দিন', body: 'আমন কাটা ও রবি মৌসুমের প্রস্তুতি বিষয়ে প্রতিটি গ্রুপে আলোচনা রাখবেন। আলুর বীজ শোধন ও সরিষার উন্নত জাত বিষয়ে বিশেষ জোর দিন।', audience: 'all', pinned: true, expires_on: '2026-11-30', created_by: 'u_uao', created_at: '2026-10-24T05:00:00.000Z', updated_at: '2026-10-24T05:00:00.000Z' },
      { id: 'n_2', title: 'কৃষক মাঠ দিবসের প্রস্তুতি সভা', body: 'বৃহস্পতিবার সকাল ১০টায় উপজেলা কৃষি অফিসে সব উপসহকারী কৃষি কর্মকর্তার উপস্থিতি কাম্য।', audience: 'saao', pinned: false, expires_on: null, created_by: 'u_aao', created_at: '2026-10-26T08:30:00.000Z', updated_at: '2026-10-26T08:30:00.000Z' },
    ],
    holidays: [{ holiday_date: DEMO_HOLIDAY, name: 'নমুনা সরকারি ছুটি', created_at: '2026-10-24T04:00:00.000Z' }],
    topic_suggestions: TOPICS.map(([topic, months], i) => ({ id: i + 1, topic, months, sort: i + 1, active: true })),
    locations: [
      ...UNIONS.map((name, i) => ({ id: i + 1, kind: 'union', name, sort: i + 1 })),
      ...BLOCKS.map((name, i) => ({ id: 100 + i, kind: 'block', name, sort: i + 1 })),
    ],
    app_settings: [{ key: 'submit_days_before', value: 2 }],
  }
}
