import { useState } from 'react'
import { bn } from '../lib/period'

// আলোচ্য বিষয়: চিপে ট্যাপ করলে যোগ হয়, ✕ চাপলে বাদ; দরকার হলে নিজে লেখা যায় (সর্বোচ্চ ৫টি)
interface Props {
  idBase: string
  value: string[] // ঠিক ৫টি ঘর, খালি ঘর ''
  suggestions: string[]
  readOnly: boolean
  onChange: (next: string[]) => void
}

const pad5 = (list: string[]) => [...list, '', '', '', '', ''].slice(0, 5)

export default function TopicPicker({ idBase, value, suggestions, readOnly, onChange }: Props) {
  const [custom, setCustom] = useState('')
  const [more, setMore] = useState(false)
  const chosen = value.filter((t) => t.trim())
  const full = chosen.length >= 5

  const add = (t: string) => {
    const v = t.trim()
    if (!v || full || chosen.includes(v)) return
    onChange(pad5([...chosen, v]))
  }
  const remove = (i: number) => onChange(pad5(chosen.filter((_, k) => k !== i)))

  const rest = suggestions.filter((s) => !chosen.includes(s))
  const shown = more ? rest : rest.slice(0, 8)

  return (
    <div className="tpick">
      <div className="tlabel">
        কৃষক গ্রুপে আলোচ্য বিষয় <span className="muted">({'০১২৩৪৫'[chosen.length]}/৫)</span>
      </div>
      {chosen.length > 0 ? (
        <ol className="tchosen">
          {chosen.map((t, i) => (
            <li key={t + i}>
              <span className="n">{'১২৩৪৫'[i]}।</span>
              <span className="t">{t}</span>
              {!readOnly && (
                <button type="button" className="x" aria-label={`${t} বাদ দিন`} onClick={() => remove(i)}>✕</button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">{readOnly ? 'কোনো বিষয় লেখা হয়নি।' : 'নিচের তালিকা থেকে ট্যাপ করে বিষয় যোগ করুন।'}</p>
      )}
      {!readOnly && !full && (
        <>
          <div className="chips">
            {shown.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => add(s)}>+ {s}</button>
            ))}
            {rest.length > 8 && (
              <button type="button" className="chip more" onClick={() => setMore((m) => !m)}>
                {more ? 'কম দেখান' : `আরও ${bn(rest.length - 8)}টি`}
              </button>
            )}
          </div>
          <div className="tcustom">
            <input
              id={`${idBase}-custom`}
              value={custom}
              placeholder="অন্য বিষয় নিজে লিখুন"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add(custom)
                  setCustom('')
                }
              }}
            />
            <button type="button" className="ghost" onClick={() => { add(custom); setCustom('') }}>যোগ করুন</button>
          </div>
        </>
      )}
    </div>
  )
}
