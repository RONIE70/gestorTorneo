import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// --- 1. COMPONENTES AUXILIARES ACTUALIZADOS CON ESTILO "SUAVE" ---
const CardInvitado = ({ icono, titulo, descripcion, acento, navigate }) => (
  <div 
    onClick={() => navigate('/login')} 
    className={`cursor-pointer group bg-slate-900/40 border border-slate-800 p-6 rounded-[1.5rem] transition-all hover:bg-slate-900 hover:border-red-500/50 shadow-xl`}
  >
    <span className="text-2xl mb-3 block grayscale group-hover:grayscale-0 transition-all">{icono}</span>
    <h3 className="text-md font-bold uppercase tracking-tight text-slate-400 group-hover:text-white transition-colors">{titulo}</h3>
    <p className="text-[10px] text-slate-500 font-medium uppercase mt-2 leading-relaxed">{descripcion}</p>
    <div className="mt-4 text-red-500 text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
      Acceder al sistema →
    </div>
  </div>
);

const CardBloqueada = ({ icono, titulo, descripcion }) => (
  <div className="bg-slate-950/20 border border-slate-900 p-6 rounded-[1.5rem] opacity-30 cursor-not-allowed">
    <span className="text-2xl mb-3 block grayscale">{icono}</span>
    <h3 className="text-md font-bold uppercase tracking-tight text-slate-700">{titulo}</h3>
    <p className="text-[10px] text-slate-800 font-medium uppercase mt-2 leading-relaxed">{descripcion}</p>
  </div>
);

