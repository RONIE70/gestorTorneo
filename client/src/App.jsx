import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes
import Navbar from './components/Navbar';

// Páginas
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


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white">
        {/* EL NAVBAR DEBE ESTAR AQUÍ */}
        <Navbar />
        
        <main className="container mx-auto">
          <Routes>
            <Route path="/" element={<DashboardLiga />} />
            <Route path="/AdminLiga" element={<AdminLiga />} />
            <Route path="/AdminDelegado" element={<AdminDelegado />} />
            <Route path="/AdminArbitros" element={<AdminArbitros />} />
            <Route path="/registro" element={<FormularioFichaje />} />
            <Route path="/configuracion" element={<AdminConfig />} /> {/* Nueva ruta libre */}
            <Route path="/FixturePublico" element={<FixturePublico />} />
            <Route path="/AdminConfig" element={<AdminConfig />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/admin/configuracion" element={<AdminConfiguracion />} />
            <Route path="/verificar/:id" element={<VerificacionPublica />} />
            <Route path="/AdminTribunal" element={<AdminTribunal />} />
            <Route path="/posiciones" element={<TablaPosiciones />} />
            

            {/* Si el usuario escribe cualquier otra cosa, vuelve al inicio */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;