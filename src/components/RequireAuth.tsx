import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Role } from '../types'

interface Props {
  children: ReactNode
  roles?: Role[] // নির্দিষ্ট role লাগলে দিন
}

export default function RequireAuth({ children, roles }: Props) {
  const { session, profile, loading, profileError } = useAuth()

  if (loading) return <div className="center">লোড হচ্ছে…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profileError || !profile) {
    return (
      <div className="center">
        <p className="err">{profileError ?? 'প্রোফাইল লোড হয়নি'}</p>
      </div>
    )
  }
  if (!profile.active) return <Navigate to="/pending" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
