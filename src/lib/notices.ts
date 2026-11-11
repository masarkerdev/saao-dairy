// নোটিশ বোর্ড (sql/14_notices.sql)
import { supabase } from './supabase'
import { todayISO } from './period'

export type Audience = 'all' | 'saao' | 'officers'
export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'সবার জন্য', saao: 'উপসহকারী কৃষি কর্মকর্তাদের জন্য', officers: 'শুধু কর্মকর্তাদের জন্য',
}

export interface Notice {
  id: string
  title: string
  body: string
  audience: Audience
  pinned: boolean
  expires_on: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  author?: { full_name: string; designation: string | null } | null
}

export const isLive = (n: Pick<Notice, 'expires_on'>) => !n.expires_on || n.expires_on >= todayISO()

export async function listNotices(): Promise<Notice[]> {
  const { data, error } = await supabase.from('notices')
    .select('*, author:profiles!created_by(full_name,designation)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Notice[]
}

export async function saveNotice(n: { id?: string; title: string; body: string; audience: Audience; pinned: boolean; expires_on: string | null }, userId: string): Promise<Notice> {
  const row = { title: n.title.trim(), body: n.body.trim(), audience: n.audience, pinned: n.pinned, expires_on: n.expires_on || null }
  const q = n.id
    ? supabase.from('notices').update(row).eq('id', n.id).select('*')
    : supabase.from('notices').insert({ ...row, created_by: userId }).select('*')
  const { data, error } = await q
  if (error) throw error
  if (!data?.length) throw new Error('সেভ করা যায়নি (অনুমতি নেই)।')
  return data[0] as Notice
}

export async function deleteNotice(id: string) {
  const { data, error } = await supabase.from('notices').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('মোছা যায়নি (অনুমতি নেই)।')
}

// নতুন নোটিশ সংশ্লিষ্টদের ফোনে পাঠাতে সার্ভারকে জানানো (ব্যর্থ হলে নোটিশ দেওয়া আটকায় না)
export async function pushNotice(id: string) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ notice_id: id }),
      keepalive: true,
    })
  } catch { /* ঐচ্ছিক */ }
}
