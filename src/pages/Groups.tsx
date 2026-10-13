import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../lib/auth'
import { deleteFarmerGroup, listFarmerGroups, saveFarmerGroup } from '../lib/catalog'
import type { FarmerGroup } from '../lib/catalog'
import { mobileError } from '../lib/mobile'
import { bn } from '../lib/period'
import { errMsg } from '../lib/schedules'

const blank = { group_name: '', address: '', mobile: '' }

// আমার কৃষক গ্রুপ: একবার লিখে রাখলে প্রতি পক্ষের সূচিতে শুধু বাছাই
export default function Groups() {
  const { profile } = useAuth()
  const { confirm, toast } = useFeedback()
  const [list, setList] = useState<FarmerGroup[] | null>(null)
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) listFarmerGroups(profile.id).then(setList).catch(() => setList([]))
  }, [profile])

  if (!profile) return null
  const items = list ?? []

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.group_name.trim()) return setError('গ্রুপের নাম লিখুন')
    const me = mobileError(form.mobile)
    if (me) return setError(me)
    setBusy(true)
    try {
      const saved = await saveFarmerGroup({
        ...form, id: editId ?? undefined, saao_id: profile!.id,
        sort: editId ? items.find((x) => x.id === editId)?.sort ?? 0 : items.length + 1,
      })
      setList((l) => editId ? (l ?? []).map((x) => (x.id === saved.id ? saved : x)) : [...(l ?? []), saved])
      toast(editId ? 'গ্রুপের তথ্য হালনাগাদ হয়েছে' : 'গ্রুপ যোগ হয়েছে')
      setForm(blank)
      setEditId(null)
    } catch (err) {
      setError(errMsg(err, 'সেভ করা যায়নি।'))
    }
    setBusy(false)
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const a = items[i], b = items[j]
    const next = [...items]
    next[i] = { ...b, sort: a.sort }
    next[j] = { ...a, sort: b.sort }
    if (a.sort === b.sort) { next[i].sort = i + 1; next[j].sort = j + 1 }
    setList(next)
    try {
      await saveFarmerGroup({ ...next[i] })
      await saveFarmerGroup({ ...next[j] })
    } catch (e) {
      toast(errMsg(e, 'ক্রম বদলানো যায়নি।'), 'err')
    }
  }

  async function toggle(g: FarmerGroup) {
    try {
      const saved = await saveFarmerGroup({ ...g, active: !g.active })
      setList((l) => (l ?? []).map((x) => (x.id === saved.id ? saved : x)))
    } catch (e) {
      toast(errMsg(e, 'বদলানো যায়নি।'), 'err')
    }
  }

  async function remove(g: FarmerGroup) {
    if (!(await confirm(`"${g.group_name}" তালিকা থেকে মুছে ফেলবেন? আগের সূচিতে এর তথ্য থেকে যাবে।`, { ok: 'মুছুন', danger: true }))) return
    try {
      await deleteFarmerGroup(g.id)
      setList((l) => (l ?? []).filter((x) => x.id !== g.id))
    } catch (e) {
      toast(errMsg(e, 'মোছা যায়নি।'), 'err')
    }
  }

  const activeCount = items.filter((x) => x.active).length

  return (
    <div className="page narrow">
      <p className="crumb"><Link to="/">← হোম</Link></p>
      <div className="card">
        <h1>আমার কৃষক গ্রুপ</h1>
        <p className="muted">
          এখানে গ্রুপের নাম, ঠিকানা ও মোবাইল একবার লিখে রাখুন। নতুন সূচি তৈরি করলে উপরের ক্রমে প্রথম ১২টি সক্রিয় গ্রুপ নিজে থেকে বসে যাবে।
          এখন সক্রিয়: <b>{bn(activeCount)}</b>টি।
        </p>

        <form onSubmit={submit} className="gform">
          <label>গ্রুপের নাম<input value={form.group_name} placeholder="যেমন: নোয়াপাড়া সবুজ কৃষক গ্রুপ" onChange={(e) => setForm({ ...form, group_name: e.target.value })} /></label>
          <div className="two">
            <label>ঠিকানা (গ্রাম, ইউনিয়ন)<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>সভাপতি/যোগাযোগের মোবাইল<input type="tel" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
          </div>
          {error && <p className="err small">{error}</p>}
          <div className="row">
            <button disabled={busy}>{editId ? 'হালনাগাদ করুন' : '+ গ্রুপ যোগ করুন'}</button>
            {editId && <button type="button" className="ghost" onClick={() => { setEditId(null); setForm(blank); setError('') }}>বাতিল</button>}
          </div>
        </form>

        {!list && <p className="muted">লোড হচ্ছে…</p>}
        {list && items.length === 0 && <p className="muted">এখনো কোনো গ্রুপ নেই। উপরের ফর্ম থেকে প্রথম গ্রুপ যোগ করুন।</p>}
        {items.length > 0 && (
          <ol className="list glist">
            {items.map((g, i) => (
              <li key={g.id} className={g.active ? '' : 'off'}>
                <span className="gnum">{bn(i + 1)}</span>
                <div className="grow">
                  <strong>{g.group_name}</strong>{!g.active && <span className="badge">নিষ্ক্রিয়</span>}
                  <div className="muted small">{[g.address, g.mobile && bn(g.mobile)].filter(Boolean).join(' · ') || 'ঠিকানা/মোবাইল নেই'}</div>
                </div>
                <div className="row tight">
                  <button type="button" className="ghost sm" aria-label="উপরে নিন" onClick={() => void move(i, -1)}>↑</button>
                  <button type="button" className="ghost sm" aria-label="নিচে নিন" onClick={() => void move(i, 1)}>↓</button>
                  <button type="button" className="ghost sm" onClick={() => { setEditId(g.id); setForm({ group_name: g.group_name, address: g.address, mobile: g.mobile }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>সম্পাদনা</button>
                  <button type="button" className="ghost sm" onClick={() => void toggle(g)}>{g.active ? 'নিষ্ক্রিয়' : 'সক্রিয়'}</button>
                  <button type="button" className="ghost sm danger-text" onClick={() => void remove(g)}>মুছুন</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
