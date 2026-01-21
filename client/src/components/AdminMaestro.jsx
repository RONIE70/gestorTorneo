import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AdminMaestro = () => {
  // --- ESTADOS PARA LA CONFIGURACIÓN ACTUAL (IMAGEN 2) ---
  const [configActual, setConfigActual] = useState({
    id: null,
    modelo_torneo: 'todos_contra_todos',
    año_lectivo: 2026,
    valor_modulo: 1000,
    dias_juego: []
  });
  // eslint-disable-next-line no-unused-vars
  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- CARGA INICIAL DE CONFIGURACIÓN ---
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        // eslint-disable-next-line no-unused-vars
        const { data, error } = await supabase
          .from('configuracion_torneo')
          .select('*')
          .order('id', { ascending: false })
          .limit(1)
          .single();

        if (data) setConfigActual(data);
      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.log("No hay configuración previa o es un torneo nuevo");
      } finally {
        setCargandoConfig(false);
      }
    };
    cargarConfiguracion();
  }, []);

  // --- FUNCIÓN PARA GUARDAR CAMBIOS (PUNTO 1: VALOR MÓDULO) ---
  const guardarCambiosTorneo = async () => {
    try {
      const { error } = await supabase
        .from('configuracion_torneo')
        .update({ 
          valor_modulo: parseInt(configActual.valor_modulo),
          modelo_torneo: configActual.modelo_torneo,
          dias_juego: configActual.dias_juego
        })
        .eq('id', configActual.id);

      if (error) throw error;
      alert("✅ Parámetros económicos actualizados correctamente");
    } catch (err) {
      alert("❌ Error al guardar: " + err.message);
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white space-y-10">
      <header className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black uppercase italic text-blue-500">Panel Maestro de Control</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configuración Global y Archivo Histórico</p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* COLUMNA IZQUIERDA: HISTORIAL (IMAGEN 1) */}
        <div className="space-y-6">
           <HistorialTorneos />
        </div>

        {/* COLUMNA DERECHA: PARÁMETROS ACTUALES (IMAGEN 2) */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl space-y-8">
            <div>
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-2">Parámetros Económicos</h3>
              <p className="text-xs text-slate-400">Define el valor base para las multas del Tribunal de Disciplina.</p>
            </div>
            
            <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Valor Multa por Módulo</label>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-3xl font-black text-slate-800">$</span>
                <input 
                  type="number" 
                  className="w-full bg-transparent text-emerald-500 text-4xl font-black outline-none tabular-nums"
                  value={configActual.valor_modulo}
                  onChange={(e) => setConfigActual({...configActual, valor_modulo: e.target.value})}
                />
              </div>
              <div className="mt-6 pt-4 border-t border-slate-900 flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[9px] text-slate-600 italic">Este valor actualiza automáticamente los nuevos expedientes del Tribunal.</p>
              </div>
            </div>

            <button 
              onClick={guardarCambiosTorneo}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-900/20 active:scale-95"
            >
              Aplicar Cambios en la Liga
            </button>
          </div>
        </div>

      </main>
    </div>
  );
};

// --- SUB-COMPONENTE: HISTORIAL DE TORNEOS (IMAGEN 1) ---
const HistorialTorneos = () => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorial = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('configuracion_torneo')
          .select('*')
          .order('año_lectivo', { ascending: false });

        if (error) throw error;
        setHistorial(data || []);
      } catch (err) {
        console.error("Error cargando historial:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorial();
  }, []);

  if (loading) return <div className="text-center py-10 animate-pulse text-slate-600 text-[10px] font-black uppercase">Sincronizando Archivos...</div>;

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
      <header className="flex justify-between items-center mb-8 px-2">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">HISTORIAL Y ESTADOS DE LIGA</h3>
        <span className="bg-blue-600/10 text-blue-500 text-[8px] font-black px-3 py-1 rounded-full border border-blue-500/20">
          {historial.length} REGISTROS
        </span>
      </header>
      
      <div className="grid gap-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
        {historial.map((torneo) => (
          <div key={torneo.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-black italic text-xs">#{torneo.id}</span>
                <h4 className="font-bold uppercase text-slate-200 text-sm">
                  {torneo.modelo_torneo ? torneo.modelo_torneo.replace(/_/g, ' ') : 'S/D'}
                </h4>
                <span className="bg-slate-800 text-[8px] px-2 py-1 rounded text-slate-400 font-black border border-slate-700">{torneo.año_lectivo}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium italic">
                Inicio: {torneo.fecha_inicio || 'Pendiente'} | Valor Módulo: ${torneo.valor_modulo || '0'}
              </p>
            </div>
            
            <button className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${torneo.sorteo_realizado ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
              {torneo.sorteo_realizado ? '📂 Ver Fixture' : '⏳ Pendiente'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminMaestro;