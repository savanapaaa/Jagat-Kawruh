import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import { getSession } from './lib/auth'
import SiswaLayout from './pages/siswa/SiswaLayout'
import SiswaDashboard from './pages/siswa/Dashboard'
import Materi from './pages/siswa/Materi'
import Kuis from './pages/siswa/Kuis'
import KuisMulai from './pages/siswa/KuisMulai'
import Nilai from './pages/siswa/Nilai'
import SiswaPBL from './pages/siswa/PBL'
import SiswaNotifikasi from './pages/siswa/Notifikasi'
import GuruLayout from './pages/guru/GuruLayout'
import GuruDashboard from './pages/guru/Dashboard'
import GuruMateri from './pages/guru/Materi'
import GuruMateriDetail from './pages/guru/MateriDetail'
import GuruKuis from './pages/guru/Kuis'
import GuruKuisBuatSoal from './pages/guru/KuisBuatSoal'
import GuruKuisDetail from './pages/guru/KuisDetail'
import GuruNilai from './pages/guru/Nilai'
import GuruPBL from './pages/guru/PBL'
import GuruProfil from './pages/guru/Profil'
import GuruHelpdesk from './pages/guru/Helpdesk'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminGuru from './pages/admin/Guru'
import AdminSiswa from './pages/admin/Siswa'
import AdminKelas from './pages/admin/Kelas'
import AdminJurusan from './pages/admin/Jurusan'
import AdminProfil from './pages/admin/Profil'
import SiswaProfil from './pages/siswa/Profil'

function RequireSiswa({ children }: { children: React.ReactNode }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'siswa') return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireGuru({ children }: { children: React.ReactNode }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'guru') return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/siswa"
          element={
            <RequireSiswa>
              <SiswaLayout />
            </RequireSiswa>
          }
        >
          <Route index element={<Navigate to="/siswa/dashboard" replace />} />
          <Route path="dashboard" element={<SiswaDashboard />} />
          <Route path="materi" element={<Materi />} />
          <Route path="kuis" element={<Kuis />} />
          <Route path="kuis/:quizId" element={<KuisMulai />} />
          <Route path="pbl" element={<SiswaPBL />} />
          <Route path="nilai" element={<Nilai />} />
          <Route path="notifikasi" element={<SiswaNotifikasi />} />
          <Route path="profil" element={<SiswaProfil />} />
        </Route>

        <Route
          path="/guru"
          element={
            <RequireGuru>
              <GuruLayout />
            </RequireGuru>
          }
        >
          <Route index element={<Navigate to="/guru/dashboard" replace />} />
          <Route path="dashboard" element={<GuruDashboard />} />
          <Route path="materi" element={<GuruMateri />} />
          <Route path="materi/:materiId" element={<GuruMateriDetail />} />
          <Route path="kuis" element={<GuruKuis />} />
          <Route path="kuis/buat-soal" element={<GuruKuisBuatSoal />} />
          <Route path="kuis/:quizId" element={<GuruKuisDetail />} />
          <Route path="pbl" element={<GuruPBL />} />
          <Route path="nilai" element={<GuruNilai />} />
          <Route path="helpdesk" element={<GuruHelpdesk />} />
          <Route path="profil" element={<GuruProfil />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="guru" element={<AdminGuru />} />
          <Route path="siswa" element={<AdminSiswa />} />
          <Route path="kelas" element={<AdminKelas />} />
          <Route path="jurusan" element={<AdminJurusan />} />
          <Route path="profil" element={<AdminProfil />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
