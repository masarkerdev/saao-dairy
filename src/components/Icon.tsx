// ছোট রেখা-আইকন (২৪×২৪, রঙ লেখার রঙ থেকে)। বাইরের কোনো ফন্ট বা লাইব্রেরি লাগে না।
const PATHS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  groups: ['M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6', 'M16.5 11a2.5 2.5 0 1 0 0-5', 'M17 14.5c2.4.4 4 2.3 4 5.5'],
  calendarPlus: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4', 'M12 13v5', 'M9.5 15.5h5'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5'],
  review: ['M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 3h6v3H9z', 'M9 13l2 2 4-4.5'],
  settings: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  logout: ['M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeOff: ['M2 12s3.6-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.6 7-10 7c-2 0-3.7-.6-5.1-1.5', 'M4 4l16 16'],
  phone: ['M5 4h3.5l1.8 4.6-2.4 1.5a11 11 0 0 0 6 6l1.5-2.4L20 15.5V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-3.6-3.6'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  mail: ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M3.5 7l8.5 6 8.5-6'],
  lock: ['M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  leaf: ['M5 19c0-8.5 6-14 15-14 0 9-6 15-14.5 15', 'M5 19.5l7.5-7.5'],
  map: ['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  file: ['M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5'],
  alert: ['M12 3l9.5 17H2.5z', 'M12 10v4', 'M12 17.2v.1'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
}

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20, className }: { name: IconName | string; size?: number; className?: string }) {
  const paths = PATHS[name] ?? []
  return (
    <svg className={'ico' + (className ? ` ${className}` : '')} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// নামের আদ্যক্ষর দিয়ে গোল ছবি
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const parts = (name ?? '').replace(/^(মোঃ|মোছাঃ|মো\.|md\.?)\s*/i, '').trim().split(/\s+/).filter(Boolean)
  const init = parts.length ? [...parts[0]][0] + (parts.length > 1 ? [...parts[parts.length - 1]][0] : '') : '?'
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{init}</span>
}
