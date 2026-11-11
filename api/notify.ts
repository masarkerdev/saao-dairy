// সূচির অবস্থা বদলালে (মাস জমা, উপজেলায় পাঠানো, অনুমোদন, ফেরত) সংশ্লিষ্টদের ফোনে নোটিফিকেশন।
// অ্যাপ সিদ্ধান্তের পর এখানে জানায়; এখানে আসল ঘটনাটি (schedule_events) মিলিয়ে তবেই পাঠানো হয়।
import { admin, header, monthTitleOf, sendTo, siteOf } from './_lib.js'
import type { Payload, Req, Res } from './_lib.js'

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const db = admin()
    const token = header(req, 'authorization').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(token)
    const me = u?.user?.id
    if (!me) return res.status(401).json({ error: 'লগইন করা নেই' })
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as { schedule_id?: string; notice_id?: string }

    // নতুন নোটিশ: যিনি দিয়েছেন তিনিই জানাচ্ছেন কি না, আর ১০ মিনিটের মধ্যে কি না
    if (body.notice_id) {
      const { data: n } = await db.from('notices').select('id,title,body,audience,created_by,created_at').eq('id', body.notice_id).single()
      if (!n || n.created_by !== me || Date.now() - Date.parse(n.created_at) > 10 * 60 * 1000) return res.status(200).json({ sent: 0 })
      let q = db.from('profiles').select('id,role').eq('active', true)
      if (n.audience === 'saao') q = q.eq('role', 'saao')
      if (n.audience === 'officers') q = q.in('role', ['admin', 'coadmin'])
      const { data: people } = await q
      const text = String(n.body ?? '')
      const r = await sendTo(db, (people ?? []).map((x) => x.id).filter((x) => x !== me),
        { title: `নোটিশ: ${n.title}`, body: text.length > 140 ? `${text.slice(0, 140)}…` : text || 'নোটিশ বোর্ডে দেখুন', url: '/notices', tag: `notice-${n.id}` }, siteOf(req))
      return res.status(200).json({ sent: r.sent })
    }

    if (!body.schedule_id) return res.status(400).json({ error: 'schedule_id নেই' })

    // এই ইউজারের করা সর্বশেষ সিদ্ধান্ত (৫ মিনিটের মধ্যে)
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: ev } = await db.from('schedule_events').select('id,to_status,note,actor_id,created_at')
      .eq('schedule_id', body.schedule_id).eq('actor_id', me).gte('created_at', since)
      .order('id', { ascending: false }).limit(1).maybeSingle()
    if (!ev) return res.status(200).json({ sent: 0, reason: 'নতুন কোনো সিদ্ধান্ত নেই' })

    const { data: s } = await db.from('schedules').select('id,saao_id,start_date,block_name,extra_charge').eq('id', body.schedule_id).single()
    if (!s) return res.status(404).json({ error: 'সূচি নেই' })
    const [{ data: owner }, { data: actor }, { data: staff }] = await Promise.all([
      db.from('profiles').select('full_name,block_name').eq('id', s.saao_id).single(),
      db.from('profiles').select('full_name,designation').eq('id', me).single(),
      db.from('profiles').select('id,role').in('role', ['coadmin', 'admin']).eq('active', true),
    ])
    const month = monthTitleOf(s.start_date)
    const block = s.block_name ? `${s.block_name} ব্লক${s.extra_charge ? ' (অতিরিক্ত দায়িত্ব)' : ''}` : ''
    const who = actor ? `${actor.full_name}${actor.designation ? `, ${actor.designation}` : ''}` : ''
    const url = `/schedules/${s.id}`
    const tag = `${s.saao_id}-${s.start_date.slice(0, 7)}-${s.block_name}-${ev.to_status}`
    const coadmins = (staff ?? []).filter((x) => x.role === 'coadmin').map((x) => x.id)
    const admins = (staff ?? []).filter((x) => x.role === 'admin').map((x) => x.id)
    const site = siteOf(req)
    const jobs: [string[], Payload][] = []

    if (ev.to_status === 'submitted') {
      jobs.push([coadmins, { title: 'নতুন মাসিক সূচি জমা পড়েছে', body: `${owner?.full_name ?? ''}${block ? ` · ${block}` : ''} · ${month}। খুলে যাচাই করুন।`, url, tag }])
    } else if (ev.to_status === 'forwarded') {
      jobs.push([[s.saao_id], { title: 'সূচি উপজেলায় পাঠানো হয়েছে', body: `${month}-এর সূচি যাচাই করে উপজেলা কৃষি অফিসারের কাছে পাঠিয়েছেন ${who}${ev.note ? `। মন্তব্য: ${ev.note}` : ''}`, url, tag }])
      jobs.push([admins, { title: 'অনুমোদনের অপেক্ষায় নতুন সূচি', body: `${owner?.full_name ?? ''}${block ? ` · ${block}` : ''} · ${month}। যাচাই করেছেন ${who}।`, url, tag: `${tag}-admin` }])
    } else if (ev.to_status === 'approved') {
      jobs.push([[s.saao_id], { title: 'সূচি অনুমোদিত হয়েছে ✓', body: `${month}-এর সূচি অনুমোদন দিয়েছেন ${who}${ev.note ? `। মন্তব্য: ${ev.note}` : ''}`, url, tag }])
    } else if (ev.to_status === 'returned') {
      jobs.push([[s.saao_id], { title: 'সূচি সংশোধনের জন্য ফেরত', body: `${month}-এর সূচি ফেরত দিয়েছেন ${who}${ev.note ? `। মন্তব্য: ${ev.note}` : ''}`, url, tag }])
    }

    let sent = 0
    for (const [ids, p] of jobs) sent += (await sendTo(db, ids.filter((x) => x !== me), p, site)).sent
    return res.status(200).json({ sent })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
