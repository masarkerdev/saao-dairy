// প্রতিদিন সকালে (Vercel Cron, vercel.json-এ সময়) ফোনে মনে করিয়ে দেওয়া:
//  • এসএএও: পরের মাসের সূচি জমার শেষ তারিখের ৩ দিন আগে থেকে, যতক্ষণ জমা না পড়ে (প্রতিটি ব্লক)
//  • কো-এডমিন: যাচাইয়ের অপেক্ষায় কয়টি মাসিক সূচি; এডমিন: অনুমোদনের অপেক্ষায় কয়টি
import { addDays, admin, bn, daysBetween, env, fmtDayMonth, header, monthTitleOf, nextMonthStart, sendTo, siteOf, todayDhaka } from './_lib.js'
import type { Req, Res } from './_lib.js'

const REMIND_DAYS = 3

export default async function handler(req: Req, res: Res) {
  const secret = env('CRON_SECRET')
  if (!secret || header(req, 'authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'অনুমতি নেই' })
  try {
    const db = admin()
    const site = siteOf(req)
    const today = todayDhaka()
    const start = nextMonthStart(today)
    const end = `${start.slice(0, 8)}16`
    const { data: st } = await db.from('app_settings').select('value').eq('key', 'submit_days_before').maybeSingle()
    const daysBefore = Number.isFinite(Number(st?.value)) ? Number(st?.value) : 2
    const deadline = addDays(start, -daysBefore)
    const left = daysBetween(today, deadline)
    const month = monthTitleOf(start)
    let sent = 0

    // এসএএও: জমা বাকি
    if (left <= REMIND_DAYS) {
      const [{ data: saaos }, { data: sch }, { data: charges }] = await Promise.all([
        db.from('profiles').select('id,full_name,block_name').eq('role', 'saao').eq('active', true),
        db.from('schedules').select('saao_id,block_name,start_date,status').in('start_date', [start, end]),
        db.from('block_charges').select('saao_id,block_name,from_date,to_date'),
      ])
      for (const p of saaos ?? []) {
        const blocks = [p.block_name ?? '', ...(charges ?? [])
          .filter((c) => c.saao_id === p.id && c.block_name !== p.block_name && (!c.from_date || c.from_date <= addDays(end, 15)) && (!c.to_date || c.to_date >= start))
          .map((c) => c.block_name as string)]
        const due = blocks.filter((b) => {
          const mine = (sch ?? []).filter((s) => s.saao_id === p.id && (s.block_name ?? '') === b)
          return mine.length < 2 || mine.some((s) => s.status === 'draft' || s.status === 'returned')
        })
        if (!due.length) continue
        const when = left < 0 ? `শেষ সময় ছিল ${fmtDayMonth(deadline)}, ${bn(-left)} দিন পার হয়েছে` : left === 0 ? 'আজই শেষ দিন' : `শেষ সময় ${fmtDayMonth(deadline)}, ${bn(left)} দিন বাকি`
        const r = await sendTo(db, [p.id], {
          title: `${month}-এর সূচি জমা দিন`,
          body: `${due.map((b) => (b ? `${b} ব্লক` : 'আপনার ব্লক')).join(', ')}: মাসিক সূচি জমা পড়েনি। ${when}।`,
          url: '/', tag: `due-${start}`,
        }, site)
        sent += r.sent
      }
    }

    // কর্মকর্তা: সিদ্ধান্ত বাকি (মাস হিসেবে গোনা)
    const [{ data: staff }, { data: pend }] = await Promise.all([
      db.from('profiles').select('id,role').in('role', ['coadmin', 'admin']).eq('active', true),
      db.from('schedules').select('saao_id,block_name,start_date,status').in('status', ['submitted', 'forwarded']),
    ])
    const months = (st: string) => new Set((pend ?? []).filter((s) => s.status === st).map((s) => `${s.saao_id}|${s.block_name}|${s.start_date.slice(0, 7)}`)).size
    const nSub = months('submitted'), nFwd = months('forwarded')
    if (nSub) sent += (await sendTo(db, (staff ?? []).filter((x) => x.role === 'coadmin').map((x) => x.id),
      { title: 'যাচাইয়ের অপেক্ষায়', body: `${bn(nSub)}টি মাসিক সূচি আপনার যাচাইয়ের অপেক্ষায় আছে।`, url: '/review', tag: 'pending-review' }, site)).sent
    if (nFwd) sent += (await sendTo(db, (staff ?? []).filter((x) => x.role === 'admin').map((x) => x.id),
      { title: 'অনুমোদনের অপেক্ষায়', body: `${bn(nFwd)}টি মাসিক সূচি আপনার অনুমোদনের অপেক্ষায় আছে।`, url: '/review', tag: 'pending-approve' }, site)).sent

    return res.status(200).json({ today, month: start, left, sent })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
