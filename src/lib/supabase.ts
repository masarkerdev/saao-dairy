import { createClient } from '@supabase/supabase-js'

// মানের আগে-পরের ফাঁকা জায়গা ও ভুলে বসানো কোটেশন বাদ দেওয়া হয়
const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '') : '')

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

function validUrl(u: string) {
  try {
    return /^https?:\/\//.test(u) && !!new URL(u).hostname
  } catch {
    return false
  }
}

export type EnvProblem = 'missing_url' | 'bad_url' | 'missing_key' | null

export const envProblem: EnvProblem = !url
  ? 'missing_url'
  : !validUrl(url)
    ? 'bad_url'
    : !key
      ? 'missing_key'
      : null

export const envMissing = envProblem !== null

// env ঠিক না থাকলেও অ্যাপ ক্র্যাশ করবে না; App.tsx কারণসহ বার্তা দেখাবে
export const supabase = createClient(envMissing ? 'http://localhost' : url, envMissing ? 'missing' : key)
