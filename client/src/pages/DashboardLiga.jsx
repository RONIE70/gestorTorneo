import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DashboardLiga = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/dashboard-resumen')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error:", err));
  }, []);

  if (!data) return <div className="text-white p-10 text-center animate-pulse uppercase font-black tracking-widest">Sincronizando Liga nc-s1125...</div>;

  // Lógica para agrupar clubes por Zona para la visualización de "Zonas del Torneo"
  const clubesPorZona = data.clubes?.reduce((acc, club) => {
    const zona = club.zona || "General";
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(club);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* --- SECCIÓN 1: HUB DE PANELES (6 CARDS - LÓGICA DE NEGOCIO) --- */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 text-center italic">
            Ecosistema de Gestión Integral nc-s1125
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. JUGADORAS (PÚBLICO) */}
            <Link to="/FixturePublico" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-blue-500 shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">⚽</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Jugadoras</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Fixture oficial, resultados y tablas de posiciones.</p>
              <div className="mt-4 text-blue-400 text-[9px] font-black uppercase tracking-widest">Ver Resultados →</div>
            </Link>

            {/* 2. DELEGADOS */}
            <Link to="/AdminDelegado" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-emerald-500 shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">🛡️</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Delegados</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Fichajes, gestión de plantel y lista de buena fe.</p>
              <div className="mt-4 text-emerald-400 text-[9px] font-black uppercase tracking-widest">Gestionar Club →</div>
            </Link>

            {/* 3. LIGA (COLABORADORES) */}
            <Link to="/AdminLiga" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-purple-500 shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">📢</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Panel Liga</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Comunicados oficiales, noticias y prensa del torneo.</p>
              <div className="mt-4 text-purple-400 text-[9px] font-black uppercase tracking-widest">Redactar Info →</div>
            </Link>

            {/* 4. ÁRBITROS */}
            <Link to="/AdminArbitros" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-amber-500 shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">🏁</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Árbitros</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Carga de actas, resultados de partidos y planillas.</p>
              <div className="mt-4 text-amber-500 text-[9px] font-black uppercase tracking-widest">Cargar Actas →</div>
            </Link>

            {/* 5. TRIBUNAL DE DISCIPLINA */}
            <Link to="/AdminTribunal" className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-6 rounded-[2rem] transition-all hover:border-rose-600 shadow-2xl hover:-translate-y-1">
              <span className="text-3xl mb-3 block">⚖️</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Tribunal</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Sanciones, multas, quita de puntos y suspensiones.</p>
              <div className="mt-4 text-rose-500 text-[9px] font-black uppercase tracking-widest">Ver Expedientes →</div>
            </Link>

            {/* 6. ORGANIZACIÓN (ADMIN PROPIETARIO) */}
            <Link to="/AdminConfig" className="group relative overflow-hidden bg-slate-950 border border-blue-500/30 p-6 rounded-[2rem] transition-all hover:border-blue-500 shadow-2xl hover:-translate-y-1 shadow-blue-500/5">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl"></div>
              <span className="text-3xl mb-3 block">🏢</span>
              <h3 className="text-lg font-black uppercase italic tracking-tighter text-blue-400">Organización</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 leading-relaxed">Sorteo de fixture y configuración base del torneo.</p>
              <div className="mt-4 text-blue-300 text-[9px] font-black uppercase tracking-widest">Maestro →</div>
            </Link>

          </div>
        </section>

        {/* --- SECCIÓN 2: RESUMEN DINÁMICO (PRÓXIMA FECHA Y ESTRUCTURA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-10 border-t border-slate-900">
          
          <div className="lg:col-span-2 space-y-10">
            
            {/* A. PRÓXIMA FECHA */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-black uppercase italic text-blue-500 tracking-tighter">
                  {data.proximos?.length > 0 ? 'Próxima Fecha' : 'Estado del Torneo'}
                </h2>
                <Link to="/FixturePublico" className="text-[10px] font-black text-slate-500 uppercase hover:text-white transition-colors underline decoration-blue-500/50 underline-offset-4 tracking-widest">👉 Calendario Completo</Link>
              </div>
              
              <div className="grid gap-3">
                {data.proximos && data.proximos.length > 0 ? (
                   data.proximos.slice(0, 4).map(p => (
                    <div key={p.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group relative overflow-hidden hover:bg-slate-900 transition-all">
                      {p.zona && <span className="absolute top-0 left-0 bg-blue-600 text-[6px] font-black px-2 py-0.5 rounded-br-lg uppercase">{p.zona}</span>}
                      
                      <div className="flex flex-col items-center w-1/3 gap-1">
                        <img src={p.local_info?.escudo_url} className="w-8 h-8 object-contain group-hover:scale-130 transition-transform" alt="" />
                        <span className="text-[9px] font-black uppercase text-center leading-tight">{p.local_info?.nombre}</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[14px] font-black text-blue-500 italic uppercase">{p.horario} HS</span>
                        <span className="text-[7px] text-slate-500 font-bold uppercase">{p.fecha_calendario}</span>
                      </div>

                      <div className="flex flex-col items-center w-1/3 gap-1">
                        <img src={p.visitante_info?.escudo_url} className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" alt="" />
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
                // SI HAY ZONAS: Mostrar grupos
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(clubesPorZona).map(zona => (
                    <div key={zona} className="bg-slate-900/60 border border-slate-800 p-5 rounded-[0.5rem] space-y-4">
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
                // SI NO HAY ZONAS: Listado simple de escudos
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

          <aside className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden border border-white/10">
              <h2 className="text-xl font-black uppercase italic text-white mb-6 relative z-10 tracking-tighter text-center">Top Goleadoras</h2>
              <div className="space-y-4 relative z-10">
                {data.goleadoras?.slice(0, 4).map((g, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl border border-white/5 hover:bg-white/20 transition-all">
                    <img src={g.foto_url} className="w-10 h-10 rounded-xl object-cover border border-white/20" alt="Jugadora" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-white leading-none tracking-tighter">{g.apellido}, {g.nombre}</p>
                      <p className="text-[8px] text-blue-200 uppercase font-bold mt-1">{g.club_nombre}</p>
                    </div>
                    <div className="text-right text-lg font-black text-white">{g.goles_totales}</div>
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