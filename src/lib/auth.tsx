import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // ১) সেশন
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) setProfileError(error.message)
    else if (!data) setProfileError('প্রোফাইল পাওয়া যায়নি। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।')
    else {
      setProfileError(null)
      setProfile(data as Profile)
    }
  }, [userId])

  // ২) ইউজার বদলালে প্রোফাইল লোড
  useEffect(() => {
    setProfile(null)
    setProfileError(null)
    void loadProfile()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const loading = !sessionReady || (!!userId && !profile && !profileError)

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileError, refreshProfile: loadProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
