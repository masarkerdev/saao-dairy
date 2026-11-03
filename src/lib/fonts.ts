// Nikosh ফন্ট (public/fonts/Nikosh.ttf): ফর্ম, PDF ও Word-এ
// ফন্ট: বাংলাদেশ নির্বাচন কমিশন সচিবালয়; লাইসেন্স CC BY-NC-ND 3.0 (অবাণিজ্যিক ব্যবহার, ফাইল অপরিবর্তিত)
let url = '/fonts/Nikosh.ttf'
export const setNikoshUrl = (u: string) => { url = u }

let cache: Promise<Uint8Array | null> | null = null
// Word ফাইলের ভেতরে ঢোকানোর জন্য ফন্টের বাইট; না পেলে null (তখন শুধু নাম বসে)
export function nikoshBytes(): Promise<Uint8Array | null> {
  cache ??= fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? new Uint8Array(b) : null))
    .catch(() => null)
  return cache
}

// PDF-এর ছবি তোলার আগে ফন্ট লোড নিশ্চিত করা
export async function nikoshReady() {
  try {
    await document.fonts?.load('13px Nikosh', 'অআক১')
    await document.fonts?.ready
  } catch { /* না হলে বিকল্প ফন্টে */ }
}
