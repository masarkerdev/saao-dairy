import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Icon from '../components/Icon'
import { useAuth } from '../lib/auth'
import { SAAO_TITLE } from '../types'

export default function Pending() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="center">লোড হচ্ছে…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile?.active) return <Navigate to="/" replace />
  const saao = !profile?.designation || profile.designation === SAAO_TITLE

  return (
    <AuthLayout title="অনুমোদনের অপেক্ষায়">
      <div className="pending-box">
        <Icon name="clock" size={28} />
        <p>
          {profile?.full_name ? `${profile.full_name}, ` : ''}আপনার একাউন্ট তৈরি হয়েছে, তবে এখনো সক্রিয় হয়নি।{' '}
          {saao
            ? 'কো-এডমিন (অতিরিক্ত কৃষি অফিসার বা কৃষি সম্প্রসারণ কর্মকর্তা) যাচাই করে সক্রিয় করলে আপনি সূচি তৈরি করতে পারবেন।'
            : 'উপজেলার এডমিন আপনার পদবি দেখে ভূমিকা দিয়ে সক্রিয় করবেন।'}
        </p>
      </div>
      <div className="row">
        <button type="button" className="btn-lg" disabled={busy} onClick={async () => { setBusy(true); await refreshProfile(); setBusy(false) }}>
          {busy ? 'দেখা হচ্ছে…' : 'আবার পরীক্ষা করুন'}
        </button>
        <button type="button" className="ghost" onClick={() => void signOut()}>লগআউট</button>
      </div>
    </AuthLayout>
  )
}
