// ফাইল ডাউনলোড। ডেমোর মতো বিশেষ জায়গায় আলাদা পদ্ধতি বসানো যায়।
type Saver = (blob: Blob, filename: string) => Promise<void>
let custom: Saver | null = null
export const setFileSaver = (fn: Saver | null) => { custom = fn }

export async function saveBlob(blob: Blob, filename: string) {
  if (custom) return custom(blob, filename)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ফাইলের নাম: ভ্রমণসূচী_নভেম্বর-২০২৬_নাম
export function fileBase(monthName: string, year: number, ownerName?: string | null) {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-')
  const y = String(year).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])
  return clean(`ভ্রমণসূচী_${monthName}-${y}${ownerName ? `_${ownerName}` : ''}`)
}
