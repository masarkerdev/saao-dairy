import { supabase } from './supabase'
import { isSaaoProfile } from '../types'
import type { Post, Profile, Role } from '../types'

export type UserFilter = 'pending' | 'active' | 'all'

export async function listProfiles(filter: UserFilter): Promise<Profile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (filter === 'pending') q = q.eq('active', false)
  if (filter === 'active') q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Profile[]
}

// অপেক্ষমাণ সাইনআপ: শুধু এসএএও (কো-এডমিন/এডমিনের জন্য) বা শুধু কর্মকর্তা (ডেভেলপারের জন্য)
export async function pendingUsersCount(kind: 'saao' | 'officer' | 'all' = 'all'): Promise<number> {
  const { data, error } = await supabase.from('profiles').select('id, role, designation').eq('active', false)
  if (error) throw error
  const rows = (data ?? []) as Pick<Profile, 'role' | 'designation'>[]
  if (kind === 'all') return rows.length
  return rows.filter((p) => (kind === 'saao') === isSaaoProfile(p)).length
}

const DENIED = 'পরিবর্তন করা যায়নি (অনুমতি নেই বা ইউজার পাওয়া যায়নি)।'

export async function setActive(id: string, active: boolean) {
  const { data, error } = await supabase.from('profiles').update({ active }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(DENIED)
}

export async function setRole(id: string, role: Role) {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(DENIED)
}

// অনুমোদন: ভূমিকা দিয়ে একসাথে সক্রিয় করা
export async function approveUser(id: string, role: Role) {
  const { data, error } = await supabase.from('profiles').update({ role, active: true }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(DENIED)
}

// ডেভেলপার: পদ বদলানো (পদবি ও ভূমিকা একসাথে); চাইলে একসাথে সক্রিয়ও
export async function setPost(id: string, post: Post, active?: boolean) {
  const row: Record<string, unknown> = { designation: post.designation, role: post.role }
  if (post.role !== 'saao') { row.block_name = null; row.union_name = null }
  if (active !== undefined) row.active = active
  const { data, error } = await supabase.from('profiles').update(row).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(DENIED)
}
