import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const FichaJugadora = ({ jugadoraId, onClose, esTribunal = false }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatosCompletos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('jugadoras')
        .select(`
          nombre, apellido, foto_url, goles_totales, partidos_jugados, dni,
          equipos(nombre, escudo_url),
          sanciones(*) 
        `)
        .eq('id', jugadoraId)
        .single();

      if (!error) setStats(data);
      setLoading(false);
    };
    if (jugadoraId) cargarDatosCompletos();
  }, [jugadoraId]);

  if (loading) return <div className="text-center p-10 animate-pulse text-blue-500 font-black">CARGANDO FICHA...</div>;
  if (!stats) return null;

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl max-w-md w-full relative overflow-hidden">
      {/* Botón Cerrar */}
      <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white font-black z-10">✕</button>

      {/* Encabezado */}
      <div className="flex items-center gap-6 mb-8">
        <div className="relative">
            <img src={stats.foto_url || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-3xl object-cover border-2 border-blue-500 shadow-lg shadow-blue-900/20" alt="perfil" />
            <img src={stats.equipos?.escudo_url} className="w-8 h-8 rounded-full absolute -bottom-2 -right-2 border-2 border-slate-900 bg-slate-900" alt="club" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase italic leading-none text-white">{stats.apellido}</h2>
          <h2 className="text-xl font-bold uppercase text-slate-400">{stats.nombre}</h2>
          <p className="text-blue-500 font-black uppercase text-[10px] tracking-widest mt-2">{stats.equipos?.nombre}</p>
        </div>
      </div>

      {/* Stats Deportivas (PUNTO 3: VISIBLE PARA TODAS) */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase italic mb-1 tracking-tighter">Goles Marcados</p>
          <p className="text-4xl font-black text-white tabular-nums">{stats.goles_totales || 0}</p>
        </div>
        <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase italic mb-1 tracking-tighter">Partidos Jugados</p>
          <p className="text-4xl font-black text-white tabular-nums">{stats.partidos_jugados || 0}</p>
        </div>
      </div>

      {/* Historial Disciplinario (PUNTO 4: SOLO VISIBLE PARA TRIBUNAL) */}
      {esTribunal ? (
        <div className="space-y-3 mt-4 border-t border-slate-800 pt-6">
          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-2 italic">⚠️ Registro de Reincidencia</h4>
          <div className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {stats.sanciones && stats.sanciones.length > 0 ? (
                  stats.sanciones.map(s => (
                      <div key={s.id} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                          <div>
                              <p className="text-[9px] text-slate-300 font-bold uppercase">{s.motivo}</p>
                              <p className="text-[7px] text-slate-500 uppercase">{new Date(s.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className="bg-rose-600/10 text-rose-500 text-[9px] font-black px-3 py-1 rounded-lg border border-rose-500/20">
                              {s.cantidad_fechas} F
                          </span>
                      </div>
                  ))
              ) : (
                  <p className="text-[9px] text-slate-600 text-center py-4 uppercase font-bold italic">Sin antecedentes disciplinarios</p>
              )}
          </div>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 text-center">
            <p className="text-[9px] text-blue-400/60 font-bold uppercase tracking-widest">
                🛡️ Ficha Oficial Verificada • Temporada 2026
            </p>
        </div>
      )}
    </div>
  );
};

export default FichaJugadora;