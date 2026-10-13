import type { Status } from '../lib/schedules'

// খসড়া → জমা → যাচাই → অনুমোদন; ফেরত এলে প্রথম ধাপে লাল চিহ্ন
const STEPS = ['খসড়া', 'জমা', 'যাচাই', 'অনুমোদন']
const DONE_UPTO: Record<Status, number> = { draft: -1, returned: -1, submitted: 1, forwarded: 2, approved: 3 }

export default function StatusSteps({ status }: { status: Status | null }) {
  const done = status ? DONE_UPTO[status] : -2
  const current = status === 'approved' ? -1 : done + 1
  return (
    <ol className="steps" aria-label="সূচির অবস্থা">
      {STEPS.map((label, i) => {
        const cls = i <= done ? 'done' : i === current ? (status === 'returned' ? 'back' : 'now') : ''
        return (
          <li key={label} className={cls}>
            <span className="dot" aria-hidden="true">{i <= done ? '✓' : '১২৩৪'[i]}</span>
            <span>{status === 'returned' && i === 0 ? 'ফেরত, সংশোধন' : label}</span>
          </li>
        )
      })}
    </ol>
  )
}
