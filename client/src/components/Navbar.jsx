import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Navbar = () => {
  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ligaData, setLigaData] = useState({ nombre: 'SC-1225', logo: null });
  const [userSession, setUserSession] = useState(null);
  const [userData, setUserData] = useState({ nombre: '', foto: null, rol: '' });
  
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Escuchar cambios de sesión y cargar datos de perfil
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserSession(session);
      if (session) {
        cargarDatosCompletos(session);
      } else {
        setLigaData({ nombre: 'SC-1225', logo: null });
        setUserData({ nombre: '', foto: null, rol: '' });
        document.documentElement.style.setProperty('--color-liga', '#3b82f6');
      }
    });

   const cargarDatosCompletos = async (sessionActual) => {
  if (sessionActual?.user?.id) {
    try {
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('*, organizaciones(nombre, logo_url, color_principal)')
        .eq('id', sessionActual.user.id)
        .maybeSingle();

      // SI HAY ERROR O NO HAY PERFIL: Limpiamos todo
      if (error || !perfil) {
        console.warn("Sesión inválida o perfil no encontrado. Limpiando...");
        await supabase.auth.signOut(); // <--- ESTO ES LA CLAVE
        setUserSession(null);
        setUserData({ nombre: '', foto: null, rol: '' });
        return;
      }

      // Si todo está bien, cargamos
      if (perfil.organizaciones) {
        const org = perfil.organizaciones;
        setLigaData({ nombre: org.nombre, logo: org.logo_url });
        document.documentElement.style.setProperty('--color-liga', org.color_principal || '#3b82f6');
      }
      
      setUserData({
        nombre: perfil.nombre || 'Usuario',
        foto: perfil.foto_url,
        rol: perfil.rol
      });

    } catch (error) {
      console.error("Error crítico:", error);
      setUserSession(null);
    }
  }
};

    // Verificación inicial al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
      if (session) cargarDatosCompletos(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserSession(null);
    setMenuAbierto(false);
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (busqueda.trim()) {
      navigate(`/?search=${busqueda}`);
      setMenuAbierto(false);
    }
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-[100] px-4 md:px-6 py-3 md:py-4 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* IZQUIERDA: LOGO */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0" onClick={() => setMenuAbierto(false)}>
          {ligaData.logo ? (
            <img src={ligaData.logo} alt="Logo" className="h-8 md:h-10 w-auto object-contain rounded" />
          ) : (
            <div className="h-8 w-8 md:h-10 md:w-10 bg-liga rounded-lg flex items-center justify-center font-black text-white italic shadow-lg">
              {ligaData.nombre.charAt(0)}
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic">
            GESTOR <span className="text-liga">{ligaData.nombre}</span>
          </h1>
        </Link>

        {/* CENTRO: BUSCADOR (Desktop - Se mantiene intacto) */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative hidden md:block">
          <input
            id="name"
            name="name"
             required
            type="text" 
            placeholder="Buscar equipo..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-5 pr-10 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-liga transition-all"
          />
          <button type="submit" className="absolute right-4 top-2.5 text-slate-500 hover:text-white">🔍</button>
        </form>

        {/* DERECHA: SESIÓN + AVATAR + CONTACTO */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/contacto" className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors tracking-widest">
            Contactanos
          </Link>

          {userSession ? (
            <div className="flex items-center gap-4 bg-slate-950/50 p-1.5 pr-4 rounded-2xl border border-slate-800">
              <div className="relative">
                {userData.foto ? (
                  <img src={userData.foto} className="w-8 h-8 rounded-xl object-cover border border-liga" alt="Avatar" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-black text-liga border border-slate-700 uppercase">
                    {userData.nombre.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 shadow-sm"></div>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">
                  {userData.nombre}
                </span>
                <span className="text-[7px] font-bold text-liga uppercase tracking-[0.2em] mt-1 opacity-70">
                  {userData.rol}
                </span>
              </div>

              <button 
                onClick={handleLogout}
                className="ml-2 p-2 hover:bg-rose-600/20 text-slate-500 hover:text-rose-500 rounded-lg transition-all"
                title="Cerrar Sesión"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <Link 
              to="/login"
              className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase shadow-xl transition-all active:scale-95"
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

      {/* --- MENÚ DESPLEGABLE MÓVIL (Con Búsqueda e Identidad) --- */}
      {menuAbierto && (
        <div className="md:hidden mt-4 pt-4 border-t border-slate-800 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <form onSubmit={handleSearch} className="relative">
            <input
              id="buscar" 
              type="text" 
              placeholder="Buscar equipo..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white"
            />
            <button type="submit" className="absolute right-4 top-3 text-slate-500">🔍</button>
          </form>

          {userSession && (
            <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
               <div className="w-10 h-10 rounded-xl bg-liga flex items-center justify-center font-black text-white uppercase">
                 {userData.nombre.charAt(0)}
               </div>
               <div>
                 <p className="text-xs font-black text-white uppercase">{userData.nombre}</p>
                 <p className="text-[9px] text-liga font-bold uppercase tracking-widest">{userData.rol}</p>
               </div>
            </div>
          )}

          <Link 
            to="/contacto" 
            onClick={() => setMenuAbierto(false)}
            className="text-center text-slate-400 text-xs font-black uppercase py-2 tracking-widest"
          >
            Contactanos
          </Link>

          {userSession ? (
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
              className="bg-blue-600 text-white text-center py-4 rounded-xl font-black uppercase text-xs shadow-lg"
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