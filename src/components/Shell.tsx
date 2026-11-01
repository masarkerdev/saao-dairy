import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLE_SHORT, isDeveloper, isReviewer } from '../types'
import Icon, { Avatar } from './Icon'

// লগইনের পরের সব পেজ: উপরে অ্যাপ-বার (ডেস্কটপে মেনুসহ), মোবাইলে নিচে আইকনসহ মেনু
export default function Shell({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  if (!profile) return <>{children}</>
  const rev = isReviewer(profile.role)
  const links: [string, string, string][] = isDeveloper(profile.role)
    ? [['/', 'অনুমোদন', 'review'], ['/profile', 'প্রোফাইল', 'user']]
    : rev
    ? [['/', 'হোম', 'home'], ['/review', 'পর্যালোচনা', 'review'], ['/admin', 'ইউজার', 'groups'], ['/settings', 'সেটিংস', 'settings'], ['/profile', 'প্রোফাইল', 'user']]
    : [['/', 'হোম', 'home'], ['/groups', 'আমার গ্রুপ', 'groups'], ['/schedules/new', 'নতুন সূচি', 'calendarPlus'], ['/profile', 'প্রোফাইল', 'user']]

  const nav = (cls: string) => (
    <nav className={cls} aria-label="মেনু">
      {links.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon name={icon} size={cls.startsWith('tabbar') ? 22 : 18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="shell">
      <header className="appbar noprint">
        <div className="appbar-in">
          <Link to="/" className="brand" aria-label="হোম">
            <span className="mark"><Icon name="leaf" size={20} /></span>
            <span className="btext">
              <span className="bname">পাক্ষিক ভ্রমণসূচী</span>
              <span className="bsub">{profile.upazila} উপজেলা কৃষি অফিস</span>
            </span>
          </Link>
          {nav('topnav')}
          <Link to="/profile" className="me" aria-label="প্রোফাইল">
            <span className="me-text">
              <span className="wname">{profile.full_name}</span>
              <span className="wrole">{ROLE_SHORT[profile.role]}</span>
            </span>
            <Avatar name={profile.full_name} size={36} />
          </Link>
        </div>
      </header>
      <main className="shell-main">{children}</main>
      {nav('tabbar noprint')}
    </div>
  )
}
