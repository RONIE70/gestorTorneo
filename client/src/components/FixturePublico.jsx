import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const FixturePublico = () => {
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zonaSeleccionada, setZonaSeleccionada] = useState('TODAS');
  const [zonasDisponibles, setZonasDisponibles] = useState([]);
  const [busquedaEquipo, setBusquedaEquipo] = useState(''); // Nuevo estado para el buscador

  useEffect(() => {
    fetchFixture();
  }, []);

  const fetchFixture = async () => {
    try {
      const { data, error } = await supabase
        .from('partidos')
        .select(`
          *,
          local:equipos!local_id(nombre, escudo_url),
          visitante:equipos!visitante_id(nombre, escudo_url)
        `)
        .order('nro_fecha', { ascending: true });

      if (error) throw error;

      const zonas = [...new Set(data.map(p => p.zona).filter(Boolean))].sort();
      setZonasDisponibles(zonas);
      setPartidos(data);
    } catch (error) {
      console.error("Error al cargar fixture:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE FILTRADO COMBINADA ---
  const partidosFiltrados = partidos.filter(p => {
    const coincideZona = zonaSeleccionada === 'TODAS' || p.zona === zonaSeleccionada;
    const coincideBusqueda = 
      p.local?.nombre.toLowerCase().includes(busquedaEquipo.toLowerCase()) || 
      p.visitante?.nombre.toLowerCase().includes(busquedaEquipo.toLowerCase());
    
    return coincideZona && coincideBusqueda;
  });

  // Agrupación por Fecha para el renderizado
  const agrupados = partidosFiltrados.reduce((acc, partido) => {
    const fecha = partido.nro_fecha;
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(partido);
    return acc;
  }, {});

  if (loading) return <div className="p-10 text-center text-blue-500 font-black animate-pulse uppercase tracking-[0.3em]">Sincronizando nc-s1125...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 min-h-screen bg-slate-950 text-white font-sans">
      
      {/* HEADER */}
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Calendario de Partidos</h1>
        <p className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.3em]">Seguimiento Oficial • Temporada 2026</p>
      </div>

      {/* BARRA DE HERRAMIENTAS (ZONAS + BUSCADOR) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900/30 p-6 rounded-[3rem] border border-slate-900 shadow-2xl">
        
        {/* Selector de Zonas */}
        <div className="flex flex-wrap justify-center gap-2">
          <button 
            onClick={() => setZonaSeleccionada('TODAS')}
            className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${zonaSeleccionada === 'TODAS' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
          >
            Todas
          </button>
          {zonasDisponibles.map(zona => (
            <button 
              key={zona}
              onClick={() => setZonaSeleccionada(zona)}
              className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${zonaSeleccionada === zona ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
            >
              {zona}
            </button>
          ))}
        </div>

        {/* Buscador de Equipo */}
        <div className="relative w-full md:w-72 group">
          <input 
            type="text" 
            placeholder="BUSCAR MI EQUIPO..." 
            value={busquedaEquipo}
            onChange={(e) => setBusquedaEquipo(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-[10px] font-black outline-none focus:border-blue-500 transition-all uppercase placeholder:text-slate-700"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-30 group-focus-within:opacity-100 transition-opacity">🔍</span>
        </div>
      </div>

      {/* RENDERIZADO DE RESULTADOS */}
      <div className="space-y-16 mt-12">
        {Object.keys(agrupados).length > 0 ? (
          Object.keys(agrupados).map((nroFecha) => (
            <div key={nroFecha} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-white uppercase italic">Fecha {nroFecha}</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agrupados[nroFecha].map((partido) => (
                  <div key={partido.id} className="bg-slate-900 border border-slate-800 p-5 rounded-[2.5rem] hover:border-blue-500/30 transition-all shadow-xl relative overflow-hidden group">
                    
                    {partido.zona && (
                      <div className="absolute top-0 right-10 bg-slate-800 text-slate-400 text-[7px] font-black px-4 py-1 rounded-b-xl uppercase tracking-widest border-x border-slate-700">
                        {partido.zona}
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-6 px-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">{partido.fecha_calendario}</span>
                      <span className="text-[9px] font-black text-amber-500 bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10 tracking-widest">{partido.horario} HS</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Local */}
                      <div className="flex flex-col items-center flex-1 gap-2">
                        <img src={partido.local?.escudo_url || 'https://via.placeholder.com/60'} alt="Local" className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-500" />
                        <span className="text-[10px] font-black uppercase text-center leading-tight h-8 flex items-center">{partido.local?.nombre}</span>
                      </div>

                      {/* Marcador Central */}
                      <div className="flex flex-col items-center justify-center min-w-[70px]">
                        {partido.finalizado ? (
                          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-2xl border border-slate-800 shadow-inner">
                            <span className="text-xl font-black text-white">{partido.goles_local}</span>
                            <span className="text-slate-700">-</span>
                            <span className="text-xl font-black text-white">{partido.goles_visitante}</span>
                          </div>
                        ) : (
                          <span className="text-lg font-black text-slate-700 italic tracking-tighter group-hover:text-blue-500">VS</span>
                        )}
                        <span className="text-[6px] font-bold text-slate-600 uppercase mt-2 tracking-widest">{partido.categoria}</span>
                      </div>

                      {/* Visitante */}
                      <div className="flex flex-col items-center flex-1 gap-2">
                        <img src={partido.visitante?.escudo_url || 'https://via.placeholder.com/60'} alt="Visita" className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-500" />
                        <span className="text-[10px] font-black uppercase text-center leading-tight h-8 flex items-center">{partido.visitante?.nombre}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
             <div className="text-4xl">🔎</div>
             <p className="text-slate-600 font-black uppercase italic tracking-widest text-xs">
               No se encontraron partidos para "{busquedaEquipo}"
             </p>
             <button onClick={() => setBusquedaEquipo('')} className="text-blue-500 text-[10px] font-black uppercase underline">Limpiar búsqueda</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FixturePublico;