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

      // --- AGREGA ESTOS LOGS AQUÍ ---
      console.log("🟢 RESPUESTA DE SUPABASE:", perfil);
      console.log("🛡️ ROL DETECTADO:", perfil?.rol);

          if (error || !perfil) {
            console.warn("Sesión inválida o perfil no encontrado. Limpiando...");
            await supabase.auth.signOut();
            setUserSession(null);
            setUserData({ nombre: '', foto: null, rol: '' });
            return;
          }

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
{/* IZQUIERDA: LOGO CON EL ESCORPIÓN */}
<Link to="/" className="flex items-center gap-4 flex-shrink-0 group" onClick={() => setMenuAbierto(false)}>
  <div className="relative">
    {/* CÍRCULO CONTENEDOR DEL ESCORPIÓN */}
    <div className="h-12 w-12 md:h-14 md:w-14 rounded-full overflow-hidden border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)] bg-white p-0.5 group-hover:scale-110 transition-transform duration-300">
      <img src="data:image/png;base64,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" alt="internet--v1"
      className="w-full h-full object-cover rounded-full"
      
        
      />
    </div>
    {/* Detalle de brillo en la esquina */}
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-black flex items-center justify-center">
      <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
    </div>
  </div>
  
  <div className="flex flex-col">
    <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none text-white italic">
      Digital <span className="text-red-600">Scorpions</span>
    </h1>
    <span className="text-[9px] font-bold tracking-[0.4em] text-slate-500 uppercase mt-1">
      {ligaData.nombre}
    </span>
  </div>
</Link>

        {/* CENTRO: BUSCADOR (Desktop) */}
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

        {/* DERECHA: SESIÓN + AVATAR + BOTÓN SECRETO */}
        <div className="hidden md:flex items-center gap-6">
          
          {/* BOTÓN SECRETO: Solo para SuperAdmin */}
          {userData.rol === 'superadmin' && (
            <Link 
              to="/mastercontrol" 
              className="bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black px-4 py-2 rounded-lg uppercase tracking-tighter animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all"
            >
              🛡️ Master Panel
            </Link>
          )}

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

      {/* --- MENÚ DESPLEGABLE MÓVIL --- */}
      {menuAbierto && (
        <div className="md:hidden mt-4 pt-4 border-t border-slate-800 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <form for="buscar" onSubmit={handleSearch} className="relative">
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
            <>
              <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                 <div className="w-10 h-10 rounded-xl bg-liga flex items-center justify-center font-black text-white uppercase">
                   {userData.nombre.charAt(0)}
                 </div>
                 <div>
                   <p className="text-xs font-black text-white uppercase">{userData.nombre}</p>
                   <p className="text-[9px] text-liga font-bold uppercase tracking-widest">{userData.rol}</p>
                 </div>
              </div>

              {/* ACCESO MAESTRO MÓVIL */}
              {userData.rol === 'superadmin' && (
                <Link 
                  to="/mastercontrol" 
                  onClick={() => setMenuAbierto(false)}
                  className="w-full bg-rose-600/20 border border-rose-600 text-rose-500 text-center py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                >
                  🛡️ ACCESO MASTER CONTROL
                </Link>
              )}
            </>
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