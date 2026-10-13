// ডেমোর জন্য ব্রাউজারের ভেতরের নকল Supabase।
// অ্যাপ যে প্রশ্নগুলো করে শুধু সেগুলো বোঝে, আর ডেটাবেসের নিয়মগুলো (03_workflow.sql, 04_pokkho.sql) নকল করে।
import { seed } from './seed'
import { badPlace, periodOf } from '../lib/period'

type Row = Record<string, any>
type DB = Record<string, Row[]>
type Err = { message: string; code?: string }
type Res = { data: any; error: Err | null; count?: number | null }

const KEY = 'saao-demo-db-v2'
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function load(): DB {
  try {
    const t = localStorage.getItem(KEY)
    if (t) return JSON.parse(t)
  } catch { /* ব্রাউজার স্টোরেজ না থাকলে নতুন করে */ }
  return seed()
}
let db: DB = load()
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ঐচ্ছিক */ }
}
export function resetDemo() {
  db = seed()
  persist()
}

// ---- প্রমাণীকরণ ----
let uid: string | null = null
const listeners = new Set<(e: string, s: any) => void>()
const session = () => (uid ? { user: { id: uid, email: me()?.email } } : null)
const emit = (e: string) => listeners.forEach((cb) => cb(e, session()))
const me = () => db.profiles.find((p) => p.id === uid)
const role = () => { const p = me(); return p && p.active ? p.role : null }
const reviewer = () => role() === 'coadmin' || role() === 'admin'
const active = () => !!me()?.active
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))
const newId = (p: string) => p + Math.random().toString(36).slice(2, 10)

export const demoAuth = {
  current: () => uid,
  signInAs(id: string | null) { uid = id; emit(id ? 'SIGNED_IN' : 'SIGNED_OUT') },
}

const auth = {
  getSession: () => delay({ data: { session: session() }, error: null }),
  onAuthStateChange(cb: (e: string, s: any) => void) {
    listeners.add(cb)
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const p = db.profiles.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (!p) return delay({ data: null, error: { message: 'Invalid login credentials' } })
    demoAuth.signInAs(p.id)
    return delay({ data: { session: session() }, error: null })
  },
  async signUp({ email, options }: { email: string; password: string; options?: { data?: Row } }) {
    if (db.profiles.some((x) => x.email?.toLowerCase() === email.toLowerCase()))
      return delay({ data: null, error: { message: 'User already registered' } })
    const d = options?.data ?? {}
    const p = {
      id: newId('u_'), full_name: d.full_name || 'নামহীন', role: 'saao', upazila: 'রাউজান', block_name: d.block_name || null,
      union_name: d.union_name || null, mobile: d.mobile || null, email, active: false, created_at: new Date().toISOString(),
    }
    db.profiles.push(p)
    persist()
    demoAuth.signInAs(p.id)
    return delay({ data: { session: session() }, error: null })
  },
  async signOut() { demoAuth.signInAs(null); return delay({ error: null }) },
}

// ---- নিয়ম (RLS ও ট্রিগার নকল) ----
const scheduleOf = (id: string) => db.schedules.find((s) => s.id === id)
function canRead(table: string, r: Row): boolean {
  if (table === 'locations') return true
  if (!uid) return false
  switch (table) {
    case 'profiles': return r.id === uid || reviewer()
    case 'schedules': return r.saao_id === uid || reviewer()
    case 'farmer_groups': return r.saao_id === uid || reviewer()
    case 'holidays': case 'topic_suggestions': case 'app_settings': return true
    default: {
      const s = scheduleOf(r.schedule_id)
      return !!s && (s.saao_id === uid || reviewer())
    }
  }
}
const ownEditable = (scheduleId: string) => {
  const s = scheduleOf(scheduleId)
  return !!s && s.saao_id === uid && ['draft', 'returned'].includes(s.status) && active()
}
function canWrite(table: string, r: Row): boolean {
  switch (table) {
    case 'holidays': case 'locations': case 'topic_suggestions': case 'app_settings': return reviewer()
    case 'farmer_groups': return r.saao_id === uid && active()
    case 'schedule_groups': case 'schedule_day_notes': return ownEditable(r.schedule_id)
    case 'schedules': return r.saao_id === uid && r.status === 'draft' && active() // শুধু মোছার জন্য
    default: return false
  }
}
const RLS: Err = { message: 'new row violates row-level security policy' }
const fail = (message: string): Err => ({ message })
const DUP: Err = { message: 'duplicate key value violates unique constraint', code: '23505' }

