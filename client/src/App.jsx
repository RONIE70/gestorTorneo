import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes de Estructura
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas y Componentes
import DashboardLiga from './pages/DashboardLiga';
import AdminLiga from './pages/AdminLiga';
import AdminDelegado from './pages/AdminDelegado';
import AdminArbitros from './pages/AdminArbitros';
import FormularioFichaje from './pages/FormularioFichaje';
import AdminConfig from './pages/AdminConfig';
import FixturePublico from './components/FixturePublico';
import Contacto from './components/Contacto';
import AdminConfiguracion from './pages/AdminConfiguracion';
import VerificacionPublica from './components/VerificacionPublica';
import AdminTribunal from './pages/AdminTribunal';
import TablaPosiciones from './components/TablaPosiciones';
import ListaJugadoras from './components/ListaJugadoras';
import Login from './components/Login';
import GestionPerfiles from './components/GestionPerfiles'; 
import VerificacionJugadoras from './components/VerificacionJugadoras';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ValidadorBiometrico from './components/ValidadorBiometrico'; 


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white">
        <Navbar />
        
        <main className="container mx-auto">
          <Routes>
            {/* --- RUTAS PÚBLICAS --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<DashboardLiga />} />
            <Route path="/FixturePublico" element={<FixturePublico />} />
            <Route path="/posiciones" element={<TablaPosiciones />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/verificar/:id" element={<VerificacionPublica />} />
            
            {/* --- NIVEL 1: CONTROL MAESTRO (Solo Tú) --- */}
            // Prueba esto solo para ver si carga el componente
<Route path="/master-control" element={<SuperAdminDashboard />} />

            {/* --- NIVEL 2: ADMIN DE LIGA (Tus Clientes) --- */}
            <Route 
              path="/AdminConfig" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin', 'admin_liga']}>
                  <AdminConfig />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin-perfiles" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin', 'admin_liga']}>
                  <GestionPerfiles />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/verificar-jugadoras" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin', 'admin_liga', 'colaborador']}>
                  <VerificacionJugadoras />
                </ProtectedRoute>
              } 
            />

            {/* --- NIVEL 3: OPERATIVOS (Colaboradores / Tribunal) --- */}
            <Route 
              path="/AdminLiga" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin', 'admin_liga', 'colaborador']}>
                  <AdminLiga />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/AdminTribunal" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin', 'admin_liga', 'tribunal', 'colaborador']}>
                  <AdminTribunal />
                </ProtectedRoute>
              } 
            />

            {/* --- NIVEL 4: DELEGADOS DE CLUB --- */}
            <Route 
              path="/AdminDelegado" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin','delegado']}>
                  <AdminDelegado />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registro" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin','delegado']}>
                  <FormularioFichaje />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ListaJugadoras" 
              element={
                <ProtectedRoute rolesPermitidos={['delegado', 'colaborador', 'superadmin', 'admin_liga']}>
                  <ListaJugadoras />
                </ProtectedRoute>
              } 
            />

            {/* --- NIVEL 5: ÁRBITROS --- */}
            <Route 
              path="/AdminArbitros" 
              element={
                <ProtectedRoute rolesPermitidos={['arbitro', 'superadmin']}>
                  <AdminArbitros />
                </ProtectedRoute>
              } 
            />
            {/* RUTA EXCLUSIVA PARA SUPERADMIN: VALIDADOR BIOMÉTRICO */}
              <Route 
                path="/validador-biometrico" 
                element={
                  <ProtectedRoute rolesPermitidos={['superadmin']}>
                    <ValidadorBiometrico />
                  </ProtectedRoute>
                } 
              />

            {/* REDIRECCIÓN POR DEFECTO */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;