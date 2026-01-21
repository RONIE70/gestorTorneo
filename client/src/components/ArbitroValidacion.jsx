import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const ArbitroValidacion = ({ partidoId }) => {
  const [citadasL, setCitadasL] = useState([]);
  const [citadasV, setCitadasV] = useState([]);
  const [loading, setLoading] = useState(true);

 
  // 1. Estabilizamos la función con useCallback
  const fetchCitadas = useCallback(async () => {
    if (!partidoId) return;
    
    setLoading(true);
    try {
      // Traemos las jugadoras citadas
      const { data, error } = await supabase
        .from('planillas_citadas')
        .select('*, jugadoras(*)')
        .eq('partido_id', partidoId);

      if (error) throw error;

      if (data && data.length > 0) {
        // Obtenemos los IDs de los equipos directamente del partido para separar las listas
        const { data: partido } = await supabase
          .from('partidos')
          .select('local_id, visitante_id')
          .eq('id', partidoId)
          .single();

        if (partido) {
          setCitadasL(data.filter(c => c.equipo_id === partido.local_id));
          setCitadasV(data.filter(c => c.equipo_id === partido.visitante_id));
        }
      }
    } catch (err) {
      console.error("Error en fetchCitadas:", err.message);
    } finally {
      setLoading(false);
    }
  }, [partidoId]); // Solo se recrea si cambia el partidoId

  // 2. El efecto ahora es limpio y seguro
  useEffect(() => {
    fetchCitadas();
  }, [fetchCitadas]);


  const confirmarAsistencia = async (jugadoraId, estado) => {
    const { error } = await supabase
      .from('asistencia_partido')
      .upsert({ partido_id: partidoId, jugadora_id: jugadoraId, presente: estado });
    
    if (!error) fetchCitadas();
  };

  if (loading) return <div className="p-10 text-center text-blue-500 font-black animate-pulse uppercase">Cargando Planillas Citadas...</div>;

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-black uppercase italic text-amber-500 tracking-tighter">Validación de Identidad</h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Control de Ingreso nc-s1125</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
        {/* COLUMNA LOCAL */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-blue-500 uppercase border-l-4 border-blue-500 pl-3 italic">Plantel Local</h2>
          {citadasL.map(c => (
            <JugadoraRow key={c.id} jugadora={c.jugadoras} onConfirm={confirmarAsistencia} />
          ))}
        </section>

        {/* COLUMNA VISITANTE */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-white uppercase border-l-4 border-white pl-3 italic">Plantel Visitante</h2>
          {citadasV.map(c => (
            <JugadoraRow key={c.id} jugadora={c.jugadoras} onConfirm={confirmarAsistencia} />
          ))}
        </section>
      </div>
      
      <button className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-amber-600 hover:bg-amber-500 px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-2xl shadow-amber-900/40 transition-all active:scale-95">
        🚀 Iniciar Planilla de Juego
      </button>
    </div>
  );
};

const JugadoraRow = ({ jugadora, onConfirm }) => (
  <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-3xl border border-slate-800 hover:border-slate-700 transition-all">
    <img src={jugadora.foto_url} className="w-12 h-12 rounded-xl object-cover border border-slate-700" alt="perfil" />
    <div className="flex-1">
      <p className="text-[11px] font-black uppercase leading-tight">{jugadora.apellido}, <span className="text-slate-400">{jugadora.nombre}</span></p>
      <p className="text-[9px] text-slate-500 font-mono mt-0.5">DNI: {jugadora.dni}</p>
    </div>
    
    {/* Botón para abrir el carnet digital y validar con el QR */}
    <button 
      onClick={() => window.open(`/carnet/${jugadora.id}`, '_blank')}
      className="bg-slate-800 p-2 rounded-xl text-xs grayscale hover:grayscale-0 transition-all"
    >
      🪪
    </button>
    
    <input 
      type="checkbox" 
      onChange={(e) => onConfirm(jugadora.id, e.target.checked)}
      className="w-6 h-6 rounded-lg bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0" 
    />
  </div>
);

export default ArbitroValidacion;