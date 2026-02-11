import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AdminMaestro = () => {
  // --- 2.1. ESTADO GLOBAL DE IDENTIDAD (SaaS) ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- ESTADOS PARA LA CONFIGURACIÓN ACTUAL ---
  const [configActual, setConfigActual] = useState({
    id: null,
    modelo_torneo: 'todos_contra_todos',
    año_lectivo: 2026,
    valor_modulo: 1000,
    dias_juego: [],
    nombre_edicion: '',
  });

  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- 1. FUNCIÓN PARA OBTENER EL CONTEXTO DE ORGANIZACIÓN ---
  useEffect(() => {
    const obtenerContextoOrg = async () => {
      // Quitamos el freno que causaba el bucle y usamos try/finally
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: perfil, error } = await supabase
            .from('perfiles')
            .select('organizacion_id')
            .eq('id', session.user.id)
            .single();
          
          if (error) throw error;
          
          if (perfil && perfil.organizacion_id !== userOrgId) {
            setUserOrgId(perfil.organizacion_id);
          }
        }
      } catch (err) {
        console.error("Error obteniendo organización:", err.message);
      } finally {
        // Si no hay perfil o hay error, igual dejamos de cargar el estado inicial
        if (!userOrgId) setCargandoConfig(false);
      }
    };
    obtenerContextoOrg();
    // Dejamos la dependencia vacía para que solo corra al montar el componente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // --- 2. CARGA DE CONFIGURACIÓN FILTRADA POR ORGANIZACIÓN ---
  useEffect(() => {
    if (!userOrgId) return;

    const cargarConfiguracion = async () => {
      try {
        // eslint-disable-next-line no-unused-vars
        const { data, error } = await supabase
          .from('configuracion_torneo')
          .select('*')
          .eq('organizacion_id', userOrgId)
          .order('id', { ascending: false })
          .limit(1)
          .single();

        if (data) setConfigActual(data);
      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.log("No hay configuración previa para esta liga.");
      } finally {
        setCargandoConfig(false);
      }
    };
    cargarConfiguracion();
  }, [userOrgId]);


  // --- 3. FUNCIÓN PARA GUARDAR ---
  const guardarCambiosTorneo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!userOrgId || !session) return alert("❌ Error de sesión.");

    setCargandoConfig(true);
    try {
      const { data, error } = await supabase
        .from('configuracion_torneo')
        .upsert({
          id: configActual.id || undefined, 
          nombre_edicion: configActual.nombre_edicion,
          modelo_torneo: configActual.modelo_torneo,
          año_lectivo: configActual.año_lectivo,
          valor_modulo: parseInt(configActual.valor_modulo),
          organizacion_id: userOrgId,
          configurado_por: session.user.id,
          dias_juego: configActual.dias_juego
        })
        .select().single();

      if (error) throw error;
      alert("✅ Torneo registrado bajo la identidad de tu Liga.");
      
      setConfigActual(data);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setCargandoConfig(false);
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white space-y-10">
      <header className="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-blue-500">Panel Maestro de Control</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Gestión Multi-Torneo para Organizadores
          </p>
        </div>
        <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-2xl">
           <p className="text-[8px] font-black text-blue-400 uppercase">ID Organización</p>
           <p className="text-[10px] font-mono text-white">{userOrgId || 'Verificando...'}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
           <HistorialTorneos 
             userOrgId={userOrgId} 
             refreshTrigger={refreshTrigger}
             onEdit={(torneo) => setConfigActual(torneo)} 
           />
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl space-y-8">
            <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-2">Configuración Activa</h3>
            
            <div className="space-y-4">
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre de la Edición (Ej: Femenino Apertura)</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent text-white text-lg font-bold outline-none mt-1"
                    value={configActual.nombre_edicion}
                    onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})}
                    placeholder="Ingrese nombre del torneo"
                  />
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
               </div>
            </div>

            <button 
              onClick={guardarCambiosTorneo}
              disabled={cargandoConfig}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {configActual.id ? 'Actualizar Torneo' : 'Crear Nuevo Torneo'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTE: HISTORIAL DE TORNEOS ---
const HistorialTorneos = ({ userOrgId, onEdit, refreshTrigger }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorial = useCallback(async () => {
    // FIX CRÍTICO: Si no hay orgId, apagamos el loading antes de salir
    if (!userOrgId) {
      setLoading(false); 
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion_torneo')
        .select('*')
        .eq('organizacion_id', userOrgId)
        .order('id', { ascending: false });

      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error cargando historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [userOrgId]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial, refreshTrigger]);

  const activarTorneo = async (torneoId) => {
  try {
    const { error: errorOff } = await supabase
      .from('configuracion_torneo')
      .update({ activo: false })
      .eq('organizacion_id', userOrgId);
    
    if (errorOff) throw errorOff;

    const { error: errorOn } = await supabase
      .from('configuracion_torneo')
      .update({ activo: true })
      .eq('id', torneoId);

    if (errorOn) throw errorOn;

    alert("🚀 Torneo activado correctamente");
    fetchHistorial(); 
  } catch (err) {
    console.error("Error al activar:", err.message);
    alert("No se pudo activar el torneo");
  }
};

  // Renderizado condicional del loading corregido
  if (loading) return <div className="text-center py-10 animate-pulse text-slate-600 text-[10px] font-black">Sincronizando con la Liga...</div>;

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">ARCHIVO DE TORNEOS</h3>
      <div className="grid gap-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
        {historial.length === 0 ? (
          <p className="text-slate-600 text-[10px] font-black uppercase text-center py-10">No hay torneos registrados</p>
        ) : (
          historial.map((torneo) => (
            <div 
              key={torneo.id} 
              className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-all"
            >
              <div className="space-y-1 cursor-pointer" onClick={() => onEdit(torneo)}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${torneo.activo ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-800'}`}></span>
                  <span className="text-blue-500 font-black italic text-xs">#{torneo.id}</span>
                  <h4 className="font-bold uppercase text-slate-200 text-sm">
                    {torneo.nombre_edicion || 'Sin Nombre'}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                  Año: {torneo.año_lectivo} | Módulo: ${torneo.valor_modulo}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {!torneo.activo && (
                  <button 
                    onClick={() => activarTorneo(torneo.id)}
                    className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase border border-blue-500/20 transition-all"
                  >
                    Activar
                  </button>
                )}
                <span className="text-[18px] cursor-pointer" onClick={() => onEdit(torneo)}>📂</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminMaestro;