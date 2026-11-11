import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isDeveloper, isReviewer, roleTitle } from '../types'
import Icon, { Avatar } from './Icon'
import { ReminderBanner, ReminderBell, useReminders } from './Reminders'
import { AppTip } from './AppSetup'

// লগইনের পরের সব পেজ: উপরে অ্যাপ-বার (ডেস্কটপে মেনুসহ), মোবাইলে নিচে আইকনসহ মেনু
export default function Shell({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const { items: reminders, seen } = useReminders()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  if (!profile) return <>{children}</>
  const rev = isReviewer(profile.role)
  // উপরের মেনু (ডেস্কটপ) সব দেখায়; নিচের মেনু (মোবাইল) সর্বোচ্চ ৫টি, বাকিগুলো হোম/প্রোফাইল থেকে
  const links: [string, string, string, boolean][] = isDeveloper(profile.role)
    ? [['/', 'ইউজার', 'groups', true], ['/review', 'সব সূচি', 'review', true], ['/stats', 'পরিসংখ্যান', 'chart', true], ['/notices', 'নোটিশ', 'bell', true], ['/settings', 'সেটিংস', 'settings', false], ['/profile', 'প্রোফাইল', 'user', true]]
    : rev
    ? [['/', 'হোম', 'home', true], ['/review', 'পর্যালোচনা', 'review', true], ['/stats', 'পরিসংখ্যান', 'chart', true], ['/notices', 'নোটিশ', 'bell', true], ['/admin', 'ইউজার', 'groups', false], ['/settings', 'সেটিংস', 'settings', false], ['/profile', 'প্রোফাইল', 'user', true]]
    : [['/', 'হোম', 'home', true], ['/groups', 'আমার গ্রুপ', 'groups', true], ['/schedules/new', 'নতুন সূচি', 'calendarPlus', true], ['/notices', 'নোটিশ', 'bell', true], ['/profile', 'প্রোফাইল', 'user', true]]

  const nav = (cls: string) => (
    <nav className={cls} aria-label="মেনু">
      {links.filter((l) => !cls.startsWith('tabbar') || l[3]).map(([to, label, icon]) => (
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
          <ReminderBell items={reminders} onSeen={seen} />
          <Link to="/profile" className="me" aria-label="প্রোফাইল">
            <span className="me-text">
              <span className="wname">{profile.full_name}</span>
              <span className="wrole">{roleTitle(profile)}</span>
            </span>
            <Avatar name={profile.full_name} size={36} />
          </Link>
        </div>
      </header>
      <main className="shell-main">
        <ReminderBanner items={reminders} onSeen={seen} />
        <AppTip />
        {children}
      </main>
      {nav('tabbar noprint')}
    </div>
  )
}
