import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Admin from './pages/Admin'
import Login from './pages/Login'
import NewSchedule from './pages/NewSchedule'
import ScheduleEditor from './pages/ScheduleEditor'
import Pending from './pages/Pending'
import Review from './pages/Review'
import Signup from './pages/Signup'
import { envMissing, envProblem } from './lib/supabase'

export default function App() {
  if (envMissing) {
    const reason =
      envProblem === 'bad_url'
        ? 'VITE_SUPABASE_URL-এর মান ঠিক নেই। এটি https:// দিয়ে শুরু হতে হবে, যেমন https://xxxx.supabase.co (কোটেশন বা ফাঁকা ছাড়া)।'
        : envProblem === 'missing_key'
          ? 'VITE_SUPABASE_ANON_KEY পাওয়া যায়নি।'
          : 'VITE_SUPABASE_URL পাওয়া যায়নি।'
    return (
      <div className="card auth">
        <h1>কনফিগারেশন বাকি</h1>
        <p className="err">{reason}</p>
        <p className="muted">
          <code>.env</code> (বা Vercel-এর Environment Variables) ঠিক করে ডেভ সার্ভার আবার চালু করুন, অথবা Vercel-এ Redeploy দিন।
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/pending" element={<Pending />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/schedules/new" element={<RequireAuth roles={['saao']}><NewSchedule /></RequireAuth>} />
      <Route path="/schedules/:id" element={<RequireAuth><ScheduleEditor /></RequireAuth>} />
      <Route path="/review" element={<RequireAuth roles={['approver', 'admin']}><Review /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
      <Route path="*" element={<div className="center">পেজ পাওয়া যায়নি</div>} />
    </Routes>
  )
}