function protectProfile(old: Row, next: Row): Err | null {
  if (next.role !== old.role || next.active !== old.active) {
    if (old.id === uid) return fail('নিজের role বা সক্রিয় অবস্থা বদলানো যায় না')
    if (role() === 'admin') return null
    if (role() === 'coadmin') {
      if (old.role === 'admin' || next.role === 'admin')
        return fail('এডমিন (উপজেলা কৃষি অফিসার) role দেওয়া বা এডমিনের একাউন্ট বদলানো শুধু এডমিন পারেন')
      return null
    }
    return fail('role বা সক্রিয় অবস্থা বদলানোর অনুমতি নেই')
  }
  return null
}

function scheduleProblem(s: Row): string | null {
  const p = periodOf(s.start_date)
  const hol = Object.fromEntries(db.holidays.map((h) => [h.holiday_date, h.name]))
  const bad = db.schedule_groups
    .filter((g) => g.schedule_id === s.id && String(g.group_name ?? '').trim() && g.visit_date)
    .sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1))
    .find((g) => badPlace(g as { visit_date: string }, p, hol))
  if (!bad) return null
  const [y, m, d] = String(bad.visit_date).split('-')
  return `${d}/${m}/${y} তারিখে গ্রুপ ভিজিট রাখা যাবে না (ছুটি বা এই পক্ষের বাইরে)। "ছুটি অনুযায়ী আবার সাজান" চাপুন।`
}

function guardSchedule(old: Row, patch: Row): { row?: Row; err?: Err } {
  const r = role()
  const own = old.saao_id === uid
  const next: Row = { ...old, ...patch, saao_id: old.saao_id, created_at: old.created_at }
  const note = typeof next.approver_note === 'string' && next.approver_note.trim() ? next.approver_note.trim() : null
  const now = new Date().toISOString()
  if (next.status === old.status) {
    if (own && ['draft', 'returned'].includes(old.status)) {
      for (const k of ['approver_note', 'submitted_at', 'forwarded_by', 'forwarded_at', 'approved_by', 'approved_at', 'returned_by', 'returned_at']) next[k] = old[k]
      return { row: next }
    }
    return { err: fail('এই অবস্থায় সূচি বদলানো যাবে না') }
  }
  if (own && ['forwarded', 'approved', 'returned'].includes(next.status) && r !== 'admin')
    return { err: fail('নিজের সূচিতে নিজে সিদ্ধান্ত নেওয়া যায় না') }

  if (own && ['draft', 'returned'].includes(old.status) && next.status === 'submitted') {
    const prob = scheduleProblem(old)
    if (prob) return { err: fail(prob) }
    Object.assign(next, { submitted_at: now, approver_note: null, forwarded_by: null, forwarded_at: null, approved_by: null, approved_at: null })
  } else if (r === 'coadmin' && old.status === 'submitted' && next.status === 'forwarded') {
    Object.assign(next, { forwarded_by: uid, forwarded_at: now, approver_note: note })
  } else if (r === 'admin' && ['submitted', 'forwarded'].includes(old.status) && next.status === 'approved') {
    Object.assign(next, { approved_by: uid, approved_at: now, approver_note: note })
  } else if (next.status === 'returned' && ((r === 'coadmin' && old.status === 'submitted') || (r === 'admin' && ['submitted', 'forwarded'].includes(old.status)))) {
    if (!note) return { err: fail('ফেরত দিতে মন্তব্য লিখতে হবে') }
    Object.assign(next, { returned_by: uid, returned_at: now, approver_note: note, approved_by: null, approved_at: null })
  } else {
    return { err: fail(`এই পরিবর্তনের অনুমতি নেই (${old.status} → ${next.status})`) }
  }
  db.schedule_events.push({
    id: db.schedule_events.reduce((m, e) => Math.max(m, e.id), 0) + 1,
    schedule_id: old.id, actor_id: uid, from_status: old.status, to_status: next.status, note: next.approver_note ?? null, created_at: now,
  })
  next.updated_at = now
  return { row: next }
}

