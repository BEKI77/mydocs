import { Navigate, Route, Routes } from "react-router-dom";
import Credential from "./pages/Credential";
import Login from "./pages/Login";
import Presentation from "./pages/Presentation";
import Scan from "./pages/Scan";
import Verification from "./pages/Verification";
import Wallet from "./pages/Wallet";
import Welcome from "./pages/Welcome";
import { useSession } from "./store/session";

export default function App() {
  const session = useSession();
  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Login />} />
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/add" element={<Scan />} />
      <Route path="/documents/:id" element={<Verification />} />
      <Route path="/credentials/:id" element={<Credential />} />
      <Route path="/credentials/:id/present" element={<Presentation />} />
      <Route path="*" element={<Navigate to="/wallet" replace />} />
    </Routes>
  );
}
