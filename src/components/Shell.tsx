import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLE_SHORT, isReviewer } from '../types'

// লগইনের পরের সব পেজের উপরের বার: অ্যাপের নাম, ভূমিকা অনুযায়ী মেনু, লগআউট
export default function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  if (!profile) return <>{children}</>
  const rev = isReviewer(profile.role)
  const links = rev
    ? [['/', 'হোম'], ['/review', 'পর্যালোচনা'], ['/admin', 'ইউজার'], ['/settings', 'সেটিংস']]
    : [['/', 'হোম'], ['/groups', 'আমার গ্রুপ'], ['/schedules/new', 'নতুন সূচি']]
  return (
    <>
      <header className="appbar noprint">
        <div className="appbar-in">
          <div className="brand">
            <span className="mark" aria-hidden="true">ভ্র</span>
            <div>
              <div className="bname">পাক্ষিক ভ্রমণসূচী</div>
              <div className="bsub">{profile.upazila} উপজেলা কৃষি অফিস</div>
            </div>
          </div>
          <div className="who">
            <span className="wname">{profile.full_name}</span>
            <span className="wrole">{ROLE_SHORT[profile.role]}</span>
          </div>
          <button type="button" className="ghost sm" onClick={() => void signOut()}>লগআউট</button>
        </div>
        <nav className="appnav" aria-label="মেনু">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{label}</NavLink>
          ))}
        </nav>
      </header>
      {children}
    </>
  )
}
