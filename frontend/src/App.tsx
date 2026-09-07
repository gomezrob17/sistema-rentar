import { Routes, Route, Navigate } from 'react-router-dom'
import { RutaAdmin } from './components/RutaAdmin'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Ingreso } from './pages/Ingreso'
import { AdminVehiculos } from './pages/AdminVehiculos'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ingreso" element={<Ingreso />} />
        <Route path="/admin/vehiculos" element={<RutaAdmin><AdminVehiculos /></RutaAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App