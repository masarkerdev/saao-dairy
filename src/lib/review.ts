import { supabase } from './supabase'
import type { Schedule, Status } from './schedules'

export interface ReviewRow extends Schedule {
  owner: { full_name: string; block_name: string | null; union_name: string | null; mobile: string | null } | null
}

// খসড়া বাদে সব সূচি (কো-এডমিন/এডমিন); নিজের সূচি তালিকায় আসে না
export async function listForReview(status: Status | 'all', exceptUserId: string): Promise<ReviewRow[]> {
  let q = supabase
    .from('schedules')
    .select('*, owner:profiles!saao_id(full_name,block_name,union_name,mobile)')
    .neq('status', 'draft')
    .neq('saao_id', exceptUserId)
    .order('start_date', { ascending: false })
    .order('submitted_at', { ascending: false, nullsFirst: false })
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReviewRow[]
}

export async function countByStatus(status: Status, exceptUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .neq('saao_id', exceptUserId)
  if (error) throw error
  return count ?? 0
}
