// মোবাইল নম্বর: বাংলা বা ইংরেজি অঙ্ক, ফাঁকা/ড্যাশ/+৮৮ সহ লেখা চলে; সংরক্ষণ হয় 01XXXXXXXXX আকারে
const BN = '০১২৩৪৫৬৭৮৯'

export function normalizeMobile(raw: string): string {
  let s = (raw ?? '').replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[\s\-().]/g, '')
  if (s.startsWith('+88')) s = s.slice(3)
  else if (s.startsWith('88') && s.length === 13) s = s.slice(2)
  return s
}

export const isValidMobile = (raw: string) => /^01[3-9]\d{8}$/.test(normalizeMobile(raw))

// খালি থাকলে সমস্যা নেই; লেখা থাকলে ঠিক হতে হবে
export function mobileError(raw: string): string | null {
  if (!raw || !raw.trim()) return null
  return isValidMobile(raw) ? null : 'মোবাইল নম্বর ১১ অঙ্কের, ০১ দিয়ে শুরু হবে (যেমন ০১৭১১২২৩৩৪৪)'
}
