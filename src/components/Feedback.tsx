// বাংলায় নিশ্চিতকরণ বক্স ও ছোট বার্তা (ব্রাউজারের ইংরেজি OK/Cancel-এর বদলে)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ConfirmOpts { ok?: string; cancel?: string; danger?: boolean }
interface Ask { text: string; opts: ConfirmOpts; resolve: (v: boolean) => void }
interface Toast { id: number; text: string; kind: 'ok' | 'err' }
interface FeedbackApi {
  confirm: (text: string, opts?: ConfirmOpts) => Promise<boolean>
  toast: (text: string, kind?: 'ok' | 'err') => void
}

const Ctx = createContext<FeedbackApi | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const okRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback((text: string, opts: ConfirmOpts = {}) =>
    new Promise<boolean>((resolve) => setAsk({ text, opts, resolve })), [])

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((l) => [...l, { id, text, kind }])
    window.setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 3500)
  }, [])

  const close = (v: boolean) => {
    ask?.resolve(v)
    setAsk(null)
  }

  useEffect(() => {
    if (!ask) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      {ask && (
        <div className="dlg-back noprint" onClick={() => close(false)}>
          <div className="dlg" role="alertdialog" aria-modal="true" aria-label="নিশ্চিত করুন" onClick={(e) => e.stopPropagation()}>
            <p>{ask.text}</p>
            <div className="row end">
              <button type="button" className="ghost" onClick={() => close(false)}>{ask.opts.cancel ?? 'না'}</button>
              <button type="button" ref={okRef} className={ask.opts.danger ? 'danger' : ''} onClick={() => close(true)}>
                {ask.opts.ok ?? 'হ্যাঁ'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toasts noprint" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  )
}

export function useFeedback() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFeedback must be inside FeedbackProvider')
  return c
}
