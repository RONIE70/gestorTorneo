import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { PrinterIcon, DocumentDuplicateIcon } from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// IMPORTANTE: CarnetDelDelegado debe estar exportado en GestionDelegados.js
import { CarnetDelDelegado } from './GestionDelegados'; 

const AdminMaestro = () => {
  // --- ESTADOS DE IDENTIDAD Y CONTROL ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- ESTADOS PARA LA CONFIGURACIÓN ACTUAL ---
  const [configActual, setConfigActual] = useState({
    id: null,
    modelo_torneo: 'todos_contra_todos',
    año_lectivo: 2026,
    valor_modulo: 1000,
    dias_juego: [],
    nombre_edicion: '',
  });

  // --- ESTADOS PARA IMPRESIÓN GLOBAL (LONA 1MT) ---
  const [delegadosLiga, setDelegadosLiga] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const [generandoLona, setGenerandoLona] = useState(false);
  const lienzoRef = useRef(null);

  // 1. OBTENER CONTEXTO DE ORGANIZACIÓN
  useEffect(() => {
    const obtenerContextoOrg = async () => {
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
        if (!userOrgId) setCargandoConfig(false);
      }
    };
    obtenerContextoOrg();
  }, [userOrgId]); 

  // 2. CARGAR CONFIGURACIÓN Y DATOS DE IMPRESIÓN
  useEffect(() => {
    if (!userOrgId) return;

    const cargarTodo = async () => {
      try {
        // A. Cargar última configuración de torneo
        const { data: configData } = await supabase
          .from('configuracion_torneo')
          .select('*')
          .eq('organizacion_id', userOrgId)
          .order('id', { ascending: false })
          .limit(1)
          .single();
        if (configData) setConfigActual(configData);

        // B. Cargar Configuración de Liga (Logo y Nombre)
        const { data: cLiga } = await supabase
          .from('configuracion_liga')
          .select('*')
          .eq('organizacion_id', userOrgId)
          .maybeSingle();
        setConfigLiga(cLiga);

        // C. Mapear Clubes (Para mostrar nombres en los carnets globales)
        const { data: equipos } = await supabase
          .from('equipos')
          .select('id, nombre')
          .eq('organizacion_id', userOrgId);
        
        const mapping = {};
        equipos?.forEach(e => mapping[e.id] = e.nombre);
        setClubesMap(mapping);

        // D. Cargar todos los delegados de la liga
        const { data: dels } = await supabase
          .from('delegados')
          .select('*')
          .eq('organizacion_id', userOrgId);
        setDelegadosLiga(dels || []);

      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.log("Sincronizando datos iniciales...");
      } finally {
        setCargandoConfig(false);
      }
    };
    cargarTodo();
  }, [userOrgId]);

  // 3. FUNCIÓN PARA GUARDAR CONFIGURACIÓN
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

  // 4. LÓGICA DE IMPRESIÓN LONA GLOBAL (1MT X 1MT)
  const imprimirLonaLiga = async () => {
    if (delegadosLiga.length === 0) return alert("No hay delegados en la liga");
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [1000, 1000]
      });

      const canvas = await html2canvas(lienzoRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 1000, 1000);
      doc.save(`LONA_DELEGADOS_GLOBAL_${new Date().getFullYear()}.pdf`);
    } catch (error) {
      console.error("Error PDF:", error);
      alert("Error al generar el lienzo global");
    } finally {
      setGenerandoLona(false);
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white space-y-10">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-blue-500">Panel Maestro de Control</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión Multi-Torneo para Organizadores</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={imprimirLonaLiga}
            disabled={generandoLona}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl text-[10px] font-black flex items-center gap-3 shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <PrinterIcon className="w-5 h-5" />
            {generandoLona ? 'GENERANDO LIENZO...' : 'IMPRIMIR LONA DELEGADOS LIGA'}
          </button>

          <div className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-2xl">
             <p className="text-[8px] font-black text-blue-400 uppercase">ID Organización</p>
             <p className="text-[10px] font-mono text-white">{userOrgId || 'Verificando...'}</p>
          </div>
        </div>
      </header>

      {/* ESTADÍSTICAS RÁPIDAS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Delegados en Liga</p>
              <h2 className="text-5xl font-black text-emerald-500 mt-2">{delegadosLiga.length}</h2>
          </div>
      </div>

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
            
            <div className="space-y-6">
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre de la Edición</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent text-white text-lg font-bold outline-none mt-1"
                    value={configActual.nombre_edicion}
                    onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})}
                    placeholder="Ej: Femenino Apertura"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Modelo</label>
                    <select 
                      className="w-full bg-transparent text-white font-bold outline-none mt-1"
                      value={configActual.modelo_torneo}
                      onChange={(e) => setConfigActual({...configActual, modelo_torneo: e.target.value})}
                    >
                      <option value="todos_contra_todos">Todos contra Todos</option>
                      <option value="eliminacion_directa">Eliminación Directa</option>
                      <option value="grupos_y_playoff">Grupos + Playoff</option>
                    </select>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Año Lectivo</label>
                    <input 
                      type="number" 
                      className="w-full bg-transparent text-white font-bold outline-none mt-1"
                      value={configActual.año_lectivo}
                      onChange={(e) => setConfigActual({...configActual, año_lectivo: parseInt(e.target.value)})}
                    />
                  </div>
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
              {configActual.id ? 'Actualizar Torneo Actual' : 'Crear Nuevo Torneo Oficial'}
            </button>
          </div>
        </div>
      </main>

      {/* --- LIENZO OCULTO DE 1 METRO (GLOBAL) --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
        <div 
          ref={lienzoRef} 
          style={{ 
            width: '1000mm', 
            height: '1000mm', 
            padding: '10mm',
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 66.8mm)', 
            gridAutoRows: '86.9mm',
            gap: '5mm', 
            background: 'white'
          }}
        >
          {delegadosLiga.map((del) => (
            <CarnetDelDelegado 
              key={del.id} 
              data={del} 
              clubNombre={clubesMap[del.club_id] || "S/D"} 
              soloDiseño={true} 
              configLiga={configLiga} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTE: HISTORIAL DE TORNEOS ---
const HistorialTorneos = ({ userOrgId, onEdit, refreshTrigger }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorial = useCallback(async () => {
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
      console.error("Error historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [userOrgId]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial, refreshTrigger]);

  const activarTorneo = async (torneoId) => {
    try {
      await supabase.from('configuracion_torneo').update({ activo: false }).eq('organizacion_id', userOrgId);
      await supabase.from('configuracion_torneo').update({ activo: true }).eq('id', torneoId);
      alert("🚀 Torneo activado correctamente");
      fetchHistorial(); 
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("No se pudo activar el torneo");
    }
  };

  if (loading) return <div className="text-center py-10 animate-pulse text-slate-600 text-[10px] font-black">Sincronizando con la Liga...</div>;

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] shadow-2xl h-full">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 italic">Archivo de Torneos Registrados</h3>
      <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {historial.length === 0 ? (
          <p className="text-slate-600 text-[10px] font-black uppercase text-center py-10">No hay torneos registrados</p>
        ) : (
          historial.map((torneo) => (
            <div key={torneo.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-all">
              <div className="space-y-1 cursor-pointer" onClick={() => onEdit(torneo)}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${torneo.activo ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-800'}`}></span>
                  <span className="text-blue-500 font-black italic text-xs">#{torneo.id}</span>
                  <h4 className="font-bold uppercase text-slate-200 text-sm">{torneo.nombre_edicion}</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Año: {torneo.año_lectivo} | Módulo: ${torneo.valor_modulo}</p>
              </div>
              <div className="flex items-center gap-4">
                {!torneo.activo && (
                  <button onClick={() => activarTorneo(torneo.id)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase border border-blue-500/20">Activar</button>
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