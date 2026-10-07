import { supabase } from './supabase'
import type { Profile, Role } from '../types'

export type UserFilter = 'pending' | 'active' | 'all'

export async function listProfiles(filter: UserFilter): Promise<Profile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (filter === 'pending') q = q.eq('active', false)
  if (filter === 'active') q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function pendingUsersCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('active', false)
  if (error) throw error
  return count ?? 0
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
