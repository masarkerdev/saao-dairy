import { useEffect, useMemo, useState } from 'react'
import Icon, { Avatar } from '../components/Icon'
import { saveBlob } from '../lib/download'
import { MONTHS, bn, monthOf, monthTitle, nextMonth, periodOf, prevMonth, todayISO } from '../lib/period'
import type { Month } from '../lib/period'
import { STATE_TEXT, loadStats, monthRange } from '../lib/stats'
import type { SaaoStat, Stats as StatsData, SubmitState } from '../lib/stats'

const RANGES = [3, 6, 12]
const shortMonth = (m: Month) => `${MONTHS[m.month - 1]} ${bn(String(m.year).slice(2))}`
const pct = (x: number | null) => (x === null ? '—' : `${bn(Math.round(x * 100))}%`)
const days = (x: number | null) => (x === null ? '—' : `${bn(x.toFixed(1).replace(/\.0$/, ''))} দিন`)
const ORDER: SubmitState[] = ['onTime', 'late', 'missing', 'pending']

// এক সারির অনুভূমিক বার (একটিই মাপ, তাই এক রঙ; সংখ্যা পাশে লেখা)
function Bars({ rows, unit }: { rows: [string, number][]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <ul className="hbars">
      {rows.map(([k, v]) => (
        <li key={k} title={`${k}: ${bn(v)} ${unit}`}>
          <span className="hb-label">{k}</span>
          <span className="hb-track"><span className="hb-fill" style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="hb-val">{bn(v)}</span>
        </li>
      ))}
    </ul>
  )
}