// ---- select স্ট্রিং বোঝা: "*, owner:profiles!saao_id(full_name,block_name)" ----
interface Embed { alias: string; table: string; fk: string; cols: string[] }
function parseSelect(sel: string): { cols: string[] | '*'; embeds: Embed[] } {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  const embeds: Embed[] = []
  const cols: string[] = []
  let star = false
  for (const p of parts) {
    const m = p.match(/^(\w+):(\w+)!(\w+)\(([^)]*)\)$/)
    if (m) embeds.push({ alias: m[1], table: m[2], fk: m[3], cols: m[4].split(',').map((c) => c.trim()) })
    else if (p === '*') star = true
    else cols.push(p)
  }
  return { cols: star ? '*' : cols, embeds }
}
function project(r: Row, sel: string): Row {
  const { cols, embeds } = parseSelect(sel)
  const out: Row = cols === '*' ? { ...r } : Object.fromEntries(cols.map((c) => [c, r[c]]))
  for (const e of embeds) {
    const t = db[e.table].find((x) => x.id === r[e.fk])
    out[e.alias] = t && canRead(e.table, t) ? Object.fromEntries(e.cols.map((c) => [c, t[c]])) : null
  }
  return out
}

const KEYS: Record<string, string[]> = {
  schedule_groups: ['schedule_id', 'group_no'],
  schedule_day_notes: ['schedule_id', 'note_date'],
  holidays: ['holiday_date'],
  app_settings: ['key'],
}

type Filter = (r: Row) => boolean

