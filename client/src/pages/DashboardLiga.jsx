import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// --- 1. COMPONENTE AUXILIAR (Declarado FUERA para evitar errores de renderizado) ---
const CardInvitado = ({ icono, titulo, descripcion, acento, navigate }) => (
  <div 
    onClick={() => navigate('/login')} 
    className={`cursor-pointer group bg-slate-900/40 border border-dashed border-slate-800 p-6 rounded-[2rem] opacity-60 hover:opacity-100 transition-all hover:border-${acento}/50 shadow-xl shadow-black/20`}
  >
    <span className="text-3xl mb-3 block grayscale group-hover:grayscale-0 transition-all">{icono}</span>
    <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-500 group-hover:text-white">{titulo}</h3>
    <p className="text-[10px] text-slate-600 font-bold uppercase mt-2 leading-relaxed">{descripcion}</p>
    <div className="mt-4 text-slate-700 text-[9px] font-black uppercase tracking-widest group-hover:text-white transition-colors tracking-widest">
      Click para Ingresar →
    </div>
  </div>
);

const DashboardLiga = () => {
  const [data, setData] = useState(null);
  const [userRol, setUserRol] = useState(null); 
  const [ligaNombre, setLigaNombre] = useState('SISTEMA GESTOR');
  const [loadingSession, setLoadingSession] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    // 1. Obtener datos públicos del Dashboard
    fetch(`${import.meta.env.VITE_API_URL}/dashboard-resumen`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error al cargar resumen:", err));

    // 2. Obtener el rol del usuario Y los datos de la LIGA
    const getPerfilYIdentidad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol, organizaciones(nombre, color_principal)')
          .eq('id', session.user.id)
          .single();

        if (perfil) {
          setUserRol(perfil.rol);
          if (perfil.organizaciones) {
            setLigaNombre(perfil.organizaciones.nombre);
            const color = perfil.organizaciones.color_principal || '#3b82f6';
            document.documentElement.style.setProperty('--color-liga', color);
          }
        }
      } else {
        setUserRol('publico');
      }
      setLoadingSession(false);
    };
    getPerfilYIdentidad();
  }, []);

  if (!data || loadingSession) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-white p-10 text-center animate-pulse uppercase font-black tracking-widest italic">
        Sincronizando Liga {ligaNombre}...
      </div>
    </div>
  );

  // Lógica para agrupar clubes por Zona (Tu lógica original)
  const clubesPorZona = data.clubes?.reduce((acc, club) => {
    const zona = club.zona || "General";
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(club);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 font-sans selection:bg-liga">
      <div className="max-w-6xl mx-auto space-y-12 pb-20">

        {/* --- HEADER --- */}
        <header className="text-center py-10 space-y-4 relative">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-liga opacity-10 blur-[100px] -z-10"></div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-in fade-in duration-700">
             {userRol === 'publico' ? "Plataforma de Gestión Deportiva" : `Panel de Control: ${userRol?.toUpperCase()}`}
          </h2>
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
            BIENVENIDO A <br />
            <span className="text-liga filter brightness-125">
               {ligaNombre}
            </span>
          </h1>
        </header>
        
        {/* --- SECCIÓN 1: HUB DE PANELES (6 CARDS) --- */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 text-center italic">
            Ecosistema de Gestión Integral
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. JUGADORAS (SIEMPRE PÚBLICO) */}
            <Link to="/FixturePublico" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-liga shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">⚽</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Jugadoras</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Fixture oficial, resultados y tablas de posiciones.</p>
              <div className="mt-4 text-liga text-[9px] font-black uppercase tracking-widest">Ver Resultados →</div>
            </Link>

            {/* 2. DELEGADOS */}
            {['delegado', 'superadmin'].includes(userRol) ? (
              <Link to="/AdminDelegado" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-emerald-500 shadow-2xl hover:-translate-y-1">
                <span className="text-3xl mb-3 block">🛡️</span>
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Delegados</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Fichajes, gestión de plantel y lista de buena fe.</p>
                <div className="mt-4 text-emerald-400 text-[9px] font-black uppercase tracking-widest">Gestionar Club →</div>
              </Link>
            ) : (
              <CardInvitado icono="🛡️" titulo="Delegados" descripcion="Gestión de fichajes y planteles oficiales." acento="emerald-500" navigate={navigate} />
            )}

            {/* 3. LIGA */}
            {['colaborador', 'superadmin', 'admin_liga'].includes(userRol) ? (
              <Link to="/AdminLiga" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-purple-500 shadow-2xl hover:-translate-y-1">
                <span className="text-3xl mb-3 block">📢</span>
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Panel Liga</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Comunicados oficiales y prensa del torneo.</p>
                <div className="mt-4 text-purple-400 text-[9px] font-black uppercase tracking-widest">Redactar Info →</div>
              </Link>
            ) : (
              <CardInvitado icono="📢" titulo="Panel Liga" descripcion="Comunicados y administración de noticias." acento="purple-500" navigate={navigate} />
            )}

            {/* 4. ÁRBITROS */}
            {['arbitro', 'superadmin'].includes(userRol) ? (
              <Link to="/AdminArbitros" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-amber-500 shadow-2xl hover:-translate-y-1">
                <span className="text-3xl mb-3 block">🏁</span>
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Árbitros</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Carga de actas y resultados en tiempo real.</p>
                <div className="mt-4 text-amber-500 text-[9px] font-black uppercase tracking-widest">Cargar Actas →</div>
              </Link>
            ) : (
              <CardInvitado icono="🏁" titulo="Árbitros" descripcion="Acceso para referís y carga de planillas." acento="amber-500" navigate={navigate} />
            )}

            {/* 5. TRIBUNAL */}
            {['superadmin', 'tribunal', 'admin_liga', 'colaborador'].includes(userRol) ? (
              <Link to="/AdminTribunal" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-rose-600 shadow-2xl hover:-translate-y-1">
                <span className="text-3xl mb-3 block">⚖️</span>
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Tribunal</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Sanciones, multas y expedientes disciplinarios.</p>
                <div className="mt-4 text-rose-500 text-[9px] font-black uppercase tracking-widest">Ver Expedientes →</div>
              </Link>
            ) : (
              <CardInvitado icono="⚖️" titulo="Tribunal" descripcion="Módulo disciplinario y resoluciones oficiales." acento="rose-600" navigate={navigate} />
            )}

            {/* 6. ORGANIZACIÓN (SUPERADMIN) */}
            {userRol === 'superadmin' ? (
              <Link to="/AdminConfig" className="group relative overflow-hidden bg-slate-950 border border-blue-500/30 p-6 rounded-[2rem] transition-all hover:border-blue-500 shadow-2xl hover:-translate-y-1 shadow-blue-500/5">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl"></div>
                <span className="text-3xl mb-3 block">🏢</span>
                <h3 className="text-lg font-black uppercase italic tracking-tighter text-blue-400">Organización</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 leading-relaxed">Configuración de marca y sorteo de fixture.</p>
                <div className="mt-4 text-blue-300 text-[9px] font-black uppercase tracking-widest">Maestro →</div>
              </Link>
            ) : (
              <CardInvitado icono="🏢" titulo="Configuración" descripcion="Parámetros base del sistema gestor." acento="blue-500" navigate={navigate} />
            )}

          </div>
        </section>


        {/* --- SECCIÓN 2: RESUMEN DINÁMICO (PRÓXIMA FECHA Y ESTRUCTURA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-10 border-t border-slate-900">
          
          <div className="lg:col-span-2 space-y-10">
            
            {/* A. PRÓXIMA FECHA */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-black uppercase italic text-liga tracking-tighter">
                  {data.proximos?.length > 0 ? 'Próxima Fecha' : 'Estado del Torneo'}
                </h2>
                <Link to="/FixturePublico" className="text-[10px] font-black text-slate-500 uppercase hover:text-white transition-colors underline decoration-blue-500/50 underline-offset-4 tracking-widest">👉 Calendario Completo</Link>
              </div>
              
              <div className="grid gap-3">
                {data.proximos && data.proximos.length > 0 ? (
                   data.proximos.slice(0, 4).map(p => (
                    <div key={p.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group relative overflow-hidden hover:bg-slate-900 transition-all shadow-lg">
                      {p.zona && <span className="absolute top-0 left-0 bg-liga text-[6px] font-black px-2 py-0.5 rounded-br-lg uppercase text-white z-10">{p.zona}</span>}
                      
                      <div className="flex flex-col items-center w-1/3 gap-1">
                        <img src={p.local_info?.escudo_url} className="w-8 h-8 object-contain group-hover:scale-125 transition-transform" alt="" />
                        <span className="text-[9px] font-black uppercase text-center leading-tight">{p.local_info?.nombre}</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[14px] font-black text-liga italic uppercase leading-none">{p.horario} HS</span>
                        <span className="text-[7px] text-slate-500 font-bold uppercase mt-1">{p.fecha_calendario}</span>
                      </div>

                      <div className="flex flex-col items-center w-1/3 gap-1">
                        <img src={p.visitante_info?.escudo_url} className="w-8 h-8 object-contain group-hover:scale-125 transition-transform" alt="" />
                        <span className="text-[9px] font-black uppercase text-center leading-tight">{p.visitante_info?.nombre}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-3xl text-center">
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest italic">A la espera de la generación del fixture oficial</p>
                  </div>
                )}
              </div>
            </div>

            {/* B. ESTRUCTURA DEL TORNEO (Zonas o Clubes) */}
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase italic text-emerald-500 tracking-tighter">
                {clubesPorZona && Object.keys(clubesPorZona).length > 1 ? "Zonas del Torneo" : "Clubes Inscriptos"}
              </h2>

              {clubesPorZona && Object.keys(clubesPorZona).length > 1 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(clubesPorZona).map(zona => (
                    <div key={zona} className="bg-slate-900/60 border border-slate-800 p-5 rounded-[0.5rem] space-y-4 shadow-xl">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 py-1 px-4 rounded-full w-fit">
                        <span className="text-[10px] font-black text-emerald-500 uppercase italic">ZONA {zona}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {clubesPorZona[zona].map(club => (
                          <div key={club.id} className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
                            <img src={club.escudo_url} className="w-6 h-6 object-contain" alt="" />
                            <span className="text-[8px] font-black uppercase truncate text-slate-300">{club.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 justify-center bg-slate-900/30 p-8 rounded-[3rem] border border-slate-900">
                  {data.clubes?.map(club => (
                    <div key={club.id} className="group flex flex-col items-center gap-2">
                      <img src={club.escudo_url} className="w-12 h-12 object-contain opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt={club.nombre} />
                      <span className="text-[7px] font-black uppercase text-slate-600 group-hover:text-white transition-colors">{club.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* C. ASIDE: TOP GOLEADORAS */}
          <aside className="space-y-6">
            <div className="bg-gradient-to-br from-liga to-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden border border-white/10">
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
              <h2 className="text-xl font-black uppercase italic text-white mb-6 relative z-10 tracking-tighter text-center">Top Goleadoras</h2>
              <div className="space-y-4 relative z-10">
                {data.goleadoras && data.goleadoras.length > 0 ? (
                  data.goleadoras.slice(0, 4).map((g, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl border border-white/5 hover:bg-white/20 transition-all group">
                      <img src={g.foto_url || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-xl object-cover border border-white/20 group-hover:border-white/50" alt="Jugadora" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-white leading-none tracking-tighter">{g.apellido}, {g.nombre}</p>
                        <p className="text-[8px] text-slate-300 uppercase font-bold mt-1 opacity-70">{g.club_nombre || 'S/D'}</p>
                      </div>
                      <div className="text-right text-lg font-black text-white">{g.goles_totales}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-white/40 uppercase text-center font-bold tracking-widest italic py-10">Sin datos registrados</p>
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};

export default DashboardLiga;