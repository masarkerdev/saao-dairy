// অতিরিক্ত দায়িত্বের ব্লক (sql/09_extra_blocks.sql)
import { supabase } from './supabase'
import { periodEnd, periodStart, todayISO } from './period'
import type { Period } from './period'
import type { Profile } from '../types'

export interface BlockCharge {
  id: string
  saao_id: string
  block_name: string
  union_name: string | null
  from_date: string | null
  to_date: string | null
  created_at?: string
}

// একজন এসএএও যেসব ব্লকের সূচি করেন: আগে নিজ ব্লক, তারপর অতিরিক্ত দায়িত্ব
export interface MyBlock { name: string; extra: boolean; charge?: BlockCharge }

export async function listCharges(saaoId?: string): Promise<BlockCharge[]> {
  let q = supabase.from('block_charges').select('*').order('block_name')
  if (saaoId) q = q.eq('saao_id', saaoId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BlockCharge[]
}

export async function addCharge(c: { saao_id: string; block_name: string; union_name?: string | null; from_date?: string | null; to_date?: string | null }) {
  const row = { ...c, block_name: c.block_name.trim(), union_name: c.union_name || null, from_date: c.from_date || null, to_date: c.to_date || null }
  const { data, error } = await supabase.from('block_charges').insert(row).select('*')
  if (error) throw (error as { code?: string }).code === '23505' ? new Error('এই ব্লকের দায়িত্ব আগেই দেওয়া আছে।') : error
  return (data as BlockCharge[])[0]
}

export async function removeCharge(id: string) {
  const { error } = await supabase.from('block_charges').delete().eq('id', id)
  if (error) throw error
}

// দায়িত্বটি কোনো তারিখ-সীমায় চালু কি না
export const chargeActive = (c: BlockCharge, from: string, to: string) =>
  (!c.from_date || c.from_date <= to) && (!c.to_date || c.to_date >= from)

export function blocksFor(profile: Pick<Profile, 'block_name'> | null, charges: BlockCharge[], p?: Period): MyBlock[] {
  const from = p ? periodStart(p) : todayISO()
  const to = p ? periodEnd(p) : todayISO()
  const own: MyBlock[] = [{ name: profile?.block_name ?? '', extra: false }]
  const extra = charges
    .filter((c) => c.block_name !== (profile?.block_name ?? '') && chargeActive(c, from, to))
    .map((c) => ({ name: c.block_name, extra: true, charge: c }))
  return [...own, ...extra]
}

export const blockLabel = (name: string | null | undefined, extra?: boolean) =>
  name ? `${name} ব্লক${extra ? ' (অতিরিক্ত দায়িত্ব)' : ''}` : extra ? 'অতিরিক্ত দায়িত্ব' : ''
