import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Field } from '../components/AuthLayout'
import Icon from '../components/Icon'
import { useFeedback } from '../components/Feedback'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { blocksFor, listCharges } from '../lib/blocks'
import type { BlockCharge } from '../lib/blocks'
import { deleteFarmerGroup, groupAddress, listFarmerGroups, listLocations, saveFarmerGroup } from '../lib/catalog'
import type { FarmerGroup } from '../lib/catalog'
import { mobileError } from '../lib/mobile'
import { bn } from '../lib/period'
import { errMsg } from '../lib/schedules'

const blank = { group_name: '', president: '', village: '', union_name: '', block_name: '', mobile: '', address: '' }

// আমার কৃষক গ্রুপ: একবার লিখে রাখলে প্রতি পক্ষের সূচিতে শুধু বাছাই
export default function Groups() {
  const { profile } = useAuth()
  const { confirm, toast } = useFeedback()
  const [list, setList] = useState<FarmerGroup[] | null>(null)
  const [params] = useSearchParams()
  const [charges, setCharges] = useState<BlockCharge[]>([])
  const [block, setBlock] = useState<string | null>(params.get('b'))
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [unions, setUnions] = useState<string[]>([])

  useEffect(() => {
    if (profile) listFarmerGroups(profile.id).then(setList).catch(() => setList([]))
    if (profile) listCharges(profile.id).then(setCharges).catch(() => setCharges([]))
    listLocations().then((l) => setUnions(l.filter((x) => x.kind === 'union').map((x) => x.name))).catch(() => setUnions([]))
  }, [profile])

  if (!profile) return null
  const ownBlock = profile.block_name ?? ''
  const blocks = blocksFor(profile, charges)
  // দায়িত্ব শেষ হলেও আগের গ্রুপগুলো দেখা যাক
  for (const f of list ?? []) if (f.block_name && !blocks.some((b) => b.name === f.block_name)) blocks.push({ name: f.block_name, extra: true })
  const cur = blocks.find((b) => b.name === (block ?? ownBlock)) ?? blocks[0]
  const items = (list ?? []).filter((f) => (f.block_name || ownBlock) === cur.name)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.group_name.trim()) return setError('গ্রুপের নাম লিখুন')
    const me = mobileError(form.mobile)
    if (me) return setError(me)
    setBusy(true)
    try {
      const blk = form.block_name || cur.name
      // গ্রাম/ইউনিয়ন/ব্লক থেকে ঠিকানা; পুরোনো গ্রুপে এগুলো না থাকলে আগের ঠিকানাই থাকে
      const address = groupAddress({ village: form.village, union_name: form.union_name, block_name: blk }) || form.address
      const saved = await saveFarmerGroup({
        group_name: form.group_name, president: form.president, village: form.village, union_name: form.union_name, mobile: form.mobile,
        address, id: editId ?? undefined, saao_id: profile!.id, block_name: blk || null,
        sort: editId ? items.find((x) => x.id === editId)?.sort ?? 0 : items.length + 1,
      })
      setList((l) => editId ? (l ?? []).map((x) => (x.id === saved.id ? saved : x)) : [...(l ?? []), saved])
      toast(editId ? 'গ্রুপের তথ্য হালনাগাদ হয়েছে' : 'গ্রুপ যোগ হয়েছে')
      setForm(blank)
      setEditId(null)
      setOpen(false)
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
  const needle = q.trim().toLowerCase()
  const shown = needle ? items.filter((g) => `${g.group_name} ${g.president ?? ''} ${g.village ?? ''} ${g.address} ${g.mobile} ${bn(g.mobile)}`.toLowerCase().includes(needle)) : items
  const startEdit = (g: FarmerGroup) => { setEditId(g.id); setForm({ group_name: g.group_name, president: g.president ?? '', village: g.village ?? '', union_name: g.union_name ?? '', block_name: g.block_name || cur.name, mobile: g.mobile, address: g.address }); setError(''); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const close = () => { setOpen(false); setEditId(null); setForm(blank); setError('') }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>আমার কৃষক গ্রুপ</h1>
          <p className="muted small">নতুন সূচিতে উপরের ক্রমে প্রথম ১২টি সক্রিয় গ্রুপ নিজে থেকে বসে।</p>
        </div>
        {!open && <button type="button" className="btn-add" onClick={() => setOpen(true)}><Icon name="plus" size={18} /> নতুন গ্রুপ</button>}
      </header>

      {blocks.length > 1 && (
        <div className="seg block-seg" role="tablist" aria-label="ব্লক">
          {blocks.map((b) => (
            <button key={b.name} type="button" role="tab" aria-selected={cur.name === b.name} className={cur.name === b.name ? 'on' : ''}
              onClick={() => { setBlock(b.name); close() }}>
              {b.name || 'নিজ'} ব্লক{b.extra ? ' · অতিরিক্ত' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="stat-strip">
        <div><b>{bn(items.length)}</b><span>মোট গ্রুপ</span></div>
        <div className={activeCount >= 12 ? 'ok' : 'low'}><b>{bn(activeCount)}</b><span>সক্রিয়</span></div>
        <div><b>{bn(Math.max(0, 12 - activeCount))}</b><span>১২টির জন্য আরও লাগবে</span></div>
      </div>

      {open && (
        <section className="card add-panel">
          <div className="row between"><h2 style={{ margin: 0 }}>{editId ? 'গ্রুপ সম্পাদনা' : 'নতুন গ্রুপ যোগ'}</h2>
            <button type="button" className="icon-btn" aria-label="বন্ধ করুন" onClick={close}><Icon name="x" size={18} /></button></div>
          <form onSubmit={submit} className="auth-form">
            <Field label="গ্রুপের নাম" icon="groups" autoFocus value={form.group_name} placeholder="যেমন: নোয়াপাড়া সবুজ কৃষক গ্রুপ" onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
            <div className="two">
              <Field label="সভাপতির নাম" icon="user" value={form.president} onChange={(e) => setForm({ ...form, president: e.target.value })} />
              <Field label="সভাপতির মোবাইল" icon="phone" type="tel" inputMode="tel" value={form.mobile}
                error={form.mobile ? mobileError(form.mobile) : null} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="three">
              <Field label="গ্রাম" icon="map" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
              <label className="field">
                <span className="flabel">ইউনিয়ন</span>
                {unions.length ? (
                  <select value={form.union_name} onChange={(e) => setForm({ ...form, union_name: e.target.value })}>
                    <option value="">বাছুন</option>
                    {form.union_name && !unions.includes(form.union_name) && <option value={form.union_name}>{form.union_name}</option>}
                    {unions.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <span className="finput"><input value={form.union_name} onChange={(e) => setForm({ ...form, union_name: e.target.value })} /></span>
                )}
              </label>
              <label className="field">
                <span className="flabel">ব্লক</span>
                <select value={form.block_name || cur.name} onChange={(e) => setForm({ ...form, block_name: e.target.value })}>
                  {blocks.map((b) => <option key={b.name} value={b.name}>{b.name || 'নিজ ব্লক'}{b.extra ? ' (অতিরিক্ত দায়িত্ব)' : ''}</option>)}
                </select>
              </label>
            </div>
            {editId && !form.village && !form.union_name && form.address && (
              <p className="muted small" style={{ margin: 0 }}>আগের ঠিকানা: {form.address}। গ্রাম ও ইউনিয়ন দিলে প্রিন্টে নতুনটা বসবে।</p>
            )}
            <div className="addr-preview">
              <span className="muted small">প্রিন্টে যেভাবে দেখাবে</span>
              <div><b>{form.group_name || 'গ্রুপের নাম'}</b></div>
              {form.president && <div>সভাপতি: {form.president}</div>}
              <div>{groupAddress({ village: form.village, union_name: form.union_name, block_name: form.block_name || cur.name }) || form.address || 'গ্রাম, ইউনিয়ন, ব্লক'}</div>
              {form.mobile && <div>মোবাইল: {bn(form.mobile)}</div>}
            </div>
            {error && <p className="form-err">{error}</p>}
            <div className="row">
              <button disabled={busy}>{busy ? 'সেভ হচ্ছে…' : editId ? 'হালনাগাদ করুন' : 'গ্রুপ যোগ করুন'}</button>
              <button type="button" className="ghost" onClick={close}>বাতিল</button>
            </div>
          </form>
        </section>
      )}

      {items.length > 3 && (
        <label className="finput search-box">
          <Icon name="search" size={18} />
          <input type="search" placeholder="নাম, সভাপতি, গ্রাম বা মোবাইল দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} aria-label="গ্রুপ খুঁজুন" />
        </label>
      )}

      {!list && <p className="muted">লোড হচ্ছে…</p>}
      {list && items.length === 0 && !open && (
        <div className="card empty">
          <Icon name="groups" size={34} />
          <strong>এখনো কোনো গ্রুপ নেই</strong>
          <span className="muted small">গ্রুপের নাম, ঠিকানা ও মোবাইল একবার লিখে রাখুন, প্রতি মাসে আর লিখতে হবে না।</span>
          <button type="button" onClick={() => setOpen(true)}><Icon name="plus" size={18} /> প্রথম গ্রুপ যোগ করুন</button>
        </div>
      )}
      {needle && shown.length === 0 && <p className="muted">“{q}” দিয়ে কোনো গ্রুপ পাওয়া যায়নি।</p>}

      <div className="gcards">
        {shown.map((g) => {
          const i = items.indexOf(g)
          return (
            <article key={g.id} className={'gcard' + (g.active ? '' : ' off') + (g.active && items.filter((x) => x.active).indexOf(g) < 12 ? ' in12' : '')}>
              <span className="gnum">{bn(i + 1)}</span>
              <div className="gbody">
                <strong>{g.group_name}</strong>
                {g.president && <span className="small"><Icon name="user" size={14} /> সভাপতি: {g.president}</span>}
                <span className="muted small"><Icon name="map" size={14} /> {g.address || 'ঠিকানা নেই'}</span>
                {g.mobile
                  ? <a className="call" href={`tel:${g.mobile}`}><Icon name="phone" size={14} /> {bn(g.mobile)}</a>
                  : <span className="muted small"><Icon name="phone" size={14} /> মোবাইল নেই</span>}
              </div>
              <div className="gside">
                <label className="switch" title={g.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}>
                  <input type="checkbox" checked={g.active} onChange={() => void toggle(g)} aria-label={`${g.group_name} সক্রিয়`} />
                  <span />
                </label>
                <div className="gtools">
                  {!needle && <button type="button" className="icon-btn" aria-label="উপরে নিন" disabled={i === 0} onClick={() => void move(i, -1)}><Icon name="up" size={16} /></button>}
                  {!needle && <button type="button" className="icon-btn" aria-label="নিচে নিন" disabled={i === items.length - 1} onClick={() => void move(i, 1)}><Icon name="down" size={16} /></button>}
                  <button type="button" className="icon-btn" aria-label="সম্পাদনা" onClick={() => startEdit(g)}><Icon name="edit" size={16} /></button>
                  <button type="button" className="icon-btn danger-text" aria-label="মুছুন" onClick={() => void remove(g)}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
