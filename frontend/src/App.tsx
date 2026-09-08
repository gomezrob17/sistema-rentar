import { Routes, Route, Navigate } from 'react-router-dom'
import { RutaAdmin } from './components/RutaAdmin'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Ingreso } from './pages/Ingreso'
import { AdminVehiculos } from './pages/AdminVehiculos'
import { AdminClientes } from './pages/AdminClientes'
import { CambiarPassword } from './pages/CambiarPassword'
import { RutaCliente } from './components/RutaCliente'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ingreso" element={<Ingreso />} />
        <Route path="/cambiar-password" element={<RutaCliente><CambiarPassword /></RutaCliente>} />
        <Route path="/admin/vehiculos" element={<RutaAdmin><AdminVehiculos /></RutaAdmin>} />
        <Route path="/admin/clientes" element={<RutaAdmin><AdminClientes /></RutaAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App