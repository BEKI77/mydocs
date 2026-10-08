import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import { useSession } from './hooks.ts'
import Credentials from './pages/Credentials.tsx'
import Login from './pages/Login.tsx'
import RequestDetail from './pages/RequestDetail.tsx'
import Requests from './pages/Requests.tsx'
import Verify from './pages/Verify.tsx'

export default function App() {
  const session = useSession()
  return (
    <Routes>
      {/* Public verifier pages: what a scanned presentation QR opens. */}
      <Route path="/v" element={<Verify />} />
      <Route path="/v/:token" element={<Verify />} />
      {session ? (
        <Route element={<Layout />}>
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="*" element={<Navigate to="/requests" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Login />} />
      )}
    </Routes>
  )
}
