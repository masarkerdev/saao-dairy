export type Role = 'saao' | 'coadmin' | 'admin' | 'developer'

export interface Profile {
  id: string
  full_name: string
  role: Role
  upazila: string
  block_name: string | null
  union_name: string | null
  mobile: string | null
  email?: string | null
  designation?: string | null
  active: boolean
  created_at?: string
}

// পূর্ণ নাম (ইউজার ব্যবস্থাপনা ও ড্রপডাউনে)
export const ROLE_LABEL: Record<Role, string> = {
  saao: 'উপসহকারী কৃষি কর্মকর্তা',
  coadmin: 'কো-এডমিন (অতিরিক্ত কৃষি অফিসার: কো-এডমিন-১, কৃষি সম্প্রসারণ কর্মকর্তা: কো-এডমিন-২)',
  admin: 'এডমিন (উপজেলা কৃষি অফিসার)',
  developer: 'ডেভেলপার',
}

// ছোট নাম (হেডারে)
export const ROLE_SHORT: Record<Role, string> = {
  saao: 'উপসহকারী কৃষি কর্মকর্তা',
  coadmin: 'কো-এডমিন',
  admin: 'উপজেলা কৃষি অফিসার',
  developer: 'ডেভেলপার',
}

// সাইনআপে পদবি; উপজেলা পর্যায়ের কর্মকর্তাদের ব্লক/ইউনিয়ন লাগে না
export const SAAO_TITLE = 'উপসহকারী কৃষি কর্মকর্তা'
export const DESIGNATIONS = [SAAO_TITLE, 'উপজেলা কৃষি অফিসার', 'অতিরিক্ত কৃষি অফিসার', 'কৃষি সম্প্রসারণ কর্মকর্তা']
// পদবি দেখে কোন ভূমিকা মানানসই
export const suggestedRole = (designation?: string | null): Role =>
  designation === 'উপজেলা কৃষি অফিসার' ? 'admin' : designation && designation !== SAAO_TITLE ? 'coadmin' : 'saao'

export const isReviewer = (r?: Role | null) => r === 'coadmin' || r === 'admin'

// পদ = ভূমিকা: উপজেলা কৃষি অফিসার এডমিন, অতিরিক্ত কৃষি অফিসার কো-এডমিন-১, কৃষি সম্প্রসারণ কর্মকর্তা কো-এডমিন-২
export const UAO_TITLE = 'উপজেলা কৃষি অফিসার'
export const AAO_TITLE = 'অতিরিক্ত কৃষি অফিসার'
export const AEO_TITLE = 'কৃষি সম্প্রসারণ কর্মকর্তা'
export interface Post { designation: string; role: Role; title: string }
export const POSTS: Post[] = [
  { designation: UAO_TITLE, role: 'admin', title: 'এডমিন' },
  { designation: AAO_TITLE, role: 'coadmin', title: 'কো-এডমিন-১' },
  { designation: AEO_TITLE, role: 'coadmin', title: 'কো-এডমিন-২' },
  { designation: SAAO_TITLE, role: 'saao', title: 'এসএএও' },
]
export const postOf = (designation?: string | null): Post => POSTS.find((x) => x.designation === designation) ?? POSTS[3]
// হেডার/ব্যাজে দেখানোর ভূমিকা: পদবি মিলিয়ে কো-এডমিন-১/২
export function roleTitle(p?: Pick<Profile, 'role' | 'designation'> | null): string {
  if (!p) return ''
  if (p.role === 'developer') return 'ডেভেলপার'
  if (p.role === 'admin') return 'এডমিন'
  if (p.role === 'coadmin') return p.designation === AEO_TITLE ? 'কো-এডমিন-২' : p.designation === AAO_TITLE ? 'কো-এডমিন-১' : 'কো-এডমিন'
  return 'এসএএও'
}
// পদবি ও ভূমিকা মিলছে কি না (না মিললে ডেভেলপারকে দেখানো হয়)
export const postMismatch = (p: Pick<Profile, 'role' | 'designation' | 'active'>) =>
  p.active && p.role !== 'developer' && postOf(p.designation).role !== p.role
export const isDeveloper = (r?: Role | null) => r === 'developer'
// পদবি অনুযায়ী এসএএও কি না (পদবি না থাকলে পুরোনো একাউন্ট, এসএএও ধরা হয়)
export const isSaaoProfile = (p: Pick<Profile, 'role' | 'designation'>) =>
  p.role === 'saao' && (!p.designation || p.designation === SAAO_TITLE)
// কে কার একাউন্ট সক্রিয়/পরিবর্তন করতে পারেন (ডাটাবেসের protect_profile-এর মতো)
export function canManage(me: Pick<Profile, 'id' | 'role'> | null | undefined, p: Profile): boolean {
  if (!me || me.id === p.id || p.role === 'developer') return false
  if (me.role === 'developer') return true
  return isReviewer(me.role) && isSaaoProfile(p)
}
// ডেভেলপার যে ভূমিকাগুলো দিতে পারেন
export const ASSIGNABLE_ROLES: Role[] = ['saao', 'coadmin', 'admin']
