import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes de Estructura
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { supabase } from './supabaseClient';
import React,{ useState, useEffect } from 'react';

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
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ValidadorBiometrico from './components/ValidadorBiometrico'; 


function App() {
  const [perfil, setPerfil] = useState(null);

  // --- LÓGICA DE TEMATIZACIÓN DINÁMICA ---
  useEffect(() => {
    const obtenerConfiguracionVisual = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Buscamos los colores en la configuración de la liga del usuario
          const { data: perfilData } = await supabase
            .from('perfiles')
            .select('organizacion_id, configuracion_liga(color_primario, color_secundario)')
            .eq('id', session.user.id)
            .single();
          
          if (perfilData?.configuracion_liga) {
            setPerfil(perfilData.configuracion_liga);
          }
        }
      } catch (err) {
        console.error("Error cargando colores:", err);
      }
    };

    obtenerConfiguracionVisual();
  }, []);

  // Aplicar las variables CSS al documento
  useEffect(() => {
    if (perfil?.color_primario) {
      document.documentElement.style.setProperty('--color-primario', perfil.color_primario);
    }
    if (perfil?.color_secundario) {
      document.documentElement.style.setProperty('--color-secundario', perfil.color_secundario);
    }
  }, [perfil]);

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
            <Route 
              path="/mastercontrol" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } 
            />

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
                <ProtectedRoute rolesPermitidos={['superadmin','delegado','admin_liga']}>
                  <AdminDelegado />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/registro" 
              element={
                <ProtectedRoute rolesPermitidos={['superadmin','delegado','admin_liga']}>
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
                <ProtectedRoute rolesPermitidos={['arbitro', 'superadmin','admin_liga']}>
                  <AdminArbitros />
                </ProtectedRoute>
              } 
            />
            {/* RUTA EXCLUSIVA PARA SUPERADMIN: VALIDADOR BIOMÉTRICO */}
              <Route 
                path="/validador-biometrico" 
                element={
                  <ProtectedRoute rolesPermitidos={['superadmin','admin_liga']}>
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