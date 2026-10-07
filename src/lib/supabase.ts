import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const envMissing = !url || !key

// env না থাকলেও অ্যাপ ক্র্যাশ করবে না; App.tsx একটি বার্তা দেখাবে
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')