// পরিসংখ্যান: উপজেলা কৃষি অফিসার, কো-এডমিন ও ডেভেলপারের জন্য
export default function Stats() {
  const today = todayISO()
  const [end, setEnd] = useState<Month>(monthOf(periodOf(today)))
  const [count, setCount] = useState(6)
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState('')
  const months = useMemo(() => monthRange(end, count), [end, count])

  useEffect(() => {
    let alive = true
    setData(null); setError('')
    loadStats(months).then((d) => alive && setData(d)).catch(() => alive && setError('পরিসংখ্যান লোড করা যায়নি।'))
    return () => { alive = false }
  }, [months])

  function exportCsv(rows: SaaoStat[]) {
    const head = ['নাম', 'ব্লক', 'মোট মাস', 'সময়মতো', 'দেরিতে', 'জমা হয়নি', 'অনুমোদিত', 'গড় পূরণ (২৪-এর মধ্যে)', 'গড় অনুমোদনের সময় (দিন)', 'মোবাইল']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [head, ...rows.map((r) => [r.profile.full_name, `${r.block}${r.extra ? ' (অতিরিক্ত)' : ''}`, r.expected, r.onTime, r.late, r.missing, r.approved,
      r.filledAvg === null ? '' : r.filledAvg.toFixed(1), r.approveDaysAvg === null ? '' : r.approveDaysAvg.toFixed(1), r.profile.mobile ?? ''])]
    const csv = '﻿' + lines.map((l) => l.map(esc).join(',')).join('\r\n')
    void saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `পরিসংখ্যান_${shortMonth(months[0])}-${shortMonth(end)}.csv`)
  }

  // সামনের মাস পর্যন্ত দেখা যায় (তখন জমার সময় চলছে)
  const limit = nextMonth(monthOf(periodOf(today)))
  const canNext = end.year < limit.year || (end.year === limit.year && end.month < limit.month)

  return (
    <div className="page narrow stats">
      <header className="page-head">
        <div>
          <h1>পরিসংখ্যান</h1>
          <p className="muted small">{monthTitle(months[0])} থেকে {monthTitle(end)} · সক্রিয় এসএএও ও তাঁদের অতিরিক্ত দায়িত্বের ব্লক ধরে হিসাব</p>
        </div>
      </header>

      <div className="st-controls">
        <div className="seg" role="tablist" aria-label="কত মাস">
          {RANGES.map((n) => (
            <button key={n} type="button" role="tab" aria-selected={count === n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>শেষ {bn(n)} মাস</button>
          ))}
        </div>
        <div className="row tight">
          <button type="button" className="ghost sm" aria-label="আগের মাস পর্যন্ত" onClick={() => setEnd(prevMonth(end))}><Icon name="left" size={16} /></button>
          <span className="small">{monthTitle(end)} পর্যন্ত</span>
          <button type="button" className="ghost sm" aria-label="পরের মাস পর্যন্ত" disabled={!canNext} onClick={() => setEnd(nextMonth(end))}><Icon name="right" size={16} /></button>
        </div>
      </div>

      {error && <p className="form-err">{error}</p>}
      {!data && !error && <p className="muted">হিসাব হচ্ছে…</p>}

      {data && (
        <>
          <div className="st-tiles">
            <div><b>{pct(data.onTimeRate)}</b><span>সময়মতো জমার হার</span></div>
            <div><b>{bn(data.visits)}</b><span>পরিকল্পিত গ্রুপ ভিজিট</span></div>
            <div><b>{days(data.approveDaysAvg)}</b><span>জমা থেকে অনুমোদনে গড় সময়</span></div>
            <div><b>{bn(data.activeSaao)}</b><span>সক্রিয় এসএএও</span></div>
          </div>

          <section className="card">
            <h2><Icon name="calendar" size={18} /> মাসভিত্তিক জমা</h2>
            <div className="st-legend">
              {ORDER.map((k) => <span key={k}><i className={`sw-${k}`} />{STATE_TEXT[k]}</span>)}
            </div>
            <ul className="stack-rows">
              {data.months.map((m) => (
                <li key={`${m.month.year}-${m.month.month}`}>
                  <span className="sr-label">{shortMonth(m.month)}</span>
                  <span className="sr-bar" role="img" aria-label={`${monthTitle(m.month)}: ${ORDER.filter((k) => m[k]).map((k) => `${STATE_TEXT[k]} ${bn(m[k])}`).join(', ')}`}>
                    {m.expected === 0 ? <span className="sr-empty">কোনো সূচি প্রত্যাশিত নয়</span> : ORDER.filter((k) => m[k]).map((k) => (
                      <span key={k} className={`seg-${k}`} style={{ flexGrow: m[k] }} title={`${STATE_TEXT[k]}: ${bn(m[k])}`}>{bn(m[k])}</span>
                    ))}
                  </span>
                  <span className="sr-val small">{bn(m.approved)}/{bn(m.expected)} অনুমোদিত</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="row between" style={{ alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}><Icon name="groups" size={18} /> এসএএও-ভিত্তিক</h2>
              <button type="button" className="ghost sm" onClick={() => exportCsv(data.saaos)}><Icon name="file" size={14} /> Excel (CSV) ডাউনলোড</button>
            </div>
            <p className="muted small" style={{ margin: '4px 0 10px' }}>যাঁদের জমা বাকি বা দেরি বেশি, তাঁরা আগে। চলতি সময় শেষ না হওয়া মাস হিসাবে ধরা হয়নি।</p>
            {data.saaos.length === 0 ? <p className="muted">কোনো সক্রিয় এসএএও নেই।</p> : (
              <div className="st-table-wrap">
                <table className="st-table">
                  <thead>
                    <tr><th>এসএএও</th><th>সময়মতো</th><th>দেরিতে</th><th>জমা হয়নি</th><th>অনুমোদিত</th><th>গড় পূরণ</th><th>অনুমোদনে গড়</th></tr>
                  </thead>
                  <tbody>
                    {data.saaos.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <span className="who-cell"><Avatar name={r.profile.full_name} size={28} />
                            <span><b>{r.profile.full_name}</b><small className="muted">{r.block} ব্লক{r.extra ? ' (অতিরিক্ত)' : ''}</small></span>
                          </span>
                        </td>
                        <td className="n">{bn(r.onTime)}/{bn(r.expected)}</td>
                        <td className={'n' + (r.late ? ' warn-text' : '')}>{bn(r.late)}</td>
                        <td className={'n' + (r.missing ? ' danger-text' : '')}>{bn(r.missing)}</td>
                        <td className="n">{bn(r.approved)}</td>
                        <td className="n">{r.filledAvg === null ? '—' : `${bn(Math.round(r.filledAvg))}/২৪`}</td>
                        <td className="n">{days(r.approveDaysAvg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="st-two">
            <section className="card">
              <h2><Icon name="file" size={18} /> সবচেয়ে বেশি আলোচিত বিষয়</h2>
              {data.topics.length ? <Bars rows={data.topics} unit="বার" /> : <p className="muted">এই সময়ে কোনো আলোচ্য বিষয় লেখা হয়নি।</p>}
            </section>
            <section className="card">
              <h2><Icon name="map" size={18} /> ইউনিয়নভিত্তিক গ্রুপ ভিজিট</h2>
              {data.unions.length ? <Bars rows={data.unions} unit="ভিজিট" /> : <p className="muted">এই সময়ে কোনো ভিজিট পরিকল্পিত হয়নি।</p>}
              <p className="muted small" style={{ margin: '8px 0 0' }}>ইউনিয়ন নেওয়া হয় এসএএও-দের "আমার গ্রুপ" তালিকার ইউনিয়ন বা গ্রুপের ঠিকানা থেকে। গ্রুপে ইউনিয়ন লেখা থাকলে হিসাব ঠিক থাকে।</p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
