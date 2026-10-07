import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import NewSchedule from './pages/NewSchedule'
import ScheduleEditor from './pages/ScheduleEditor'
import Pending from './pages/Pending'
import Review from './pages/Review'
import Signup from './pages/Signup'
import { envMissing } from './lib/supabase'

export default function App() {
  if (envMissing) {
    return (
      <div className="card auth">
        <h1>কনফিগারেশন বাকি</h1>
        <p>
          <code>.env</code> ফাইলে <code>VITE_SUPABASE_URL</code> ও <code>VITE_SUPABASE_ANON_KEY</code> দিন, তারপর ডেভ সার্ভার আবার চালু করুন।
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
      <Route path="*" element={<div className="center">পেজ পাওয়া যায়নি</div>} />
    </Routes>
  )
}
