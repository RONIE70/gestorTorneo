import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes de Estructura
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas y Componentes de Funcionalidad
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
import ConfiguracionPerfilPropietario from './components/ConfiguracionPerfilPropietario';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white">
        {/* EL NAVBAR PERMANECE VISIBLE */}
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
            
            {/* --- RUTAS PROTEGIDAS - NIVEL: SUPERADMIN --- */}
            {/* Configuración Visual de la Liga */}
            <Route 
              path="/AdminConfig" 
              element={
                <ProtectedRoute rolRequerido="superadmin">
                  <AdminConfig />
                </ProtectedRoute>
              } 
            />
            {/* Gestión de Roles de Usuarios */}
            <Route 
              path="/admin-perfiles" 
              element={
                <ProtectedRoute rolRequerido="superadmin">
                  <GestionPerfiles />
                </ProtectedRoute>
              } 
            />
            {/* Configuración de Datos de Contacto de la Organización */}
            <Route 
              path="/AdminConfiguracion" 
              element={
                <ProtectedRoute rolRequerido="superadmin">
                  <ConfiguracionPerfilPropietario />
                </ProtectedRoute>
              } 
            />

            {/* --- RUTAS PROTEGIDAS - NIVEL: COLABORADOR --- */}
            <Route 
              path="/AdminLiga" 
              element={
                <ProtectedRoute rolRequerido="colaborador">
                  <AdminLiga />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/AdminTribunal" 
              element={
                <ProtectedRoute rolRequerido="colaborador">
                  <AdminTribunal />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/verificar-jugadoras" 
              element={
                <ProtectedRoute rolRequerido="superadmin">
                  <VerificacionJugadoras />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ListaJugadoras" 
              element={
                <ProtectedRoute rolRequerido="colaborador">
                  <ListaJugadoras />
                </ProtectedRoute>
              } 
            />

            {/* --- RUTAS PROTEGIDAS - NIVEL: DELEGADO --- */}
            <Route 
              path="/AdminDelegado" 
              element={
                <ProtectedRoute rolRequerido="delegado">
                  <AdminDelegado />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registro" 
              element={
                <ProtectedRoute rolRequerido="delegado">
                  <FormularioFichaje />
                </ProtectedRoute>
              } 
            />

            {/* --- RUTAS PROTEGIDAS - NIVEL: ÁRBITRO --- */}
            <Route 
              path="/AdminArbitros" 
              element={
                <ProtectedRoute rolRequerido="arbitro">
                  <AdminArbitros />
                </ProtectedRoute>
              } 
            />

            {/* REDIRECCIÓN POR DEFECTO A LA RAÍZ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;