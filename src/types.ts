export type Role = 'saao' | 'coadmin' | 'admin'

export interface Profile {
  id: string
  full_name: string
  role: Role
  upazila: string
  block_name: string | null
  union_name: string | null
  mobile: string | null
  email?: string | null
  active: boolean
  created_at?: string
}

// পূর্ণ নাম (ইউজার ব্যবস্থাপনা ও ড্রপডাউনে)
export const ROLE_LABEL: Record<Role, string> = {
  saao: 'উপসহকারী কৃষি কর্মকর্তা',
  coadmin: 'কো-এডমিন (অতিরিক্ত কৃষি অফিসার / কৃষি সম্প্রসারণ কর্মকর্তা)',
  admin: 'উপজেলা কৃষি অফিসার (এডমিন)',
}

// ছোট নাম (হেডারে)
export const ROLE_SHORT: Record<Role, string> = {
  saao: 'উপসহকারী কৃষি কর্মকর্তা',
  coadmin: 'কো-এডমিন',
  admin: 'উপজেলা কৃষি অফিসার',
}

export const isReviewer = (r?: Role | null) => r === 'coadmin' || r === 'admin'