class Query implements PromiseLike<Res> {
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = []
  private lim: number | null = null
  private sel: string | null = null
  private countHead = false
  private one: 'single' | 'maybe' | null = null
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any = null

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    this.sel = cols
    if (opts?.head) this.countHead = true
    return this
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this }
  upsert(rows: Row | Row[]) { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this }
  update(patch: Row) { this.op = 'update'; this.payload = patch; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this }
  in(c: string, v: any[]) { this.filters.push((r) => v.includes(r[c])); return this }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: o?.ascending ?? true, nullsFirst: o?.nullsFirst ?? false })
    return this
  }
  limit(n: number) { this.lim = n; return this }
  single() { this.one = 'single'; return this }
  maybeSingle() { this.one = 'maybe'; return this }

  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null) {
    return delay(this.run()).then(ok, bad)
  }

  private match = (r: Row) => this.filters.every((f) => f(r))

  private finish(rows: Row[]): Res {
    let out = rows
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => {
        const x = a[o.col], y = b[o.col]
        if (x == null && y == null) return 0
        if (x == null) return o.nullsFirst ? -1 : 1
        if (y == null) return o.nullsFirst ? 1 : -1
        const c = typeof x === 'string' ? x.localeCompare(y, 'bn') : x < y ? -1 : x > y ? 1 : 0
        return c * (o.asc ? 1 : -1)
      })
    }
    if (this.lim != null) out = out.slice(0, this.lim)
    if (this.countHead) return { data: null, error: null, count: out.length }
    const data = this.sel ? out.map((r) => project(r, this.sel!)) : null
    if (this.one) {
      if (!data || !data.length) return this.one === 'maybe' ? { data: null, error: null } : { data: null, error: fail('কোনো সারি পাওয়া যায়নি') }
      return { data: clone(data[0]), error: null }
    }
    return { data: clone(data), error: null }
  }

  private placeTaken(r: Row): boolean {
    return this.table === 'schedule_groups' && !!r.visit_date &&
      db.schedule_groups.some((x) => x !== r && x.schedule_id === r.schedule_id && x.group_no !== r.group_no && x.visit_date === r.visit_date && x.slot === r.slot)
  }

  private run(): Res {
    const t = this.table
    if (!uid && !(t === 'locations' && this.op === 'select')) return { data: null, error: fail('লগইন করা নেই') }
    const rows = db[t]

    if (this.op === 'select') return this.finish(rows.filter((r) => canRead(t, r) && this.match(r)))

    if (this.op === 'delete') {
      const victims = rows.filter((r) => canRead(t, r) && this.match(r) && canWrite(t, r))
      db[t] = rows.filter((r) => !victims.includes(r))
      if (t === 'schedules') for (const k of ['schedule_groups', 'schedule_day_notes', 'schedule_events'])
        db[k] = db[k].filter((x) => !victims.some((v) => v.id === x.schedule_id))
      if (t === 'farmer_groups') for (const g of db.schedule_groups) if (victims.some((v) => v.id === g.farmer_group_id)) g.farmer_group_id = null
      persist()
      return { data: null, error: null }
    }

    if (this.op === 'update') {
      const done: Row[] = []
      for (const old of rows.filter((r) => canRead(t, r) && this.match(r))) {
        if (t === 'profiles') {
          if (!(old.id === uid || reviewer())) continue
          const next = { ...old, ...this.payload, id: old.id, email: old.email }
          const err = protectProfile(old, next)
          if (err) return { data: null, error: err }
          Object.assign(old, next)
        } else if (t === 'schedules') {
          if (!((old.saao_id === uid && ['draft', 'returned'].includes(old.status) && active()) || reviewer())) continue
          const { row, err } = guardSchedule(old, this.payload)
          if (err) return { data: null, error: err }
          Object.assign(old, row)
        } else {
          if (!canWrite(t, old)) continue
          const next = { ...old, ...this.payload }
          if (!canWrite(t, next)) return { data: null, error: RLS }
          Object.assign(old, next)
        }
        done.push(old)
      }
      persist()
      return this.finish(done)
    }

    // insert / upsert
    const added: Row[] = []
    for (const raw of this.payload as Row[]) {
      const r = { ...raw }
      if (t === 'schedules') {
        const day = Number(String(r.start_date).slice(8, 10))
        if (r.saao_id !== uid || !active() || (r.status ?? 'draft') !== 'draft') return { data: null, error: RLS }
        if (![1, 16].includes(day)) return { data: null, error: fail('পক্ষ শুরু হয় ১ বা ১৬ তারিখে') }
        if (db.schedules.some((s) => s.saao_id === r.saao_id && s.start_date === r.start_date)) return { data: null, error: DUP }
        const now = new Date().toISOString()
        Object.assign(r, {
          id: newId('s_'), status: 'draft', approver_note: null, submitted_at: null, forwarded_by: null, forwarded_at: null,
          approved_by: null, approved_at: null, returned_by: null, returned_at: null, created_at: now, updated_at: now,
        })
        db.schedules.push(r)
        added.push(r)
        continue
      }
      if (!canWrite(t, r)) return { data: null, error: RLS }
      const keys = KEYS[t]
      const existing = keys ? db[t].find((x) => keys.every((k) => x[k] === r[k])) : undefined
      if (existing) {
        if (this.op === 'insert') return { data: null, error: DUP }
        const merged = { ...existing, ...r }
        if (this.placeTaken(merged)) return { data: null, error: DUP }
        Object.assign(existing, merged)
        added.push(existing)
      } else {
        if (t === 'topic_suggestions' && db[t].some((x) => x.topic === r.topic)) return { data: null, error: DUP }
        if (t === 'locations' && db[t].some((x) => x.kind === r.kind && x.name === r.name)) return { data: null, error: DUP }
        if (!keys) r.id = r.id ?? (t === 'farmer_groups' ? newId('fg_') : db[t].reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1)
        if (t === 'farmer_groups') Object.assign(r, { active: r.active ?? true, sort: r.sort ?? 0, created_at: new Date().toISOString() })
        if (t === 'topic_suggestions') Object.assign(r, { active: true, months: r.months ?? [] })
        if (t === 'schedule_groups') r.topics = r.topics ?? ['', '', '', '', '']
        if (this.placeTaken(r)) return { data: null, error: DUP }
        db[t].push(r)
        added.push(r)
      }
    }
    persist()
    return this.finish(added)
  }
}

export const supabase = { auth, from: (table: string) => new Query(table) }
export const envMissing = false
export const envProblem = null
export type EnvProblem = null
