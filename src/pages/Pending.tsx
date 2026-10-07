import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Pending() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="center">লোড হচ্ছে…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile?.active) return <Navigate to="/" replace />

  return (
    <div className="card auth">
      <h1>অনুমোদনের অপেক্ষায়</h1>
      <p>আপনার একাউন্ট এখনো সক্রিয় হয়নি। অ্যাডমিন যাচাই করে সক্রিয় করলে আপনি সূচি তৈরি করতে পারবেন।</p>
      <div className="row">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await refreshProfile()
            setBusy(false)
          }}
        >
          আবার পরীক্ষা করুন
        </button>
        <button className="ghost" onClick={() => void signOut()}>লগআউট</button>
      </div>
    </div>
  )
}
