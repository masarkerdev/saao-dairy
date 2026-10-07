export type Role = 'saao' | 'approver' | 'admin'

export interface Profile {
  id: string
  full_name: string
  role: Role
  upazila: string
  block_name: string | null
  union_name: string | null
  mobile: string | null
  active: boolean
}

export const ROLE_LABEL: Record<Role, string> = {
  saao: 'উপসহকারী কৃষি কর্মকর্তা',
  approver: 'অনুমোদনকারী কর্মকর্তা',
  admin: 'অ্যাডমিন',
}