const DashboardLiga = () => {
  const [data, setData] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [ligaNombre, setLigaNombre] = useState('SISTEMA GESTOR');
  const [loadingSession, setLoadingSession] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserRol('jugadora');
        setLigaNombre('SISTEMA GESTOR');
      } else if (event === 'SIGNED_IN' && session) {
        inicializarDashboard();
      }
    });

    const inicializarDashboard = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/dashboard-resumen`);
        const json = await res.json();
        setData(json);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setUserRol('jugadora');
          setLoadingSession(false);
          return;
        }

        const { data: perfil, error: pError } = await supabase
          .from('perfiles')
          .select('*, organizaciones(nombre, color_principal)')
          .eq('id', session.user.id)
          .maybeSingle();

        if (perfil && !pError) {
          setUserRol(perfil.rol);
          if (perfil.organizaciones) {
            setLigaNombre(perfil.organizaciones.nombre);
            // Seteamos un Rojo si no hay color definido para seguir la estética Timbo
            document.documentElement.style.setProperty('--color-liga', perfil.organizaciones.color_principal || '#ef4444');
          }
        } else {
          setUserRol('jugadora');
        }
      } catch (error) {
        console.error("Fallo inicialización:", error);
        setUserRol('jugadora');
      } finally {
        setLoadingSession(false);
      }
    };

    inicializarDashboard();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!data || loadingSession) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-white p-10 text-center animate-pulse uppercase font-bold tracking-[0.3em] italic opacity-50">
        Cargando Experiencia...
      </div>
    </div>
  );

  const clubesPorZona = data.clubes?.reduce((acc, club) => {
    const zona = club.zona || "General";
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(club);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 font-sans selection:bg-red-600">
      <div className="max-w-6xl mx-auto space-y-10 pb-20">

        {/* --- HERO SECTION: ESTILO TIMBO (ROJO Y NEGRO) --- */}
        <div className="relative overflow-hidden bg-black border border-white/5 py-20 px-8 rounded-[2rem] shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-red-600 opacity-10 blur-[120px] -z-10"></div>
          
          <div className="relative z-10 max-w-3xl text-left space-y-6">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-red-500 uppercase">Tecnología aplicada al fútbol</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-white">
              Gestiona tu liga como un <span className="text-red-600 italic">Profesional.</span>
            </h1>
            <p className="text-sm md:text-lg text-slate-400 font-medium max-w-xl leading-relaxed">
              La plataforma más completa para organizar torneos. Fichajes, estadísticas y resultados en vivo con una interfaz minimalista.
            </p>
            
            {/* BOTÓN DE ACCESO AL TORNEO REINAS (DEMO) */}
            <div className="pt-4 flex flex-wrap gap-4">
                <Link 
                    to="/FixturePublico" // O la ruta donde esté el torneo Reinas
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-600/20"
                >
                    Ver Torneo Reinas (+45)
                </Link>
                <button className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all">
                    Solicitar Demo
                </button>
            </div>
          </div>
        </div>

        {/* --- HUB DE PANELES (SUAVIZADO) --- */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">Módulos de Gestión</h2>
              <div className="h-[1px] flex-1 bg-slate-900"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. JUGADORAS */}
            <Link to="/FixturePublico" className="group relative bg-slate-900/50 border border-slate-800 p-6 rounded-[1.5rem] transition-all hover:border-red-600 shadow-xl">
              <span className="text-2xl mb-3 block">⚽</span>
              <h3 className="text-md font-bold uppercase tracking-tight text-white">Fixture y Resultados</h3>
              <p className="text-[10px] text-slate-500 font-medium uppercase mt-2 leading-relaxed">Consulta las tablas de posiciones y próximos partidos en tiempo real.</p>
              <div className="mt-4 text-red-600 text-[9px] font-bold uppercase tracking-widest">Panel Público →</div>
            </Link>

            {/* 2. DELEGADOS */}
            {['delegado', 'superadmin', 'admin_liga'].includes(userRol) ? (
              <Link to="/AdminDelegado" className="group bg-slate-900/50 border border-slate-800 p-6 rounded-[1.5rem] transition-all hover:border-red-600 shadow-xl">
                <span className="text-2xl mb-3 block">🛡️</span>
                <h3 className="text-md font-bold uppercase tracking-tight text-white">Delegados</h3>
                <p className="text-[10px] text-slate-500 font-medium uppercase mt-2 leading-relaxed">Gestión de fichajes digitales y validación de jugadoras.</p>
              </Link>
            ) : (
              <CardInvitado icono="🛡️" titulo="Delegados" descripcion="Módulo para la gestión de planteles oficiales." acento="red-600" navigate={navigate} />
            )}

            {/* 6. ORGANIZACIÓN (CON COMBINACIÓN ROJO/NEGRO) */}
            {(userRol === 'superadmin' || userRol === 'admin_liga') ? (
              <Link to="/AdminConfig" className="group bg-white p-6 rounded-[1.5rem] transition-all hover:scale-[1.02] shadow-2xl">
                <span className="text-2xl mb-3 block">⚙️</span>
                <h3 className="text-md font-bold uppercase tracking-tight text-black">Configuración</h3>
                <p className="text-[10px] text-slate-600 font-bold uppercase mt-2 leading-relaxed">Ajustes de liga, branding y sorteo de fixture.</p>
                <div className="mt-4 text-red-600 text-[9px] font-black uppercase tracking-widest">Administrar Todo →</div>
              </Link>
            ) : (
              <CardInvitado icono="⚙️" titulo="Organización" descripcion="Configuración de marca y sorteo de fixture." acento="red-600" navigate={navigate} />
            )}
          </div>
        </section>

        {/* --- SECCIÓN DE DATOS (MÁS LIMPIA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-10 border-t border-slate-900">
          <div className="lg:col-span-2 space-y-10">
            {/* PRÓXIMA FECHA */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-red-600">Calendario Próximo</h2>
              <div className="grid gap-3">
                {data.proximos?.slice(0, 3).map(p => (
                    <div key={p.id} className="bg-black/40 border border-slate-900 p-5 rounded-2xl flex items-center justify-between group hover:border-red-600/30 transition-all">
                      <div className="flex items-center gap-4 w-1/3">
                        <img src={p.local_info?.escudo_url} className="w-8 h-8 object-contain" alt="" />
                        <span className="text-[10px] font-bold uppercase truncate text-slate-300">{p.local_info?.nombre}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-black text-white">{p.horario}</span>
                        <div className="text-[8px] text-red-600 font-bold uppercase tracking-tighter">EN VIVO</div>
                      </div>
                      <div className="flex items-center justify-end gap-4 w-1/3">
                        <span className="text-[10px] font-bold uppercase truncate text-slate-300">{p.visitante_info?.nombre}</span>
                        <img src={p.visitante_info?.escudo_url} className="w-8 h-8 object-contain" alt="" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <aside>
             <div className="bg-slate-900/50 border border-slate-800 rounded-[1.5rem] p-6">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Máximas Goleadoras</h2>
                <div className="space-y-4">
                  {data.goleadoras?.slice(0, 3).map((g, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-slate-800 pb-3 last:border-0">
                      <div className="text-red-600 font-black italic text-lg">#{i+1}</div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase text-white tracking-tight">{g.apellido}, {g.nombre}</p>
                        <p className="text-[8px] text-slate-500 uppercase font-bold">{g.club_nombre}</p>
                      </div>
                      <div className="bg-red-600/10 text-red-500 px-2 py-1 rounded-md text-[10px] font-black">{g.goles_totales} G</div>
                    </div>
                  ))}
                </div>
             </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DashboardLiga;