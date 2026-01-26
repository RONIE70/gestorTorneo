import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Navbar = ({ session }) => {
  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ligaData, setLigaData] = useState({ nombre: 'SC-1225', logo: null });
  
  const navigate = useNavigate();

  // UNIFICADO: Carga datos de la liga y aplica color en un solo efecto
  useEffect(() => {
    const cargarIdentidadVisual = async () => {
      if (session?.user?.id) {
        try {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('organizacion_id, organizaciones(nombre, logo_url, color_principal)')
            .eq('id', session.user.id)
            .single();

          if (perfil?.organizaciones) {
            const org = perfil.organizaciones;
            const color = org.color_principal || '#3b82f6';

            setLigaData({
              nombre: org.nombre,
              logo: org.logo_url
            });

            // Aplicamos el color a la variable CSS global
            document.documentElement.style.setProperty('--color-liga', color);
          }
        } catch (error) {
          console.error("Error cargando identidad:", error);
        }
      } else {
        // Valores por defecto si no hay sesión
        setLigaData({ nombre: 'SC-1225', logo: null });
        document.documentElement.style.setProperty('--color-liga', '#3b82f6');
      }
    };

    cargarIdentidadVisual();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuAbierto(false);
    navigate('/login');
  };

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
        
        {/* IZQUIERDA: LOGO DINÁMICO */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0" onClick={() => setMenuAbierto(false)}>
          {ligaData.logo ? (
            <img src={ligaData.logo} alt="Logo" className="h-8 md:h-10 w-auto object-contain rounded" />
          ) : (
            <div className="h-8 w-8 md:h-10 md:w-10 bg-liga rounded-lg flex items-center justify-center font-black text-white italic shadow-lg">
              {ligaData.nombre.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-4xl font-black">
  GESTOR <span className="text-liga">{ligaData.nombre}</span>
</h1>
          
          </div>
        </Link>

        {/* CENTRO: BUSCADOR (Desktop) */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative hidden md:block">
          <input 
            type="text" 
            placeholder="Buscar equipo..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-5 pr-10 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-liga transition-all font-medium"
          />
          <button type="submit" className="absolute right-4 top-2.5 text-slate-500 hover:text-white">🔍</button>
        </form>

        {/* DERECHA: LINKS Y SESIÓN */}
<div className="hidden md:flex items-center gap-6">
  <Link to="/contacto" className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors tracking-widest">
    Contactanos
  </Link>

  {session ? (
    <button 
      onClick={handleLogout}
      className="bg-slate-800 hover:bg-rose-600 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase transition-all shadow-lg active:scale-95 border border-slate-700 hover:border-rose-500"
    >
      Cerrar Sesión
    </button>
  ) : (
    <Link 
      to="/login"
      /* CAMBIADO: bg-liga por bg-blue-600 para que sea siempre azul */
      className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase shadow-xl shadow-blue-900/20 transition-all active:scale-95"
    >
      Ingresar
    </Link>
  )}
</div>

        {/* MÓVIL: BOTÓN HAMBURGUESA */}
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="md:hidden text-white p-2 bg-slate-800 rounded-lg border border-slate-700"
        >
          {menuAbierto ? '✕' : '☰'}
        </button>
      </div>

      {/* --- MENÚ DESPLEGABLE MÓVIL --- */}
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

          {session ? (
            <button 
              onClick={handleLogout}
              className="bg-rose-600 text-white text-center py-4 rounded-xl font-black uppercase text-xs shadow-lg"
            >
              Cerrar Sesión
            </button>
          ) : (
            <Link 
              to="/login" 
              onClick={() => setMenuAbierto(false)} 
              className="bg-liga text-white text-center py-4 rounded-xl font-black uppercase text-xs shadow-lg"
            >
              Ingresar al Portal
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;