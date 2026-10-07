import { supabase } from './supabase'
import type { Schedule, Status } from './schedules'

export interface ReviewRow extends Schedule {
  owner: { full_name: string; block_name: string | null; union_name: string | null; mobile: string | null } | null
}

// খসড়া বাদে সব সূচি (অনুমোদনকারী/অ্যাডমিন)
export async function listForReview(status: Status | 'all'): Promise<ReviewRow[]> {
  let q = supabase
    .from('schedules')
    .select('*, owner:profiles!saao_id(full_name,block_name,union_name,mobile)')
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false, nullsFirst: false })
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReviewRow[]
}

export async function pendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
  if (error) throw error
  return count ?? 0
}

const GONE = 'এই সূচিতে অন্য কেউ আগেই সিদ্ধান্ত নিয়েছেন বা এটি আর জমা অবস্থায় নেই।'

export async function approveSchedule(id: string, approverId: string) {
  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'approved', approved_by: approverId, approved_at: new Date().toISOString(), approver_note: null })
    .eq('id', id)
    .eq('status', 'submitted')
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error(GONE)
}

export async function returnSchedule(id: string, note: string) {
  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'returned', approver_note: note })
    .eq('id', id)
    .eq('status', 'submitted')
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error(GONE)
}
