import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = ({ session }) => {
  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (busqueda.trim()) {
      navigate(`/?search=${busqueda}`);
      setMenuAbierto(false);
    }
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-[100] px-4 md:px-6 py-3 md:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* IZQUIERDA: LOGO */}
        <Link to="/" className="flex-shrink-0" onClick={() => setMenuAbierto(false)}>
          <span className="text-xl md:text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
           Gestor Torneo <span className="text-blue-500">SC-1225</span>
          </span>
        </Link>

        {/* CENTRO: BUSCADOR (Visible en md) */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative hidden md:block">
          <input id="buscar"
            type="text" 
            placeholder="Buscar equipo..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-5 pr-10 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
          <button type="submit" className="absolute right-4 top-2.5 text-lg">🔍</button>
        </form>

        {/* DERECHA: BOTONES PÚBLICOS / ACCESO */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/contacto" className="text-[11px] font-black uppercase text-slate-400 hover:text-white transition-colors">
            Contactanos
          </Link>

          {/* Si hay sesión mostraríamos 'Cerrar Sesión', si no 'Ingresar' */}
          <Link 
            to="/login"
            className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black px-6 py-2.5 rounded-xl uppercase shadow-xl transition-all active:scale-95"
          >
            {session ? 'Cerrar Sesión' : 'Ingresar'}
          </Link>
        </div>

        {/* MÓVIL: BOTÓN HAMBURGUESA */}
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="md:hidden text-white p-2 bg-slate-800 rounded-lg border border-slate-700"
        >
          {menuAbierto ? '✕' : '☰'}
        </button>
      </div>

      {/* --- MENÚ DESPLEGABLE MÓVIL (PÚBLICO) --- */}
      {menuAbierto && (
        <div className="md:hidden mt-4 pt-4 border-t border-slate-800 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              placeholder="Buscar equipo..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white"
            />
            <button type="submit" className="absolute right-4 top-3">🔍</button>
          </form>

          <Link 
            to="/contacto" 
            onClick={() => setMenuAbierto(false)}
            className="text-center text-slate-400 text-xs font-black uppercase py-2"
          >
            Contactanos
          </Link>

          <Link 
            to="/login" 
            onClick={() => setMenuAbierto(false)} 
            className="bg-blue-600 text-white text-center py-4 rounded-xl font-black uppercase text-xs shadow-lg"
          >
            {session ? 'Cerrar Sesión' : 'Ingresar al Portal'}
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;